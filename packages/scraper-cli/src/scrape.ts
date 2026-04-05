import { chromium, Page } from "playwright";
import fs from "fs";
import path from "path";
import yargs from "yargs";
import * as XLSX from "xlsx";
import { resolveOut, saveJSON } from "./utils.js";
import { SingleBar, Presets } from "cli-progress";
import kleur from "kleur";
import Table from "cli-table3";
import { configurePage, scrapeItem } from "@dabzsl/scraper-api";
import type { Item } from "@dabzsl/scraper-api";

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
      const m = u.match(/\/p\/([^\/]+)\/(\d+)/i);
      if (m) return slugify(`${m[1]}-${m[2]}`);
      const parts = u.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return slugify(last);
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

function sheetFromItems(items: Item[]) {
  const rows = items.map(it => ({
    Title: it.title,
    Version: it.version || "",
    Images: it.images.join("\n"),
    "Linden Price": it.price,
    "Creator Name": it.creator?.name || "",
    "Creator Link": it.creator?.link || "",
    "Sold By": it.soldBy || "",
    "Store Link": it.store || "",
    Copy: it.permissions.copy,
    Modify: it.permissions.modify,
    Transfer: it.permissions.transfer,
    Mesh: it.meshInfo || "",
    Categories: (it.itemCategories || []).join(" > "),
    Description: it.description,
    Features: (it.features || []).join("\n"),
    Contents: (it.contents || []).join("\n"),
    "Item Updated On": it.updatedOn || "",
    "Demo URL": it.demoUrl || "",
    "In-World URL": it.inWorldUrl || "",
    URL: it.url
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  return ws;
}

/** Short stage labels shown inline in the single-line progress bar. */
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


function buildCatalog(items: CliItem[]) {
  const catalog: Record<string, Record<string, CliItem[]>> = {};
  for (const it of items) {
    const cats = Array.isArray(it.categories) ? it.categories : [];
    for (const c of cats) {
      if (!c || !c.primary) continue;
      const p = c.primary;
      const s = c.sub || "All";
      catalog[p] = catalog[p] || {};
      catalog[p][s] = catalog[p][s] || [];
      catalog[p][s].push(it);
    }
  }
  return catalog;
}

(async function main() {
  const argv = (await yargs(process.argv.slice(2))
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

  const storageFile = path.join(process.cwd(), 'out', 'auth.json');
  const needsAuth = uniqueUrls.some(u => !u.startsWith('file://'));
  if (needsAuth && !fs.existsSync(storageFile)) {
    console.error('Missing session. Run: pnpm install; pnpm run login');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: argv.headless as boolean });
  const context = await browser.newContext(needsAuth ? { storageState: storageFile } : {});

  const pretty = argv.pretty !== false;
  const verbose = argv.verbose as boolean;
  console.log(kleur.cyan().bold('Second Life Marketplace Scraper'));
  console.log(`${kleur.gray('Total')}: ${uniqueUrls.length}  ${kleur.gray('Concurrency')}: ${argv.concurrency}  ${kleur.gray('Headless')}: ${argv.headless ? 'yes' : 'no'}`);
  if (pretty) console.log(kleur.dim('Press Ctrl+C to cancel'));

  try {
    const total = uniqueUrls.length;
    const items: CliItem[] = new Array(total);
    const failures: Array<{ url: string; err: string }> = [];

    const pool = Math.min(Math.max(1, (argv.concurrency as number) || 1), total);
    const activeByWorker: string[] = new Array(pool).fill('');
    const stageByWorker: string[] = new Array(pool).fill('idle');

    /** Build inline worker-stage tokens for the single status line. */
    const computeTokens = () => {
      const segments = activeByWorker
        .map((u, i) => u
          ? `${kleur.cyan(`w${i + 1}`)}:${STAGE_LABEL[stageByWorker[i]!] ?? stageByWorker[i]}`
          : null)
        .filter(Boolean);
      return {
        active: segments.length,
        // Fits on one line — cli-progress can only safely erase a single line.
        status: segments.length ? segments.join(kleur.gray(' | ')) : kleur.dim('idle'),
      };
    };

    const bar = new SingleBar({
      format:
        `${kleur.blue('queue')} [{bar}] {value}/{total}` +
        `  ${kleur.green('✓')}{ok} ${kleur.red('✗')}{fail}` +
        `  {status}`,
      hideCursor: true,
      clearOnComplete: true,
    }, Presets.shades_classic);
    let processed = 0, ok = 0, fail = 0;
    bar.start(total, 0, { ok, fail, ...computeTokens() });

    // Heartbeat: keep the status line ticking even when no events fire so
    // the terminal never looks frozen during slow page loads.
    const heartbeat = setInterval(() => {
      bar.update(processed, { ok, fail, ...computeTokens() });
    }, 250);

    let idx = 0;
    async function worker(wid: number) {
      while (true) {
        const i = idx++;
        if (i >= total) break;
        const url = uniqueUrls[i]!;
        activeByWorker[wid - 1] = url;
        stageByWorker[wid - 1] = 'init';
        bar.update(processed, { ok, fail, ...computeTokens() });
        if (!pretty || verbose) console.log(kleur.gray(`[w${wid}] ▶ ${url}`));
        let page: Page | undefined;
        try {
          page = await context.newPage();
          await configurePage(page, { timeout: argv.timeout, navTimeout: argv['nav-timeout'], blockAssets: argv['block-assets'] });
          const onStage = (stage: string) => {
            stageByWorker[wid - 1] = stage;
            bar.update(processed, { ok, fail, ...computeTokens() });
            if (verbose) console.log(kleur.dim(`  [w${wid}] ${stage}`));
          };
          const item = await scrapeItem(page, url, onStage);
          (item as CliItem).categories = urlToCats.get(url) || [];
          items[i] = item as CliItem;
          stageByWorker[wid - 1] = 'done';
          ok++; processed++;
          activeByWorker[wid - 1] = '';
          stageByWorker[wid - 1] = 'idle';
          bar.update(processed, { ok, fail, ...computeTokens() });
          if (!pretty || verbose) console.log(kleur.green(`[w${wid}] ✓ ${item.title || url}`));
        } catch (e: unknown) {
          stageByWorker[wid - 1] = 'error';
          const emsg = e instanceof Error ? e.message : String(e);
          failures.push({ url, err: emsg });
          fail++; processed++;
          activeByWorker[wid - 1] = '';
          stageByWorker[wid - 1] = 'idle';
          bar.update(processed, { ok, fail, ...computeTokens() });
          if (!pretty || verbose) console.log(kleur.red(`[w${wid}] ✗ ${url} — ${emsg}`));
        } finally {
          try { if (page) await page.close(); } catch { }
        }
      }
    }

    const workers = Array.from({ length: pool }, (_, id) => worker(id + 1));
    await Promise.all(workers);
    clearInterval(heartbeat);
    bar.stop();

    const baseName = deriveBaseName(uniqueUrls, argv);

    const jsonPath = resolveOut(argv.json ? argv.json : path.join(argv['json-dir'] || 'out', `${baseName}.json`));
    const cleanItems = items.filter(Boolean) as CliItem[];
    saveJSON(jsonPath, cleanItems);
    console.log(kleur.green(`✔ Saved JSON => ${jsonPath}`));

    const shouldWriteCatalog = (argv['write-catalog'] !== undefined) ? (argv['write-catalog'] as boolean) : Array.from(urlToCats.values()).some(v => v && v.length);
    if (shouldWriteCatalog) {
      const catalog = buildCatalog(cleanItems);
      const catalogPath = resolveOut(path.join(argv['json-dir'] || 'out', `${baseName}.catalog.json`));
      saveJSON(catalogPath, catalog);
      console.log(kleur.green(`✔ Saved Catalog => ${catalogPath}`));
    }

    let xlsxPath: string | undefined;
    if (argv['xlsx-out']) xlsxPath = resolveOut(argv['xlsx-out']);
    else if (argv.out) xlsxPath = resolveOut(argv.out);
    else if (argv.xlsx) xlsxPath = resolveOut(path.join(argv['xlsx-dir'] || argv['json-dir'] || 'out', `${baseName}.xlsx`));

    if (xlsxPath) {
      const wb = XLSX.utils.book_new();
      const ws = sheetFromItems(cleanItems);
      XLSX.utils.book_append_sheet(wb, ws, 'Items');
      XLSX.writeFile(wb, xlsxPath);
      console.log(kleur.green(`✔ Saved Excel => ${xlsxPath}`));
    }

    console.log(kleur.bold().green(`Done: ${ok} ok, ${fail} failed.`));

    const previewN = Math.max(0, (argv.preview as number) || 0);
    if (pretty && cleanItems.length && previewN) {
      const sample = cleanItems.slice(0, previewN);
      const trunc = (s: string, n: number) => (s || '').length > n ? (s || '').slice(0, n - 1) + '…' : (s || '');
      const table = new Table({
        head: [kleur.bold('Title'), 'Price', 'Copy', 'Mod', 'Trans', 'Creator'],
        wordWrap: true,
        colWidths: [34, 8, 6, 6, 7, 22]
      });
      sample.forEach(it => {
        table.push([
          trunc(it.title, 34),
          String(it.price || ''),
          it.permissions?.copy || '',
          it.permissions?.modify || '',
          it.permissions?.transfer || '',
          trunc(it.creator?.name || '', 22)
        ]);
      });
      console.log(table.toString());
      if (cleanItems.length > sample.length) {
        console.log(kleur.gray(`(+${cleanItems.length - sample.length} more)`));
      }
    }

    if (failures.length) {
      console.log(kleur.red().bold(`Failures (${failures.length}):`));
      failures.slice(0, 20).forEach(f => console.log(kleur.red(` - ${f.url} — ${f.err}`)));
      if (failures.length > 20) console.log(kleur.gray(`(+${failures.length - 20} more)`));
    }

    if (!pretty || !cleanItems.length || !previewN) {
      console.log(kleur.gray(`JSON: ${jsonPath}`));
    }
  } finally {
    const fast = argv['fast-exit'] as boolean;
    try {
      // Closing is no-op if already closed
    } finally {
      if (fast) setTimeout(() => process.exit(0), 20);
    }
  }
})();
