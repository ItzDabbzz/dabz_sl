/**
 * Shared CLI plumbing for the scraper.
 *
 * Both the single-product path and the store path go through this module:
 * the same option set, the same live display, the same output writers, the
 * same session handling. Nothing is duplicated between `scrape` and
 * `scrape-store` — they are two front ends over one implementation.
 */

import fs from "fs";
import path from "path";
import kleur from "kleur";
import Table from "cli-table3";
import type { Item } from "@dabzsl/scraper-api";
import { LiveDisplay, formatCount, formatDuration, RateTracker, type LiveRow } from "./ui.js";
import { resolveOut, saveJSON } from "./utils.js";

/** A scraped item plus any CLI-assigned category grouping. */
export type CliItem = Item & { categories?: Array<{ primary: string; sub: string }> };

/** Options shared by every front end. */
export interface CommonOptions {
  out: string;
  "json-dir": string;
  json?: string;
  xlsx: boolean;
  "xlsx-out"?: string;
  "xlsx-dir"?: string;
  name?: string;
  headless: boolean;
  timeout: number;
  "nav-timeout": number;
  "block-assets": boolean;
  concurrency: number;
  pretty: boolean;
  verbose: boolean;
  preview: number;
}

/** Options for store runs. */
export interface StoreOptions {
  "max-pages"?: number;
  "listing-only": boolean;
  "store-delay": number;
  "store-concurrency": number;
  resume: boolean;
}

/** Where a run's output goes. */
export interface OutputPaths {
  /** Primary JSON file holding the full scraped items. */
  json: string;
  /** JSONL holding items as they are scraped — the final output. */
  items: string;
  /** Checkpoint holding all persistence state — listing, completed, failed. */
  checkpoint: string;
}

/** Print the run header. */
export function printHeader(opts: {
  title: string;
  rows: Array<[string, string]>;
  sessionFound: boolean;
  pretty: boolean;
}): void {
  console.log(kleur.cyan().bold(opts.title));
  for (const [label, value] of opts.rows) {
    console.log(`  ${kleur.gray(label)}: ${value}`);
  }
  console.log(
    opts.sessionFound
      ? `  ${kleur.gray("session")}: ${kleur.green("auth.json")}`
      : `  ${kleur.gray("session")}: ${kleur.yellow("none — run `pnpm --filter @dabzsl/scraper-cli login`")}`,
  );
  if (opts.pretty) console.log(kleur.dim("  Press Ctrl+C to cancel"));
}

/** Resolve the saved marketplace session, if one exists. */
export function resolveSession(): { path: string | undefined; found: boolean } {
  const storageFile = path.join(process.cwd(), "out", "auth.json");
  const found = fs.existsSync(storageFile);
  return { path: found ? storageFile : undefined, found };
}

/**
 * Build the output file paths for a run.
 *
 * Two files, and only two:
 *
 *   `<name>.items.jsonl`      the final output — one scraped item per line
 *   `<name>.checkpoint.jsonl`  all persistence — listing, completed table,
 *                              failures, and the item in flight
 *
 * The checkpoint is the single source of truth for progress. The items file
 * is the deliverable. Nothing else is written, and nothing else is needed to
 * resume.
 */
export function outputPaths(baseName: string, opts: CommonOptions): OutputPaths {
  const dir = opts["json-dir"] || "out";
  return {
    json: resolveOut(opts.json || path.join(dir, `${baseName}.json`)),
    items: resolveOut(path.join(dir, `${baseName}.items.jsonl`)),
    checkpoint: resolveOut(path.join(dir, `${baseName}.checkpoint.jsonl`)),
  };
}

/** Remove the files a fresh (non-resumed) run should start without. */
export function resetOutputs(paths: OutputPaths, keep: { items?: boolean } = {}): void {
  const files = [paths.checkpoint];
  if (!keep.items) files.push(paths.items);
  for (const f of files) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
      } catch {
        /* best effort */
      }
    }
  }
}

/** Append one item to the JSONL, so an interrupted run keeps its data. */
export function appendItem(itemsPath: string, item: Item): void {
  try {
    fs.appendFileSync(itemsPath, JSON.stringify(item) + "\n", "utf8");
  } catch {
    /* best effort */
  }
}

/** Read every item from a JSONL, de-duplicated by URL. */
export function readItems(itemsPath: string): Item[] {
  const out: Item[] = [];
  const seen = new Set<string>();
  if (!fs.existsSync(itemsPath)) return out;
  for (const line of fs.readFileSync(itemsPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const item = JSON.parse(trimmed) as Item;
      if (item.url && seen.has(item.url)) continue;
      if (item.url) seen.add(item.url);
      out.push(item);
    } catch {
      /* skip a partially written line */
    }
  }
  return out;
}

/** Rows for the XLSX export. */
export function sheetFromItems(items: Item[]) {
  return items.map((it) => ({
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
    URL: it.url,
  }));
}

/** Save the optional aggregate JSON, catalog and XLSX outputs. */
export function saveOutputs(opts: {
  items: CliItem[];
  paths: OutputPaths;
  common: CommonOptions;
  writeCatalog: boolean;
  /**
   * Write the aggregate `.json` array.
   *
   * Off by default for a store run: the `.items.jsonl` file is already the
   * final output, and the checkpoint is the persistence. The aggregate is
   * only written when explicitly asked for, or when the run merges several
   * sources and needs one combined file.
   */
  writeJson?: boolean;
}): void {
  const { items, paths, common } = opts;

  if (opts.writeJson !== false) {
    saveJSON(paths.json, items);
    console.log(kleur.green(`✔ Saved JSON => ${paths.json}`));
  }

  if (opts.writeCatalog) {
    const catalog = buildCatalog(items);
    const catalogPath = resolveOut(
      path.join(common["json-dir"] || "out", `${baseNameFrom(paths.json)}.catalog.json`),
    );
    saveJSON(catalogPath, catalog);
    console.log(kleur.green(`✔ Saved Catalog => ${catalogPath}`));
  }

  const xlsxPath = common["xlsx-out"]
    ? resolveOut(common["xlsx-out"])
    : common["xlsx"]
      ? resolveOut(path.join(common["xlsx-dir"] || common["json-dir"] || "out", `${baseNameFrom(paths.json)}.xlsx`))
      : undefined;

  if (xlsxPath) {
    // xlsx is loaded lazily: it is a heavy dependency and most runs skip it.
    import("xlsx")
      .then((XLSX) => {
        const ws = XLSX.utils.json_to_sheet(sheetFromItems(items));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Items");
        XLSX.writeFile(wb, xlsxPath);
        console.log(kleur.green(`✔ Saved Excel => ${xlsxPath}`));
      })
      .catch(() => {
        console.log(kleur.red("✗ Could not write XLSX (xlsx module failed to load)"));
      });
  }
}

/** Derive a base name from a saved JSON path. */
export function baseNameFrom(jsonPath: string): string {
  return path.basename(jsonPath).replace(/\.json$/, "");
}

/** Group items by their CLI-assigned categories. */
export function buildCatalog(items: CliItem[]) {
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

/** Print the preview table of scraped items. */
export function printPreview(items: Item[], count: number): void {
  if (!items.length || !count) return;
  const sample = items.slice(0, count);
  const trunc = (s: string, n: number) =>
    (s || "").length > n ? (s || "").slice(0, n - 1) + "…" : s || "";
  const table = new Table({
    head: [kleur.bold("Title"), "Price", "Copy", "Mod", "Trans", "Creator"],
    wordWrap: true,
    colWidths: [34, 8, 6, 6, 7, 22],
  });
  sample.forEach((it) => {
    table.push([
      trunc(it.title, 34),
      String(it.price || ""),
      it.permissions?.copy || "",
      it.permissions?.modify || "",
      it.permissions?.transfer || "",
      trunc(it.creator?.name || "", 22),
    ]);
  });
  console.log(table.toString());
  if (items.length > sample.length) {
    console.log(kleur.gray(`(+${formatCount(items.length - sample.length)} more)`));
  }
}

/** Print the failure list. */
export function printFailures(failures: Array<{ url: string; err: string }>): void {
  if (!failures.length) return;
  console.log(kleur.red().bold(`Failures (${failures.length}):`));
  failures.slice(0, 20).forEach((f) =>
    console.log(kleur.red(` - ${f.url} — ${f.err.slice(0, 120)}`)),
  );
  if (failures.length > 20) {
    console.log(kleur.gray(`(+${formatCount(failures.length - 20)} more)`));
  }
}

/**
 * The live block, shared by every run.
 *
 * Two rows: a progress row and a status row. The status row carries the
 * per-worker stages so you can see what each browser is doing right now.
 */
export class ScrapeUi {
  readonly display: LiveDisplay;
  readonly rate = new RateTracker();
  private stageLabels: Record<string, string> = {};
  private workers: Array<{ url: string; stage: string }> = [];
  private ok = 0;
  private fail = 0;
  private total = 0;
  private started = Date.now();

  constructor(
    private readonly opts: { pretty: boolean; verbose: boolean },
    stageLabels?: Record<string, string>,
  ) {
    this.display = new LiveDisplay({ disabled: !opts.pretty });
    this.stageLabels = stageLabels ?? {};
  }

  /** Start the display. */
  start(): void {
    this.display.start();
  }

  /** Set the total number of items expected. */
  setTotal(total: number): void {
    this.total = total;
  }

  /** Record a successful item. */
  itemDone(): void {
    this.ok++;
    this.rate.mark(this.ok);
    this.render();
  }

  /** Record a failed item. */
  itemFailed(): void {
    this.fail++;
    this.render();
  }

  /** Set what a worker is currently doing. */
  setWorker(index: number, url: string, stage: string): void {
    this.workers[index] = { url, stage };
    this.render();
  }

  /** Clear a worker's slot. */
  clearWorker(index: number): void {
    this.workers[index] = undefined as unknown as { url: string; stage: string };
    this.render();
  }

  /** Replace the worker stage labels. */
  setStageLabels(labels: Record<string, string>): void {
    this.stageLabels = labels;
  }

  /** Show a custom block of rows (used for the enumeration phase). */
  showRows(rows: LiveRow[]): void {
    this.display.update(rows);
  }

  /** Render the standard progress block. */
  render(): void {
    if (!this.opts.pretty) return;
    const done = this.ok + this.fail;
    const progress = this.total > 0 ? done / this.total : 0;

    const active = this.workers
      .filter(Boolean)
      .map((w, i) => {
        const label = this.stageLabels[w.stage] ?? w.stage;
        return kleur.dim(`w${i + 1}:${label}`);
      });

    const rate = this.rate.rate;
    const eta = this.rate.eta(Math.max(0, this.total - done));
    const hints: string[] = [];
    if (rate > 0) hints.push(`${rate.toFixed(1)}/s`);
    if (eta !== null) hints.push(`ETA ${formatDuration(eta)}`);
    hints.push(`elapsed ${formatDuration((Date.now() - this.started) / 1000)}`);

    this.display.update([
      {
        label: "scraping",
        progress,
        value: `${formatCount(done)}/${formatCount(this.total)}`,
        valueColor: (s) => kleur.bold(s),
        hint: hints.join(" · "),
      },
      {
        label: "workers",
        value: active.length ? active.join("  ") : kleur.dim("idle"),
        valueColor: (s) => s,
      },
    ]);
  }

  /** Finish the display, leaving the final state on screen. */
  stop(): void {
    this.display.stop([
      {
        label: "scraping",
        progress: this.total > 0 ? (this.ok + this.fail) / this.total : 0,
        value: `${formatCount(this.ok)} ok${this.fail ? kleur.red(` · ${this.fail} failed`) : ""}`,
        valueColor: (s) => kleur.bold(s),
        hint: `elapsed ${formatDuration((Date.now() - this.started) / 1000)}`,
      },
    ]);
  }

  /** Counters for the final summary. */
  get counts(): { ok: number; fail: number; total: number } {
    return { ok: this.ok, fail: this.fail, total: this.total };
  }
}
