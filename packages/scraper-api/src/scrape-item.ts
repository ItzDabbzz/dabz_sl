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
      const vtext = (await page.locator('h1.title2 .version').first().innerText().catch(() => '')).trim();
      if (vtext) version = vtext.replace(/^Version\s*/i, '').trim();
    }
  } catch { /* leave empty */ }

  if (!title) {
    title = (
      await page.locator('h1[itemprop="name"], h1.product-title, h1').first().textContent().catch(() => '') ?? ''
    ).trim();
  }
  if (!version) {
    const versionText = await page.locator('text=/Version:\\s*/i').first().textContent().catch(() => '');
    if (versionText) {
      version = versionText.match(/Version:\s*(.*)/i)?.[1]?.trim() ?? '';
    } else {
      const detailsText = await page.locator('.product-details, .details, table').first().innerText().catch(() => '');
      const m = detailsText.match(/Version\s*:?\s*(.+)/i);
      if (m) version = m[1].split('\n')[0].trim();
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
  const priceRaw = (
    await page.locator('.prices .price-ld, .linden-price, [itemprop="price"], .price').first().innerText().catch(() => '')
  ).trim();
  if (priceRaw) {
    const m = priceRaw.match(/([\d,]+)/);
    if (m) price = m[1].replace(/,/g, '');
  }

  // ── Creator / store ────────────────────────────────────────────────────────
  onStage('creator');
  let creator: Item['creator'] = { name: '', link: '' };
  let store = '';
  try {
    const storeName = (await page.locator('#merchant-box .store-name').first().innerText().catch(() => '')).trim();
    const storeHref = await page.locator('#merchant-box a[href*="/stores/"]').first().getAttribute('href').catch(() => null);
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
    const permsText = await page
      .locator('text=Permissions, .permissions, .product-permissions').first().locator('..').innerText()
      .catch(async () => page.locator('.permissions, .product-permissions').first().innerText().catch(() => ''));
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
  const description =
    (await page.locator('.listing__details .tab-body.selected, .listing__details .tab-body:first-child').first().innerText().catch(() => '')).trim() ||
    (await page.locator('#product-description, .product-description').first().innerText().catch(() => '')).trim();

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
  const updatedRaw = (await page.locator('p.update-block').first().innerText({ timeout: 3000 }).catch(() => '')).trim();
  const updatedOn = updatedRaw.replace(/^Item updated on:\s*/i, '').trim();

  // ── Metadata ───────────────────────────────────────────────────────────────
  onStage('meta');

  // Breadcrumb — skip blank entries and "…" expand buttons.
  const itemCategories = await page.$$eval(
    'nav[aria-label="Breadcrumb"] a',
    (els) => (els as HTMLAnchorElement[]).map((a) => (a.textContent ?? '').trim()).filter((t) => t && t !== '…'),
  );

  // Avatar username of the seller ("Sold by: Cult Ghoul").
  const soldByRaw = await page.locator('.section__merchant .body3').innerText({ timeout: 3000 }).catch(() => '');
  const soldBy = soldByRaw.match(/Sold by:\s*(.+)/i)?.[1]?.trim() ?? '';

  // Demo listing link.
  const demoHref = await page
    .locator('a[href*="/p/"][href*="demo" i], a.demo-link')
    .first().getAttribute('href').catch(() => null);
  const demoUrl = demoHref ? new URL(demoHref, page.url()).toString() : '';

  // In-world SLurl.
  const inWorldHref = await page
    .locator('a[href*="maps.secondlife.com"]')
    .first().getAttribute('href').catch(() => null);
  const inWorldUrl = inWorldHref ?? '';

  // Mesh type from the details sidebar.
  const detailsText = await page.locator('.section__details').innerText({ timeout: 3000 }).catch(() => '');
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
