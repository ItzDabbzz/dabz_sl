/**
 * Ad-hoc probe: dump the raw store-listing card data for a store.
 *
 * Useful when the marketplace changes its DOM — it prints exactly what the
 * scraper sees, so you can tell which selector broke.
 *
 * Usage:
 *   pnpm --filter @dabzsl/scraper-api exec tsx ../../scripts/probe-store.mts 199625
 */

import { chromium } from "playwright";

const storeId = process.argv[2] ?? "199625";
const perPage = process.argv[3] ?? "96";

const url =
  `https://marketplace.secondlife.com/stores/${storeId}` +
  `?search%5Bsort%5D=released_at_desc&search%5Bper_page%5D=${perPage}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const cards = [...document.querySelectorAll<HTMLElement>('.gallery-item[id^="product-"]')];
  const match = document.body.innerText.match(/([\d,]+)\s+matching items found/);
  return {
    totalItems: match?.[1] ?? null,
    renderedCards: cards.length,
    pagination: [...document.querySelectorAll(".pagy-nav a")]
      .map((a) => a.getAttribute("href"))
      .filter((h): h is string => !!h && /page=/.test(h))
      .slice(-3),
    sample: cards.slice(0, 3).map((el) => ({
      productId: el.id.replace(/^product-/, ""),
      href: el.querySelector<HTMLAnchorElement>("a.product-image")?.getAttribute("href") ?? null,
      title: el.querySelector<HTMLElement>("a.subtitle1")?.textContent?.trim() ?? null,
      price: el.querySelector<HTMLElement>(".title4")?.textContent?.trim() ?? null,
      brand: el.querySelector<HTMLElement>(".store-item")?.textContent?.trim() ?? null,
      imageSrc: el.querySelector<HTMLImageElement>("a.product-image img")?.getAttribute("src") ?? null,
      hasEmbeddedData: /product_dl_data_\d+/.test(el.innerHTML),
    })),
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
