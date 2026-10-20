import { Page } from 'playwright';
import type { Item, Permissions, PageOptions } from './types.js';

/**
 * Apply per-page Playwright settings derived from `PageOptions`.
 * Safe to call multiple times — errors are swallowed so a misconfigured
 * option never aborts an otherwise healthy scrape.
 */
export async function configurePage(page: Page, opts: PageOptions = {}): Promise<void> {
  const { timeout = 4000, navTimeout = 10_000, blockAssets = true } = opts;
  try {
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(navTimeout);
    if (blockAssets) {
      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (type === 'document' || type === 'xhr' || type === 'fetch') return route.continue();
        return route.abort();
      });
    }
  } catch { /* non-fatal */ }
}

/**
 * Scrape a single Second Life Marketplace product page.
 *
 * The caller is responsible for creating and closing the `Page`.
 * Use the higher-level `scrapeUrl` from `lib.ts` if you want automatic
 * browser lifecycle management.
 *
 * @param page    - A Playwright `Page` configured via `configurePage`.
 * @param url     - Full product URL or `file://…` path for local HTML.
 * @param onStage - Optional callback fired at the start of each scrape phase.
 *                  Useful for live progress reporting in CLIs or SSE streams.
 */
export async function scrapeItem(
  page: Page,
  url: string,
  onStage: (stage: string) => void = () => {},
): Promise<Item> {
  onStage('navigating');
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  return scrapeItemFromPage(page, url, onStage);
}

/**
 * Scrape a product that is already loaded on `page`, without navigating.
 *
 * Split out of {@link scrapeItem} so callers that need to inspect the HTTP
 * response status (e.g. to detect rate limiting or a bot-check page) can
 * navigate themselves and then extract the listing.
 *
 * @param page    - A Playwright `Page` already showing the product page.
 * @param url     - The product URL, recorded on the returned item.
 * @param onStage - Optional callback fired at the start of each scrape phase.
 */
export async function scrapeItemFromPage(
  page: Page,
  url: string,
  onStage: (stage: string) => void = () => {},
): Promise<Item> {

  // ── Title & version ────────────────────────────────────────────────────────
  onStage('title');
  let title = '';
  let version = '';
  try {
    const hasTitle2 = await page.locator('h1.title2').count();
    if (hasTitle2) {
      title =
        (await page.locator('h1.title2').first().evaluate((el) => {
          const clone = el.cloneNode(true) as HTMLElement;
          clone.querySelector('.version')?.remove();
          return (clone.textContent ?? '').trim();
        })) ?? '';
      // Guard with a count check: a locator that matches nothing still waits
      // out the full timeout before its `.catch()` fires, which is seconds of
      // dead time per product across a full store run.
      if (await page.locator('h1.title2 .version').count()) {
        const vtext = (await page.locator('h1.title2 .version').first().innerText().catch(() => '')).trim();
        if (vtext) version = vtext.replace(/^Version\s*/i, '').trim();
      }
    }
  } catch { /* leave empty */ }

  if (!title) {
    if (await page.locator('h1[itemprop="name"], h1.product-title, h1').count()) {
      title = (
        await page.locator('h1[itemprop="name"], h1.product-title, h1').first().textContent().catch(() => '') ?? ''
      ).trim();
    }
  }
  if (!version) {
    const versionLocator = page.locator('text=/Version:\\s*/i');
    if (await versionLocator.count()) {
      const versionText = await versionLocator.first().textContent().catch(() => '');
      if (versionText) {
        version = versionText.match(/Version:\s*(.*)/i)?.[1]?.trim() ?? '';
      }
    }
    // Fallback: some listings only carry the version in the details block.
    if (!version) {
      const detailsLocator = page.locator('.product-details, .details, table');
      if (await detailsLocator.count()) {
        const detailsText = await detailsLocator.first().innerText().catch(() => '');
        const m = detailsText.match(/Version\s*:?\s*(.+)/i);
        if (m) version = m[1].split('\n')[0].trim();
      }
    }
  }

  // ── Images ─────────────────────────────────────────────────────────────────
  onStage('images');
  const images: string[] = [];
  try {
    const imgSel =
      'section.listing__image .product-image .main-image img,' +
      'section.listing__image #image-thumbnails img,' +
      'img[itemprop="image"],' +
      '.product-images img,' +
      '.carousel img';
    const srcs = await page.$$eval(
      imgSel,
      (els) => (els as HTMLImageElement[]).map((e) => e.getAttribute('src')).filter(Boolean) as string[],
    );
    const base = page.url();
    // Deduplicate slm-assets by asset ID — lightbox and thumbnail are the same
    // underlying asset at different sizes. Always store the lightbox (full-res) URL.
    const seen = new Set<string>();
    for (const src of srcs) {
      try {
        if (!src || src.startsWith('data:')) continue;
        const abs = new URL(src, base).toString();
        const key = abs.match(/assets\/([0-9]+)\//)?.[1] ?? abs;
        if (seen.has(key)) continue;
        seen.add(key);
        images.push(abs.replace(/\/thumbnail\//, '/lightbox/'));
      } catch { /* skip malformed URLs */ }
    }
  } catch { /* leave empty */ }

  // ── Price ──────────────────────────────────────────────────────────────────
  onStage('price');
  let price = '';
  const priceLocator = page.locator('.prices .price-ld, .linden-price, [itemprop="price"], .price');
  if (await priceLocator.count()) {
    const priceRaw = (await priceLocator.first().innerText().catch(() => '')).trim();
    if (priceRaw) {
      const m = priceRaw.match(/([\d,]+)/);
      if (m) price = m[1].replace(/,/g, '');
    }
  }

  // ── Creator / store ────────────────────────────────────────────────────────
  onStage('creator');
  let creator: Item['creator'] = { name: '', link: '' };
  let store = '';
  try {
    const storeNameLocator = page.locator('#merchant-box .store-name');
    const storeHrefLocator = page.locator('#merchant-box a[href*="/stores/"]');
    const storeName = (await storeNameLocator.count())
      ? (await storeNameLocator.first().innerText().catch(() => '')).trim()
      : '';
    const storeHref = (await storeHrefLocator.count())
      ? await storeHrefLocator.first().getAttribute('href').catch(() => null)
      : null;
    if (storeName) creator.name = storeName;
    if (storeHref) {
      const abs = new URL(storeHref, page.url()).toString();
      creator.link = abs;
      store = abs;
    }
  } catch { /* fall through to secondary selectors */ }

  if (!creator.name || !creator.link) {
    try {
      const anchor = page.locator('a[href*="/stores/"], a[href*="/p/" i]:has-text("by ")').first();
      if (await anchor.count()) {
        const link = await anchor.getAttribute('href');
        const text = (await anchor.innerText()).replace(/^by\s+/i, '').trim();
        creator = { name: text, link: new URL(link ?? '', page.url()).toString() };
      }
    } catch { /* leave empty */ }
    try {
      const storeA = page.locator('a[href*="/stores/"]').first();
      if (await storeA.count()) {
        const href = await storeA.getAttribute('href');
        store = new URL(href ?? '', page.url()).toString();
      }
    } catch { /* leave empty */ }
  }

  // ── Permissions ────────────────────────────────────────────────────────────
  onStage('permissions');
  const perms: Permissions = { copy: '', modify: '', transfer: '' };
  try {
    const lis = await page.$$eval('#permissions li', (els) =>
      (els as HTMLElement[]).map((li) => ({ text: (li.textContent ?? '').trim(), cls: li.className ?? '' })),
    );
    for (const li of lis) {
      const allowed = /permitted/.test(li.cls) && !/not-permitted/.test(li.cls);
      if (/^copy$/i.test(li.text))     perms.copy     = allowed ? 'Yes' : 'No';
      if (/^modify$/i.test(li.text))   perms.modify   = allowed ? 'Yes' : 'No';
      if (/^transfer$/i.test(li.text)) perms.transfer = allowed ? 'Yes' : 'No';
    }
  } catch { /* fall through */ }
  if (!perms.copy && !perms.modify && !perms.transfer) {
    // Count-guard both fallbacks: an unmatched locator waits out its full
    // timeout before `.catch()` fires.
    const permsTextLocator = page.locator('text=Permissions, .permissions, .product-permissions');
    let permsText = '';
    if (await permsTextLocator.count()) {
      permsText = await permsTextLocator.first().locator('..').innerText().catch(() => '');
    }
    if (!permsText) {
      const permsFallback = page.locator('.permissions, .product-permissions');
      if (await permsFallback.count()) {
        permsText = await permsFallback.first().innerText().catch(() => '');
      }
    }
    if (permsText) {
      perms.copy     = /copy/i.test(permsText)   ? (/no\s*copy/i.test(permsText)     ? 'No' : 'Yes') : '';
      perms.modify   = /modif/i.test(permsText)  ? (/no\s*modif/i.test(permsText)    ? 'No' : 'Yes') : '';
      perms.transfer = /transfer/i.test(permsText) ? (/no\s*transfer/i.test(permsText) ? 'No' : 'Yes') : '';
    }
  }

  // ── Description ────────────────────────────────────────────────────────────
  onStage('description');
  // SLM renders the description in the first .tab-body (Details tab, selected by
  // default). The legacy #product-description selector is kept as a fallback.
  // Each lookup is count-guarded so a missing selector does not burn a full
  // locator timeout before its `.catch()` fires.
  const descLocator = page.locator(
    '.listing__details .tab-body.selected, .listing__details .tab-body:first-child',
  );
  let description = '';
  if (await descLocator.count()) {
    description = (await descLocator.first().innerText().catch(() => '')).trim();
  }
  if (!description) {
    const legacyDesc = page.locator('#product-description, .product-description');
    if (await legacyDesc.count()) {
      description = (await legacyDesc.first().innerText().catch(() => '')).trim();
    }
  }

  // ── Features & contents ────────────────────────────────────────────────────
  onStage('features');
  // SLM tab bodies at fixed indices: [0]=Details, [1]=Features, [2]=Contents.
  const tabBodies = await page.locator('.listing__details .tab-body').all();
  const featuresRaw = (tabBodies[1] ? await tabBodies[1].innerText().catch(() => '') : '').trim();
  const features = featuresRaw
    ? featuresRaw.split(/\n+/).map((s) => s.replace(/^[−•\s-]+/, '').trim()).filter(Boolean)
    : [];

  const contentsRaw = (tabBodies[2] ? await tabBodies[2].innerText().catch(() => '') : '').trim();
  // SL occasionally returns a server-side error string instead of contents.
  const contents =
    !contentsRaw || /could not get listing contents/i.test(contentsRaw)
      ? []
      : contentsRaw.split(/\n+/).map((s) => s.replace(/^[−•\s-]+/, '').trim()).filter(Boolean);

  // ── Last updated ───────────────────────────────────────────────────────────
  onStage('updated');
  // p.update-block is a direct paragraph in the aside.
  let updatedRaw = '';
  const updateLocator = page.locator('p.update-block');
  if (await updateLocator.count()) {
    updatedRaw = (await updateLocator.first().innerText({ timeout: 3000 }).catch(() => '')).trim();
  }
  const updatedOn = updatedRaw.replace(/^Item updated on:\s*/i, '').trim();

  // ── Metadata ───────────────────────────────────────────────────────────────
  onStage('meta');

  // Breadcrumb — skip blank entries and "…" expand buttons.
  const itemCategories = await page.$$eval(
    'nav[aria-label="Breadcrumb"] a',
    (els) => (els as HTMLAnchorElement[]).map((a) => (a.textContent ?? '').trim()).filter((t) => t && t !== '…'),
  );

  // Avatar username of the seller ("Sold by: Cult Ghoul").
  let soldByRaw = '';
  const soldByLocator = page.locator('.section__merchant .body3');
  if (await soldByLocator.count()) {
    soldByRaw = await soldByLocator.first().innerText({ timeout: 3000 }).catch(() => '');
  }
  const soldBy = soldByRaw.match(/Sold by:\s*(.+)/i)?.[1]?.trim() ?? '';

  // Demo listing link.
  const demoLocator = page.locator('a[href*="/p/"][href*="demo" i], a.demo-link');
  const demoHref = (await demoLocator.count())
    ? await demoLocator.first().getAttribute('href').catch(() => null)
    : null;
  const demoUrl = demoHref ? new URL(demoHref, page.url()).toString() : '';

  // In-world SLurl.
  const inWorldLocator = page.locator('a[href*="maps.secondlife.com"]');
  const inWorldHref = (await inWorldLocator.count())
    ? await inWorldLocator.first().getAttribute('href').catch(() => null)
    : null;
  const inWorldUrl = inWorldHref ?? '';

  // Mesh type from the details sidebar.
  let detailsText = '';
  const detailsLocator = page.locator('.section__details');
  if (await detailsLocator.count()) {
    detailsText = await detailsLocator.first().innerText({ timeout: 3000 }).catch(() => '');
  }
  const meshInfo = detailsText.match(/Mesh:\s*(.+)/i)?.[1]?.split('\n')[0].trim() ?? '';

  return {
    url,
    title,
    version,
    images,
    price,
    creator,
    soldBy,
    store,
    permissions: perms,
    description,
    features,
    contents,
    updatedOn,
    meshInfo,
    itemCategories,
    demoUrl,
    inWorldUrl,
  };
}
