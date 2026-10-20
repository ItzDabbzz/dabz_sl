#!/usr/bin/env node
/**
 * Store scraping front end.
 *
 * All the work lives in `run-store.ts`; this file only parses options and
 * calls the shared runner. The `scrape` command uses the same runner, so both
 * behave identically apart from the flags they expose.
 *
 * @example
 * # Preview the catalog without touching any product page
 * pnpm --filter @dabzsl/scraper-cli scrape-store -- --store 199625 --listing-only
 *
 * # Scrape the whole store
 * pnpm --filter @dabzsl/scraper-cli scrape-store -- --store 199625
 *
 * # Resume an interrupted run
 * pnpm --filter @dabzsl/scraper-cli scrape-store -- --store 199625 --resume
 */

import yargs from "yargs";
import { runStoreScrape, printStoreStatus } from "./run-store.js";

/** Strip a leading `--` so `pnpm run scrape-store -- --store 123` works. */
function stripSeparator(args: string[]): string[] {
  return args[0] === "--" ? args.slice(1) : args;
}

(async function main() {
  const argv = (await yargs(stripSeparator(process.argv.slice(2)))
    .option("store", {
      type: "string",
      alias: "s",
      describe: "Store id or store URL to scrape (e.g. 199625)",
    })
    .option("max-pages", {
      type: "number",
      describe: "Maximum number of listing pages to enumerate (default: all)",
    })
    .option("listing-only", {
      type: "boolean",
      default: false,
      describe: "Only enumerate the store listing; do not visit product pages",
    })
    .option("concurrency", {
      type: "number",
      default: 2,
      alias: "c",
      describe: "Product pages fetched in parallel (default 2)",
    })
    .option("delay", {
      type: "number",
      default: 1000,
      describe: "Minimum milliseconds between any two requests (default 1000)",
    })
    .option("resume", {
      type: "boolean",
      default: false,
      describe: "Resume from the existing checkpoint instead of starting over",
    })
    .option("status", {
      type: "boolean",
      default: false,
      describe: "Show the run's state (completed, not yet handled, in flight) and exit",
    })
    .option("json-dir", { type: "string", default: "out", describe: "Directory to save JSON output" })
    .option("json", { type: "string", describe: "Explicit JSON output path" })
    .option("name", { type: "string", describe: "Base filename for the output (default: store-<id>)" })
    .option("xlsx", { type: "boolean", default: false, describe: "Also write an XLSX file" })
    .option("xlsx-out", { type: "string", describe: "XLSX output file path" })
    .option("xlsx-dir", { type: "string", describe: "Directory to save XLSX output" })
    .option("headless", { type: "boolean", default: true, describe: "Run Chromium in headless mode" })
    .option("timeout", { type: "number", default: 4000, describe: "Locator timeout (ms)" })
    .option("nav-timeout", { type: "number", default: 10000, describe: "Navigation timeout (ms)" })
    .option("block-assets", {
      type: "boolean",
      default: true,
      describe: "Block images/fonts/media to speed up page loads",
    })
    .option("preview", { type: "number", default: 10, describe: "Rows to preview at the end" })
    .option("pretty", {
      type: "boolean",
      default: true,
      describe: "Pretty, user-friendly output",
    })
    .option("verbose", { type: "boolean", default: false, describe: "More detailed logs" })
    .help().parseAsync()) as {
      store?: string;
      "max-pages"?: number;
      "listing-only": boolean;
      concurrency: number;
      delay: number;
      resume: boolean;
      "json-dir": string;
      json?: string;
      name?: string;
      xlsx: boolean;
      "xlsx-out"?: string;
      "xlsx-dir"?: string;
      headless: boolean;
      timeout: number;
      "nav-timeout": number;
      "block-assets": boolean;
      preview: number;
      pretty: boolean;
      verbose: boolean;
      status: boolean;
    };

  if (!argv.store) {
    console.error("Provide --store <id|url>");
    process.exit(1);
  }

  if (argv.status) {
    printStoreStatus({
      store: argv.store,
      name: argv.name,
      common: {
        out: "",
        "json-dir": argv["json-dir"],
        json: argv.json,
        xlsx: argv.xlsx,
        "xlsx-out": argv["xlsx-out"],
        "xlsx-dir": argv["xlsx-dir"],
        name: argv.name,
        headless: argv.headless,
        timeout: argv.timeout,
        "nav-timeout": argv["nav-timeout"],
        "block-assets": argv["block-assets"],
        concurrency: argv.concurrency,
        pretty: argv.pretty,
        verbose: argv.verbose,
        preview: argv.preview,
      },
    });
    return;
  }

  await runStoreScrape({
    store: argv.store,
    "max-pages": argv["max-pages"],
    "listing-only": argv["listing-only"],
    "store-delay": argv.delay,
    "store-concurrency": argv.concurrency,
    resume: argv.resume,
    out: "",
    "json-dir": argv["json-dir"],
    json: argv.json,
    xlsx: argv.xlsx,
    "xlsx-out": argv["xlsx-out"],
    "xlsx-dir": argv["xlsx-dir"],
    name: argv.name,
    headless: argv.headless,
    timeout: argv.timeout,
    "nav-timeout": argv["nav-timeout"],
    "block-assets": argv["block-assets"],
    concurrency: argv.concurrency,
    pretty: argv.pretty,
    verbose: argv.verbose,
    preview: argv.preview,
    writeListing: true,
  });
})();
