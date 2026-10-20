import { chromium, Page, type Browser } from "playwright";
import fs from "fs";
import path from "path";
import yargs from "yargs";
import { resolveOut } from "./utils.js";
import kleur from "kleur";
import { configurePage, scrapeItem } from "@dabzsl/scraper-api";
import type { Item } from "@dabzsl/scraper-api";
import {
  ScrapeUi,
  buildCatalog,
  printPreview,
  printFailures,
  saveOutputs,
  type CommonOptions,
} from "./cli.js";
import { runStoreScrape } from "./run-store.js";

/** Parsed CLI arguments for the scraper. */
interface CliArgs {
  input?: string[];
  url?: string[];
  file?: string;
  out?: string;
  json?: string;
  "json-dir": string;
  xlsx: boolean;
  "xlsx-out"?: string;
  "xlsx-dir"?: string;
  name?: string;
  headless: boolean;
  "fast-exit": boolean;
  "block-assets": boolean;
  timeout: number;
  "nav-timeout": number;
  concurrency: number;
  pretty: boolean;
  verbose: boolean;
  preview: number;
  primary?: string;
  sub?: string[];
  "write-catalog"?: boolean;
  "store-delay": number;
  "store-concurrency": number;
  "store-max-pages"?: number;
  "store-resume"?: boolean;
}

function slugify(s: string): string {
  return String(s)
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();
}

/**
 * Derive a filesystem-safe base name for output files.
 *
 * Priority: explicit `--name` flag → single-URL slug → timestamp fallback.
 */
function deriveBaseName(urls: string[], argv: Pick<CliArgs, "name">): string {
  if (argv.name) return slugify(argv.name);
  if (urls.length === 1) {
    const u = urls[0];
    try {
      if (u.startsWith("file://")) {
        const p = new URL(u);
        const bn = path.basename(p.pathname);
        return slugify(bn.replace(/\.[^.]+$/, ""));
      }
      // A store URL carries a long filter query string; name the file after
      // the store id, not the query.
      const store = u.match(/\/stores\/(\d+)/i);
      if (store) return `store-${store[1]}`;
      const m = u.match(/\/p\/([^\/]+)\/(\d+)/i);
      if (m) return slugify(`${m[1]}-${m[2]}`);
      const parts = u.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return slugify(last.split("?")[0]!);
    } catch { }
  }
  const ts = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  return `items-${stamp}`;
}

function readLines(file: string): string[] {
  return fs.readFileSync(file, "utf8").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

/** CLI-only extension: category grouping added post-scrape from --sub flags. */
type CliItem = Item & { categories?: Array<{ primary: string; sub: string }> };

/** Short stage labels shown inline in the progress display. */
const STAGE_LABEL: Record<string, string> = {
  idle:        kleur.dim('idle'),
  init:        kleur.dim('init'),
  navigating:  kleur.yellow('nav'),
  title:       kleur.yellow('title'),
  images:      kleur.yellow('imgs'),
  price:       kleur.yellow('price'),
  creator:     kleur.yellow('creator'),
  permissions: kleur.yellow('perms'),
  description: kleur.yellow('desc'),
  features:    kleur.yellow('feats'),
  updated:     kleur.yellow('upd'),
  meta:        kleur.yellow('meta'),
  done:        kleur.green('done'),
  error:       kleur.red('err'),
};


(async function main() {
  // `pnpm run scrape -- --url ...` forwards the `--` separator as a literal argv
  // entry. yargs treats `--` as "end of options", so everything after it would
  // be parsed as a positional and every flag would be ignored. Strip it.
  const rawArgs = process.argv.slice(2);
  const argv0 = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

  const argv = (await yargs(argv0)
    .option("input", { type: "array", alias: "i", describe: "One or more text files with URLs (one per line). Repeat --input to add multiple files." })
    .option("url", { type: "array", alias: "u", describe: "One or more product URLs to scrape. Repeat --url to add multiple." })
    .option("file", { type: "string", describe: "Local HTML file to scrape (file path)" })
    .option("out", { type: "string", describe: "Deprecated: XLSX output path (use --xlsx or --xlsx-out instead)" })
    .option("json", { type: "string", describe: "Optional: JSON output file path (overrides auto name)" })
    .option("json-dir", { type: "string", default: "out", describe: "Directory to save JSON (used when --json not provided)" })
    .option("xlsx", { type: "boolean", default: false, describe: "Also write an XLSX file (auto-named if no path provided)" })
    .option("xlsx-out", { type: "string", describe: "XLSX output file path" })
    .option("xlsx-dir", { type: "string", describe: "Directory to save XLSX (used with --xlsx when no path provided)" })
    .option("name", { type: "string", describe: "Base filename (without extension) for auto-named outputs" })
    .option("headless", { type: "boolean", default: true, describe: "Run Chromium in headless mode" })
    .option("fast-exit", { type: "boolean", default: true, describe: "Exit process immediately after scheduling close (faster shutdown)" })
    .option("block-assets", { type: "boolean", default: true, describe: "Block non-HTML/XHR assets (images, fonts, media, css) to speed up loads" })
    .option("timeout", { type: "number", default: 4000, describe: "Default locator timeout (ms)" })
    .option("nav-timeout", { type: "number", default: 10000, describe: "Default navigation timeout (ms)" })
    .option("concurrency", { type: "number", default: 3, alias: "c", describe: "Number of pages to scrape in parallel" })
    .option("pretty", { type: "boolean", default: true, describe: "Pretty, user-friendly output (colors, progress). Disable for plain logs." })
    .option("verbose", { type: "boolean", default: false, describe: "More detailed logs per URL" })
    .option("preview", { type: "number", default: 10, describe: "Show a table preview of the first N results at the end" })
    .option("primary", { type: "string", describe: "Primary category name for grouped scrape (e.g., 'Project Arousal 2')" })
    .option("sub", { type: "array", describe: "Subcategory spec, repeatable. Format: 'Name=path/to/urls.txt'" })
    .option("write-catalog", { type: "boolean", default: undefined, describe: "Also write a grouped catalog JSON (auto when --sub is used)" })
    .option("store-delay", { type: "number", default: 1000, describe: "Minimum milliseconds between any two requests while scraping a store" })
    .option("store-concurrency", { type: "number", default: 2, describe: "Product pages fetched in parallel while scraping a store" })
    .option("store-max-pages", { type: "number", describe: "Maximum listing pages to enumerate when scraping a store (default: all)" })
    .option("store-resume", { type: "boolean", default: false, describe: "Resume an interrupted store scrape instead of starting over" })
    .help().parseAsync()) as CliArgs;


  const urlToCats = new Map<string, Array<{ primary: string; sub: string }>>();
  const pushCat = (url: string, primary: string, sub: string) => {
    const key = String(url).trim();
    if (!key) return;
    const arr = urlToCats.get(key) || [];
    arr.push({ primary, sub });
    urlToCats.set(key, arr);
  };

  const plainUrls: string[] = [];

  if (argv.sub && argv.sub.length) {
    const primary = argv.primary || "Catalog";
    const specs = Array.isArray(argv.sub) ? argv.sub : [argv.sub];
    for (const spec of specs) {
      const m = String(spec).split("=");
      if (m.length < 2) { console.error(kleur.yellow(`Invalid --sub spec: ${spec}. Use "Name=path.txt"`)); continue; }
      const subName = m[0].trim();
      const filePath = m.slice(1).join("=").trim();
      const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      try {
        const lines = readLines(abs);
        for (const u of lines) pushCat(u, primary, subName);
      } catch (e: unknown) {
        console.error(kleur.yellow(`Failed to read sub list ${filePath}: ${e instanceof Error ? e.message : String(e)}`));
      }
    }
  }

  if (argv.input) {
    const inputs = Array.isArray(argv.input) ? argv.input : [argv.input];
    for (const inp of inputs) {
      try { plainUrls.push(...readLines(inp)); }
      catch (e: unknown) { console.error(kleur.yellow(`Warning: failed to read ${inp}: ${e instanceof Error ? e.message : String(e)}`)); }
    }
  }
  if (argv.url) {
    const urlArgs = Array.isArray(argv.url) ? argv.url : [argv.url];
    plainUrls.push(...urlArgs);
  }
  if (argv.file) {
    const absPath = path.isAbsolute(argv.file) ? argv.file : path.join(process.cwd(), argv.file);
    const fileUrl = 'file:///' + absPath.replace(/\\/g, '/');
    plainUrls.push(fileUrl);
  }

  for (const u of plainUrls) {
    if (!urlToCats.has(u)) urlToCats.set(u, []);
  }

  const uniqueUrls = Array.from(urlToCats.keys());

  if (!uniqueUrls.length) {
    console.error('Provide --url or --input or --file or --sub');
    process.exit(1);
  }

  // A store URL is a listing page, not a product page. Scraping it as a single
  // product would parse the grid into one bogus item ("N matching items
  // found."), so stores are split out and handed to the store scraper. Both
  // kinds can be passed in the same run.
  const isStoreUrl = (u: string) => /\/stores\/\d+/.test(u);
  const storeUrls = uniqueUrls.filter(isStoreUrl);
  const productUrls = uniqueUrls.filter((u) => !isStoreUrl(u));

  const storageFile = path.join(process.cwd(), 'out', 'auth.json');
  const needsAuth = uniqueUrls.some(u => !u.startsWith('file://'));
  if (needsAuth && !fs.existsSync(storageFile)) {
    console.error('Missing session. Run: pnpm install; pnpm run login');
    process.exit(1);
  }

  const pretty = argv.pretty !== false;
  const verbose = argv.verbose as boolean;
  console.log(kleur.cyan().bold('Second Life Marketplace Scraper'));
  if (storeUrls.length) {
    console.log(
      `${kleur.gray('Stores')}: ${kleur.bold(String(storeUrls.length))}  ` +
        `${kleur.gray('Store delay')}: ${argv['store-delay']}ms  ` +
        `${kleur.gray('Store concurrency')}: ${argv['store-concurrency']}`,
    );
  }
  if (productUrls.length) {
    console.log(
      `${kleur.gray('Total')}: ${productUrls.length}  ${kleur.gray('Concurrency')}: ${argv.concurrency}  ` +
        `${kleur.gray('Headless')}: ${argv.headless ? 'yes' : 'no'}`,
    );
  }
  if (pretty) console.log(kleur.dim('Press Ctrl+C to cancel'));

  let browser: Browser | undefined;
  try {
    // ── Store URLs ────────────────────────────────────────────────────────
    // Delegated to the shared store runner, so a store started from `scrape`
    // behaves exactly like one started from `scrape-store` — same live
    // display, same output files, same checkpointing.
    const storeItems: CliItem[] = [];
    const storeFailures: Array<{ url: string; err: string }> = [];
    for (const storeUrl of storeUrls) {
      const storeId = (storeUrl.match(/\/stores\/(\d+)/) ?? [])[1] ?? storeUrl;
      const result = await runStoreScrape({
        // Pass the full URL, not just the id: the marketplace's own filters
        // (page size, sort order, price bounds) ride along in the query
        // string, and dropping them would change what gets scraped.
        store: storeUrl,
        categories: urlToCats.get(storeUrl) || [],
        "max-pages": argv["store-max-pages"],
        "listing-only": false,
        "store-delay": argv["store-delay"] as number,
        "store-concurrency": argv["store-concurrency"] as number,
        resume: (argv["store-resume"] as boolean) === true,
        out: "",
        "json-dir": argv["json-dir"],
        json: undefined,
        xlsx: false,
        name: `store-${storeId}`,
        headless: argv.headless as boolean,
        timeout: argv.timeout as number,
        "nav-timeout": argv["nav-timeout"] as number,
        "block-assets": argv["block-assets"] as boolean,
        concurrency: argv.concurrency as number,
        pretty: argv.pretty as boolean,
        verbose: argv.verbose as boolean,
        preview: 0,
        writeListing: false,
        // The unified command writes one combined file itself.
        saveFiles: false,
      });
      storeItems.push(...result.items);
      storeFailures.push(...result.failures);
    }

    // ── Product URLs ──────────────────────────────────────────────────────
    const total = productUrls.length;
    const items: CliItem[] = new Array(total);
    const failures: Array<{ url: string; err: string }> = [...storeFailures];

    // When every URL was a store there are no product pages to visit, so
    // skip launching a browser and the progress display entirely.
    if (!total) {
      const jsonPath = resolveOut(
        argv.json ? argv.json : path.join(argv['json-dir'] || 'out', `${deriveBaseName(uniqueUrls, argv)}.json`),
      );
      const cleanItems = [...storeItems];
      saveOutputs({
        items: cleanItems,
        paths: { json: jsonPath, items: '', checkpoint: '' },
        common: argv as CommonOptions,
        writeCatalog: false,
      });
      console.log(
        kleur.bold().green(
          `Done: ${cleanItems.length} ok, ${failures.length} failed.` +
            (cleanItems.length ? kleur.gray(` (${cleanItems.length} from stores)`) : ''),
        ),
      );
      printFailures(failures);
      if (!pretty || !cleanItems.length) console.log(kleur.gray(`JSON: ${jsonPath}`));
      return;
    }

    browser = await chromium.launch({ headless: argv.headless as boolean });
    const context = await browser.newContext(needsAuth ? { storageState: storageFile } : {});
    const pool = Math.min(Math.max(1, (argv.concurrency as number) || 1), total);

    // Shared live display: same block, same rate/ETA, same worker stages as
    // the store path.
    const ui = new ScrapeUi({ pretty, verbose }, STAGE_LABEL);
    ui.setTotal(total);
    ui.start();

    let idx = 0;
    async function worker(wid: number) {
      while (true) {
        const i = idx++;
        if (i >= total) break;
        const url = productUrls[i]!;
        ui.setWorker(wid - 1, url, 'init');
        if (!pretty || verbose) console.log(kleur.gray(`[w${wid}] ▶ ${url}`));
        let page: Page | undefined;
        try {
          page = await context.newPage();
          await configurePage(page, { timeout: argv.timeout, navTimeout: argv['nav-timeout'], blockAssets: argv['block-assets'] });
          const onStage = (stage: string) => {
            ui.setWorker(wid - 1, url, stage);
            if (verbose) console.log(kleur.dim(`  [w${wid}] ${stage}`));
          };
          const item = await scrapeItem(page, url, onStage);
          (item as CliItem).categories = urlToCats.get(url) || [];
          items[i] = item as CliItem;
          ui.clearWorker(wid - 1);
          ui.itemDone();
          if (!pretty || verbose) console.log(kleur.green(`[w${wid}] ✓ ${item.title || url}`));
        } catch (e: unknown) {
          const emsg = e instanceof Error ? e.message : String(e);
          failures.push({ url, err: emsg });
          ui.clearWorker(wid - 1);
          ui.itemFailed();
          if (!pretty || verbose) console.log(kleur.red(`[w${wid}] ✗ ${url} — ${emsg}`));
        } finally {
          try { if (page) await page.close(); } catch { }
        }
      }
    }

    const workers = Array.from({ length: pool }, (_, id) => worker(id + 1));
    await Promise.all(workers);
    ui.stop();

    const baseName = deriveBaseName(uniqueUrls, argv);

    const jsonPath = resolveOut(argv.json ? argv.json : path.join(argv['json-dir'] || 'out', `${baseName}.json`));
    // Store items come first so the store's products lead the output.
    const cleanItems = [...storeItems, ...(items.filter(Boolean) as CliItem[])];

    const shouldWriteCatalog = (argv['write-catalog'] !== undefined) ? (argv['write-catalog'] as boolean) : Array.from(urlToCats.values()).some(v => v && v.length);
    saveOutputs({
      items: cleanItems,
      paths: { json: jsonPath, items: '', checkpoint: '' },
      common: argv as CommonOptions,
      writeCatalog: shouldWriteCatalog,
    });

    const { ok, fail } = ui.counts;
    console.log(
      kleur.bold().green(
        `Done: ${ok + storeItems.length} ok, ${fail} failed.` +
          (storeItems.length ? kleur.gray(` (${storeItems.length} from stores)`) : ''),
      ),
    );

    const previewN = Math.max(0, (argv.preview as number) || 0);
    if (pretty && cleanItems.length && previewN) {
      printPreview(cleanItems, previewN);
    }

    printFailures(failures);

    if (!pretty || !cleanItems.length || !previewN) {
      console.log(kleur.gray(`JSON: ${jsonPath}`));
    }
  } finally {
    const fast = argv['fast-exit'] as boolean;
    try {
      // Close the browser so the process can exit cleanly.
      if (browser) await browser.close().catch(() => {});
    } finally {
      if (fast) setTimeout(() => process.exit(0), 20);
    }
  }
})();
