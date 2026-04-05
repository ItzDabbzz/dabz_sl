/**
 * @dabzsl/scraper-api — public library surface
 *
 * Import this from the CLI or any other internal consumer to get the
 * core scraping logic without spinning up the HTTP server.
 *
 * @example
 * ```ts
 * import { scrapeUrl, scrapeItem, configurePage } from '@dabzsl/scraper-api';
 *
 * // High-level: manages its own browser lifecycle
 * const item = await scrapeUrl('https://marketplace.secondlife.com/p/…/123');
 *
 * // Low-level: caller owns the Playwright page
 * const item = await scrapeItem(page, url, (stage) => console.log(stage));
 * ```
 */

export type { Item, Permissions, PageOptions, ScrapeOptions } from './types.js';
export { scrapeItem, configurePage } from './scrape-item.js';

import { chromium } from 'playwright';
import { scrapeItem, configurePage } from './scrape-item.js';
import type { Item, ScrapeOptions } from './types.js';

/**
 * Scrape a single SL Marketplace URL, managing the full browser lifecycle.
 *
 * Opens a browser, creates a context (optionally restoring a saved session via
 * `storageStatePath`), runs the scrape, and closes the browser — even on error.
 *
 * @param url  - Full URL of the SL Marketplace product page.
 * @param opts - Optional browser / scrape configuration.
 */
export async function scrapeUrl(url: string, opts: ScrapeOptions = {}): Promise<Item> {
  const {
    headless = true,
    storageStatePath,
    onStage,
    ...pageOpts
  } = opts;

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext(
    storageStatePath ? { storageState: storageStatePath } : {},
  );

  try {
    const page = await context.newPage();
    await configurePage(page, pageOpts);
    const item = await scrapeItem(page, url, onStage);
    await page.close();
    return item;
  } finally {
    await browser.close();
  }
}
