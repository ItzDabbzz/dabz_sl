/**
 * Store-level scraping for the Second Life Marketplace.
 *
 * A store page (`/stores/<id>`) renders up to `per_page` products per page in a
 * 3-column grid. Each grid card carries everything needed to build a canonical
 * product URL plus a useful subset of listing metadata, so the whole catalog
 * can be enumerated in a handful of page loads instead of one load per item.
 *
 * Two phases:
 *   1. Enumerate — walk the paginated store listing and collect product URLs
 *      (plus cheap metadata) for every item in the store.
 *   2. Detail    — visit each product page with a bounded worker pool and
 *      scrape the full listing.
 *
 * The listing pages expose the canonical product id on the card element
 * (`id="product-<id>"`) while the card href points at a `/s/<slug>/<listingId>`
 * alias that redirects to `/p/<slug>/<productId>`. The slug is cosmetic — the
 * server resolves on the numeric id alone — so canonical URLs are built
 * directly from the card id without paying for a redirect.
 *
 * ── Rate limiting ───────────────────────────────────────────────────────────
 * The marketplace is a shared, rate-limited origin and the account behind it
 * can be throttled or blocked. This module is deliberately conservative:
 *
 *   - One shared browser context, so every request carries the same session
 *     and the site sees a normal browsing client rather than a swarm.
 *   - A global request pacer: a minimum delay between *any* two requests,
 *     enforced across all workers. Concurrency is capped on top of that.
 *   - A hard stop when the origin starts refusing requests (the marketplace
 *     answers 406 to non-browser clients, 429 when throttled), so a run can
 *     never hammer a blocked origin.
 *   - Checkpointing, so a long run can be resumed instead of restarted.
 *
 * Default pacing is ~1 request/second, which keeps a 2000-item store to
 * roughly 35 minutes while staying well inside normal browsing rates.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { configurePage, scrapeItemFromPage } from './scrape-item.js';
import {
  CheckpointWriter,
  emptyCheckpoint,
  readCheckpointFile,
} from './checkpoint.js';
import type {
  Item,
  PageOptions,
  ScrapeOptions,
  StoreListingItem,
  StoreScrapeFailure,
  StoreScrapeOptions,
  StoreScrapeResult,
} from './types.js';

/** Marketplace origin. Store and product URLs are both rooted here. */
const MARKETPLACE_ORIGIN = 'https://marketplace.secondlife.com';

/** The store listing renders at most 96 cards per page. Larger values are clamped. */
export const MAX_PER_PAGE = 96;

/**
 * Status codes that mean "we are being throttled or blocked, stop now".
 * The marketplace answers 406 to plain HTTP clients, so a 406 means the
 * request did not look like a browser and must not be retried blindly.
 */
const THROTTLE_STATUSES = new Set([403, 406, 429, 503]);

/** Thrown when the marketplace starts refusing requests. */
export class ThrottledError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ThrottledError';
  }
}

/**
 * Serializes requests to the marketplace behind a minimum delay.
 *
 * Every request — listing page or product page — passes through here, so the
 * total request rate stays bounded no matter how many workers are running.
 */
class RequestPacer {
  private nextSlot = 0;

  constructor(private readonly minDelayMs: number) {}

  /** Wait until the next request may be issued. */
  async wait(): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + this.minDelayMs;
    const waitMs = slot - now;
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
  }
}

/**
 * Listing filters that are always applied to a store scrape.
 *
 * Demo items are free previews of another product, and limited-quantity items
 * cannot be bought again once their stock runs out. Neither is a real
 * catalog entry, so a store inventory that includes them is not a faithful
 * picture of what the store sells.
 */
export const ALWAYS_FILTERS: Record<string, string> = {
  'search[no_demos]': '1',
  'search[no_limited_quantities]': '1',
};

/**
 * Extract the store id AND the marketplace search filters from a store URL.
 *
 * A pasted store URL carries the filters the marketplace itself was using —
 * page size, sort order, price bounds, and the demo/limited-quantity flags.
 * Throwing them away silently changes what gets scraped, so they are parsed
 * out and handed to the listing builder.
 *
 * @example
 * parseStoreUrl('https://marketplace.secondlife.com/stores/199625')
 * // { storeId: '199625', query: {} }
 *
 * parseStoreUrl(
 *   'https://marketplace.secondlife.com/stores/199625?search[no_demos]=1&search[per_page]=96',
 * )
 * // { storeId: '199625', query: { 'search[no_demos]': '1', 'search[per_page]': '96' } }
 */
export function parseStoreUrl(input: string): {
  storeId: string;
  query: Record<string, string>;
} {
  const trimmed = input.trim();
  const match = trimmed.match(/\/stores\/(\d+)/);
  if (!match?.[1]) {
    if (/^\d+$/.test(trimmed)) return { storeId: trimmed, query: {} };
    throw new Error(`Not a store id or store URL: ${input}`);
  }
  const storeId = match[1];

  const query: Record<string, string> = {};
  const qIndex = trimmed.indexOf("?");
  if (qIndex >= 0) {
    const params = new URLSearchParams(trimmed.slice(qIndex + 1));
    for (const [key, value] of params) {
      // Only the marketplace's own `search[...]` filters matter. Everything
      // else (utf8 markers, tracking params) is noise.
      if (!key.startsWith("search[")) continue;
      query[key] = value;
    }
  }

  return { storeId, query };
}

/**
 * Extract the numeric store id from a store URL or bare id.
 *
 * @example
 * parseStoreId('https://marketplace.secondlife.com/stores/199625') // '199625'
 * parseStoreId('199625') // '199625'
 */
export function parseStoreId(input: string): string {
  return parseStoreUrl(input).storeId;
}

/**
 * Build the store listing URL for a given page.
 *
 * The demo and limited-quantity filters are always applied. Any filters from
 * the original store URL are layered on top, and `per_page` is capped at
 * {@link MAX_PER_PAGE} — the marketplace silently clamps anything higher, so
 * requesting more just wastes a parameter.
 */
export function buildStoreUrl(
  storeId: string,
  page = 1,
  options: { perPage?: number; query?: Record<string, string> } = {},
): string {
  const perPage = Math.min(Math.max(1, options.perPage ?? MAX_PER_PAGE), MAX_PER_PAGE);
  const params = new URLSearchParams({
    'search[sort]': 'released_at_desc',
    ...(options.query ?? {}),
    // Spread last: these filters are always on, so nothing in the caller's
    // query can accidentally turn them off.
    ...ALWAYS_FILTERS,
  });
  // Honour a caller-supplied page size, but never above the hard cap.
  const requested = Number(params.get('search[per_page]'));
  const effectivePerPage =
    Number.isFinite(requested) && requested > 0
      ? Math.min(Math.round(requested), perPage)
      : perPage;
  params.set('search[per_page]', String(effectivePerPage));
  if (page > 1) params.set('page', String(page));
  return `${MARKETPLACE_ORIGIN}/stores/${storeId}?${params.toString()}`;
}

/** Grid-card metadata as read out of the browser. */
interface RawCard {
  productId: string;
  slug: string;
  title: string;
  price: string;
  brand: string;
  category: string[];
  image: string;
}

/**
 * Read every product card off the current store listing page.
 *
 * Runs entirely in the page context so one round trip gets the whole grid.
 */
async function readCards(page: Page): Promise<{ cards: RawCard[]; totalItems: number }> {
  return page.evaluate(() => {
    // NOTE: keep this function free of named inner functions and const-bound
    // arrows. `tsx` compiles with keepNames, which injects a `__name` helper
    // that does not exist inside the browser context.
    const cards: {
      productId: string;
      slug: string;
      title: string;
      price: string;
      brand: string;
      category: string[];
      image: string;
    }[] = [];

    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.gallery-item[id^="product-"]'))) {
      const productId = el.id.replace(/^product-/, '');
      if (!productId) continue;

      const link = el.querySelector<HTMLAnchorElement>('a.product-image, a.subtitle1');
      // Card hrefs look like /s/<slug>/<listingId>. The slug is cosmetic and
      // the listing id is not the product id, so only the slug is reused.
      const href = link?.getAttribute('href') ?? '';
      const slug = (href.match(/^\/s\/([^/]+)\//) ?? [])[1] ?? '';

      const title = el.querySelector<HTMLElement>('a.subtitle1')?.textContent?.trim() ?? '';
      const price = el.querySelector<HTMLElement>('.title4')?.textContent?.trim() ?? '';
      const brand = el.querySelector<HTMLElement>('.store-item')?.textContent?.trim() ?? '';

      // The card image carries an inline `onerror` that swaps in a `noimage`
      // placeholder when the asset fails to load. When assets are blocked
      // (the normal case) that handler has already run, so `src` holds the
      // placeholder. The real asset URL is still in the handler, in the last
      // `this.src='…'` assignment, so read it from there.
      let image = '';
      const img = el.querySelector<HTMLImageElement>('a.product-image img');
      if (img) {
        const src = img.getAttribute('src') ?? '';
        if (src.includes('noimage')) {
          const handler = img.getAttribute('onerror') ?? '';
          const matches = handler.match(/this\.src='([^']+)'/g);
          const candidates = matches
            ? matches.map((m) => m.replace(/^this\.src='/, '').replace(/'$/, ''))
            : [];
          const real = candidates.filter((u) => !u.includes('noimage')).pop();
          image = real ?? '';
        } else {
          image = src;
        }
      }

      // The grid card embeds a `product_dl_data_<id>` blob with the full
      // category path. Prefer it over the DOM, which only carries the brand.
      let category: string[] = [];
      const scripts = Array.from(el.querySelectorAll('script'))
        .map((s) => s.textContent ?? '')
        .join('\n');
      const dl = scripts.match(/product_dl_data_\d+\s*=\s*(\{[\s\S]*?\});/);
      if (dl?.[1]) {
        try {
          const parsed = JSON.parse(dl[1].replace(/'/g, '"')) as { category?: string; brand?: string };
          if (parsed.category) {
            // The embedded category is an HTML-entity-encoded JSON string.
            const holder = document.createElement('textarea');
            holder.innerHTML = parsed.category;
            const arr = JSON.parse(holder.value);
            if (Array.isArray(arr)) category = arr.map((c) => String(c));
          }
        } catch {
          /* embedded data is best-effort */
        }
      }

      cards.push({ productId, slug, title, price, brand, category, image });
    }

    const match = document.body.innerText.match(/([\d,]+)\s+matching items found/);
    const totalItems = match?.[1] ? parseInt(match[1].replace(/,/g, ''), 10) : 0;

    return { cards, totalItems };
  });
}

/**
 * Navigate to `url`, honouring the global pacer, and fail loudly on a
 * throttled or bot-check response.
 */
async function gotoPaced(page: Page, url: string, pacer: RequestPacer): Promise<void> {
  await pacer.wait();
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  const status = response?.status();
  if (status && THROTTLE_STATUSES.has(status)) {
    throw new ThrottledError(
      status,
      `Marketplace responded ${status} for ${url} — refusing to continue. ` +
        `Back off before retrying.`,
    );
  }
}

/**
 * Enumerate every product in a store by walking its paginated listing.
 *
 * Costs one request per 96 items, so a 2500-item store needs ~27 requests
 * instead of 2500.
 */
export async function enumerateStore(
  page: Page,
  storeId: string,
  options: {
    perPage?: number;
    query?: Record<string, string>;
    maxPages?: number;
    pacer?: RequestPacer;
    onPage?: (page: number, found: number, totalItems: number) => void;
  } = {},
): Promise<{ listing: StoreListingItem[]; totalItems: number; pagesFetched: number }> {
  const perPage = Math.min(Math.max(1, options.perPage ?? MAX_PER_PAGE), MAX_PER_PAGE);
  const pacer = options.pacer ?? new RequestPacer(0);
  const listing: StoreListingItem[] = [];
  const seen = new Set<string>();
  let totalItems = 0;
  let pagesFetched = 0;

  for (let pageNum = 1; ; pageNum++) {
    if (options.maxPages && pageNum > options.maxPages) break;

    await gotoPaced(page, buildStoreUrl(storeId, pageNum, { perPage, query: options.query }), pacer);

    const { cards, totalItems: reported } = await readCards(page);
    pagesFetched++;
    if (!totalItems && reported) totalItems = reported;

    let newOnPage = 0;
    for (const card of cards) {
      if (seen.has(card.productId)) continue;
      seen.add(card.productId);
      newOnPage++;
      listing.push({
        productId: card.productId,
        url: `${MARKETPLACE_ORIGIN}/p/${card.slug || 'item'}/${card.productId}`,
        title: card.title,
        price: card.price,
        brand: card.brand,
        category: card.category,
        image: card.image,
      });
    }

    options.onPage?.(pageNum, listing.length, totalItems);

    // Stop when the page is empty, when nothing new appeared (end of results),
    // or when we have covered the reported total.
    if (!cards.length) break;
    if (newOnPage === 0) break;
    if (totalItems && listing.length >= totalItems) break;
  }

  return { listing, totalItems, pagesFetched };
}

/** Write the enumerated listing to disk, atomically. */
async function writeListingFile(file: string, listing: StoreListingItem[]): Promise<void> {
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const dir = path.dirname(path.resolve(file));
    await fs.mkdir(dir, { recursive: true });
    // Write to a temp file and rename, so a crash mid-write can never leave a
    // half-written listing that a later resume would trust as complete.
    const tmp = path.join(dir, `.${path.basename(file)}.tmp`);
    await fs.writeFile(tmp, JSON.stringify(listing, null, 2), 'utf8');
    await fs.rename(tmp, file);
  } catch {
    /* listing persistence is best-effort */
  }
}

/**
 * Scrape an entire store.
 *
 * Phase 1 enumerates the store listing; phase 2 visits each product page with
 * a bounded worker pool. Set `listingOnly` to stop after phase 1.
 *
 * The store may be given as a bare id or as a full marketplace URL. When it is
 * a URL, the marketplace's own `search[...]` filters (page size, sort order,
 * price bounds) are carried over. Demo and limited-quantity items are always
 * excluded.
 *
 * @param store - Store id or store URL.
 */
export async function scrapeStore(
  store: string,
  opts: StoreScrapeOptions = {},
): Promise<StoreScrapeResult> {
  const parsed = parseStoreUrl(store);
  const storeId = parsed.storeId;
  const {
    concurrency = 2,
    minDelayMs = 1000,
    listingOnly = false,
    maxPages,
    query,
    onItem,
    onEnumerated,
    onPage,
    onAborted,
    checkpointPath,
    listingPath,
    reuseListing,
    headless = true,
    storageStatePath,
    onStage,
    ...pageOpts
  } = opts;

  // Filters carried in the store URL are the base; an explicit `query`
  // option layers on top of them.
  const listingQuery = { ...parsed.query, ...(query ?? {}) };

  const pacer = new RequestPacer(minDelayMs);
  let browser: Browser | undefined;
  const result: StoreScrapeResult = {
    storeId,
    totalItems: 0,
    pagesFetched: 0,
    items: [],
    failures: [],
    listing: [],
  };

  try {
    browser = await chromium.launch({ headless });
    // One shared context for the whole run: a single session, a single
    // device fingerprint, and a site that sees one client rather than many.
    const context: BrowserContext = await browser.newContext(
      storageStatePath ? { storageState: storageStatePath } : {},
    );

    // The checkpoint is the single source of truth for progress: it holds the
    // listing, the completed table, the failures and the in-flight item. It is
    // opened before enumeration so the listing can be persisted the moment it
    // is known.
    const checkpoint = checkpointPath ? new CheckpointWriter(checkpointPath) : undefined;
    const prior = checkpointPath ? readCheckpointFile(checkpointPath) : emptyCheckpoint();

    // ── Phase 1: enumerate ──────────────────────────────────────────────
    // A resumed run reuses the persisted listing instead of re-requesting
    // every listing page. The listing was captured before any product page
    // was visited, so it is complete.
    let listing: StoreListingItem[];
    let totalItems: number;
    let pagesFetched = 0;

    if (reuseListing && prior.listing.length) {
      listing = prior.listing;
      totalItems = prior.total || listing.length;
      onStage?.('enumerating:reused');
      onEnumerated?.(listing, totalItems);
    } else {
      const listPage = await context.newPage();
      await configurePage(listPage, pageOpts as PageOptions);
      onStage?.('enumerating');

      let enumeration: Awaited<ReturnType<typeof enumerateStore>>;
      // The store's reported item count is only known after the first page is
      // read, so it is tracked here and reported to the caller as it arrives.
      let reportedTotal = 0;
      try {
        enumeration = await enumerateStore(listPage, storeId, {
          query: listingQuery,
          maxPages,
          pacer,
          onPage: (p, found, total) => {
            onStage?.(`enumerating:${p}:${found}`);
            if (total) reportedTotal = total;
            onPage?.(p, found, reportedTotal);
          },
        });
      } finally {
        await listPage.close();
      }

      listing = enumeration.listing;
      totalItems = enumeration.totalItems || reportedTotal;
      pagesFetched = enumeration.pagesFetched;
      result.pagesFetched = pagesFetched;
      onEnumerated?.(listing, totalItems);

      // Persist the listing as soon as it is known, before any product page
      // is visited. An interrupted run then resumes without re-requesting
      // every listing page.
      checkpoint?.writeListing(listing, totalItems);
      if (listingPath) {
        await writeListingFile(listingPath, listing);
      }
    }

    result.listing = listing;
    result.totalItems = totalItems;

    if (listingOnly) return result;

    // ── Phase 2: detail pages ───────────────────────────────────────────
    // The completed set comes from the checkpoint, so it and the listing can
    // never disagree about what has been done.
    const alreadyDone = prior.done;
    const done = new Set<string>(alreadyDone);

    // An item that was in flight when the last run died is not "done", so it
    // is retried. Failing items are retried too — a timeout or a 500 is
    // usually transient.
    const pending = listing.filter((l) => !alreadyDone.has(l.productId));
    const items: Item[] = [];
    const failures: StoreScrapeFailure[] = [];
    const pool = Math.min(Math.max(1, concurrency), pending.length || 1);
    let cursor = 0;
    let processed = 0;
    let aborted = false;

    const worker = async (): Promise<void> => {
      for (;;) {
        if (aborted) return;
        const index = cursor++;
        if (index >= pending.length) return;
        const target = pending[index]!;
        let detailPage: Page | undefined;
        try {
          // Mark the item in flight before doing the work, so a crash leaves
          // a record of exactly where the run stopped.
          checkpoint?.writeCurrent(target.productId);

          detailPage = await context.newPage();
          await configurePage(detailPage, pageOpts as PageOptions);

          // Navigate with pacing + throttle detection, then extract from the
          // already-loaded page so the HTTP status stays inspectable.
          await gotoPaced(detailPage, target.url, pacer);
          const item = await scrapeItemFromPage(detailPage, target.url, (stage) =>
            onStage?.(`${stage}:${target.productId}`),
          );

          items.push(item);
          done.add(target.productId);
          processed++;
          onItem?.(item, processed, pending.length);

          // Written after every item, not every N items: the checkpoint is
          // append-only so this costs the same regardless of how many items
          // have already been done.
          checkpoint?.writeDone(target.productId, item);
          checkpoint?.writeCurrentClear(target.productId);
        } catch (e: unknown) {
          if (e instanceof ThrottledError) {
            // Stop the whole run. Continuing would hammer an origin that is
            // already refusing us, which is exactly how a block happens.
            aborted = true;
            result.aborted = e.message;
            onAborted?.(e.message);
            failures.push({ url: target.url, error: e.message, status: e.status });
            checkpoint?.writeFail(target.productId, e.message);
            checkpoint?.writeCurrentClear(target.productId);
            return;
          }
          const message = e instanceof Error ? e.message : String(e);
          failures.push({ url: target.url, error: message });
          checkpoint?.writeFail(target.productId, message);
          checkpoint?.writeCurrentClear(target.productId);
        } finally {
          try {
            if (detailPage) await detailPage.close();
          } catch {
            /* ignore close failures */
          }
        }
      }
    };

    await Promise.all(Array.from({ length: pool }, () => worker()));

    checkpoint?.flush();

    result.items = items;
    result.failures = failures;
    return result;
  } finally {
    if (browser) await browser.close();
  }
}
