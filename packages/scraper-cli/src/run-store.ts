/**
 * The store scraping run, shared by the `scrape` and `scrape-store` commands.
 *
 * Both front ends call {@link runStoreScrape}. The difference between them is
 * only which options they expose — the work is identical, and so is the
 * progress display.
 */

import fs from "fs";
import kleur from "kleur";
import { scrapeStore } from "@dabzsl/scraper-api";
import type { Item } from "@dabzsl/scraper-api";
import { readCheckpointFile, pendingFrom, describeCheckpoint } from "@dabzsl/scraper-api";
import {
  ScrapeUi,
  appendItem,
  outputPaths,
  printFailures,
  printHeader,
  printPreview,
  readItems,
  resetOutputs,
  resolveSession,
  saveOutputs,
  type CliItem,
  type CommonOptions,
  type StoreOptions,
} from "./cli.js";
import { formatCount } from "./ui.js";

/** Options for {@link runStoreScrape}. */
export interface StoreRunOptions extends CommonOptions, StoreOptions {
  /** Store id or store URL. */
  store: string;
  /** Category grouping to attach to every item from the store. */
  categories?: Array<{ primary: string; sub: string }>;
  /**
   * Write the listing as a convenience export of plain JSON.
   *
   * Optional — the checkpoint already holds the listing, so this file is not
   * needed to resume.
   */
  writeListing?: boolean;
  /**
   * Write the store's own JSON/catalog files.
   *
   * The unified `scrape` command sets this to false and writes one combined
   * file itself, so a store scraped through `scrape` does not also drop a
   * second `store-<id>.json` next to it.
   */
  saveFiles?: boolean;
}

/** Result of a store run. */
export interface StoreRunResult {
  items: CliItem[];
  failures: Array<{ url: string; err: string }>;
  aborted?: string;
  jsonPath: string;
}

/**
 * Print the state of a store run, read from its checkpoint.
 *
 * Shows both tables the checkpoint holds: the completed items and the
 * uncompleted ones, plus the item that was in flight when the run stopped.
 */
export function printStoreStatus(opts: { store: string; name?: string; common: CommonOptions }): void {
  const storeId = (opts.store.match(/\/stores\/(\d+)/) ?? [])[1] ?? opts.store;
  const baseName = opts.name || `store-${storeId}`;
  const paths = outputPaths(baseName, opts.common);
  const state = readCheckpointFile(paths.checkpoint);
  const summary = describeCheckpoint(state);

  console.log(kleur.cyan().bold("Store run status"));
  console.log(`  ${kleur.gray("store")}: ${storeId}`);
  console.log(`  ${kleur.gray("checkpoint")}: ${paths.checkpoint}`);
  console.log(
    `  ${kleur.gray("total")}: ${formatCount(summary.total)}  ` +
      `${kleur.green("completed")}: ${formatCount(summary.completed)}  ` +
      `${kleur.yellow("remaining")}: ${formatCount(summary.remaining)}  ` +
      `${kleur.red("failed")}: ${formatCount(summary.failed)}`,
  );
  if (summary.current) {
    console.log(`  ${kleur.gray("in flight")}: ${summary.current}`);
  }
  if (summary.inFlight.length > 1) {
    console.log(`  ${kleur.gray("also in flight")}: ${summary.inFlight.join(", ")}`);
  }

  if (summary.completedItems.length) {
    console.log(kleur.gray(`\nCompleted (${summary.completedItems.length}):`));
    for (const it of summary.completedItems.slice(0, 50)) {
      console.log(`  ${kleur.green("✓")} ${it.title || it.url}`);
    }
    if (summary.completedItems.length > 50) {
      console.log(kleur.gray(`  (+${formatCount(summary.completedItems.length - 50)} more)`));
    }
  }

  if (summary.remainingItems.length) {
    console.log(kleur.gray(`\nNot yet handled (${summary.remainingItems.length}):`));
    for (const row of summary.remainingItems.slice(0, 50)) {
      console.log(`  ${kleur.yellow("○")} ${row.title || row.url}`);
    }
    if (summary.remainingItems.length > 50) {
      console.log(kleur.gray(`  (+${formatCount(summary.remainingItems.length - 50)} more)`));
    }
  }

  if (summary.failures.length) {
    console.log(kleur.gray(`\nFailed (${summary.failures.length}):`));
    for (const f of summary.failures.slice(0, 20)) {
      console.log(`  ${kleur.red("✗")} ${f.id} — ${f.error.slice(0, 100)}`);
    }
  }
}
export async function runStoreScrape(opts: StoreRunOptions): Promise<StoreRunResult> {
  const pretty = opts.pretty !== false;
  const verbose = opts.verbose === true;
  // The store may be a bare id or a full marketplace URL. The id is used for
  // naming; the URL is passed through to the scraper so its query string
  // (page size, sort order, price bounds) is not silently discarded.
  const storeId = (opts.store.match(/\/stores\/(\d+)/) ?? [])[1] ?? opts.store;
  const baseName = opts.name || `store-${storeId}`;

  const paths = outputPaths(baseName, opts);
  if (!opts.resume) resetOutputs(paths);

  const session = resolveSession();

  printHeader({
    title: "Second Life Marketplace Store Scraper",
    rows: [
      ["store", opts.store.includes("/stores/") ? `id ${storeId}` : opts.store],
      ["filters", "no demos, no limited quantities"],
      ["concurrency", String(opts["store-concurrency"])],
      ["delay", `${opts["store-delay"]}ms`],
      ["headless", opts.headless ? "yes" : "no"],
    ],
    sessionFound: session.found,
    pretty,
  });

  const ui = new ScrapeUi({ pretty, verbose });
  ui.start();

  const failures: Array<{ url: string; err: string }> = [];
  let aborted: string | undefined;

  // Read the checkpoint before the run. It holds the listing, the completed
  // table and the item that was in flight when a previous run stopped.
  const prior = readCheckpointFile(paths.checkpoint);
  if (opts.resume && prior.done.size) {
    console.log(
      kleur.gray(
        `  resuming: ${formatCount(prior.done.size)} already done, ` +
          `${formatCount(pendingFrom(prior).length)} remaining`,
      ),
    );
  }

  try {
    const result = await scrapeStore(opts.store, {
      headless: opts.headless,
      storageStatePath: session.path,
      concurrency: opts["store-concurrency"],
      minDelayMs: opts["store-delay"],
      listingOnly: opts["listing-only"],
      maxPages: opts["max-pages"],
      timeout: opts.timeout,
      navTimeout: opts["nav-timeout"],
      blockAssets: opts["block-assets"],
      checkpointPath: paths.checkpoint,
      // Reuse the persisted listing on resume: it was captured before any
      // product page was visited, so the store is not re-enumerated.
      reuseListing: opts.resume,

      // ── Phase 1: enumeration ──────────────────────────────────────────
      onPage: (page, found, totalItems) => {
        const known = totalItems > 0;
        const pages = known ? Math.ceil(totalItems / 96) : undefined;
        ui.showRows([
          {
            label: "enumerating",
            progress: pages ? page / pages : 0,
            value: `page ${formatCount(page)}${pages ? `/${formatCount(pages)}` : ""}`,
            valueColor: (s) => kleur.bold(s),
            hint: known ? `${formatCount(totalItems)} items in store` : "reading store size",
          },
          {
            label: "found",
            value: `${formatCount(found)} products`,
            valueColor: (s) => kleur.green(s),
          },
        ]);
      },

      onEnumerated: (found, totalItems) => {
        ui.setTotal(totalItems || found.length);
        if (pretty) {
          ui.showRows([
            {
              label: "enumerated",
              progress: 1,
              value: `${formatCount(found.length)} products`,
              valueColor: (s) => kleur.green(s),
              hint: `store reports ${formatCount(totalItems)} items`,
            },
          ]);
        }
      },

      // ── Phase 2: detail pages ─────────────────────────────────────────
      onItem: (item, done, itemTotal) => {
        ui.setTotal(itemTotal);
        ui.itemDone();
        // The final output: one item per line, appended as it is scraped.
        appendItem(paths.items, item);
        if (verbose) {
          console.log(kleur.dim(`  [${done}/${itemTotal}] ${item.title}`));
        }
      },

      onAborted: (reason) => {
        aborted = reason;
        console.log(kleur.red().bold(`  Aborted: ${reason}`));
      },
    });

    for (const f of result.failures) {
      failures.push({ url: f.url, err: f.error });
    }
    if (result.aborted) aborted = result.aborted;
  } catch (e: unknown) {
    failures.push({
      url: opts.store,
      err: e instanceof Error ? e.message : String(e),
    });
  } finally {
    ui.stop();
  }

  // The items file is the final output: it holds every item scraped, across
  // this run and any earlier interrupted run.
  const collected = readItems(paths.items);
  const items: CliItem[] = collected.map((it) => {
    const cli = it as CliItem;
    if (!cli.categories) cli.categories = opts.categories || [];
    return cli;
  });

  if (opts.saveFiles !== false) {
    saveOutputs({
      items,
      paths,
      common: opts,
      writeCatalog: Boolean(opts.categories?.length),
      // The items file is the final output; the aggregate JSON is only
      // written when explicitly requested.
      writeJson: Boolean(opts.json),
    });
  }

  if (opts.saveFiles !== false) {
    printPreview(items as Item[], opts.preview);
  }
  printFailures(failures);

  const { fail } = ui.counts;
  if (opts.saveFiles !== false) {
    console.log(
      kleur.bold().green(
        `Done: ${formatCount(items.length)} ok, ${fail} failed` +
          (aborted ? kleur.red(" (aborted — rerun with --resume to continue)") : "."),
      ),
    );
  }

  return { items, failures, aborted, jsonPath: paths.json };
}
