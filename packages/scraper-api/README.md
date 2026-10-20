# `@dabzsl/scraper-api`

Dual-purpose package:

1. **Library** — exports the core Playwright scraping logic. Consumed by `@dabzsl/scraper-cli` and any other internal package.
2. **HTTP server** — a secured Express 5 API that exposes a `POST /api/scrape` endpoint for remote scrape requests.

---

## Table of Contents

- [Package Exports](#package-exports)
- [Library API](#library-api)
- [HTTP Server](#http-server)
- [Running Locally](#running-locally)
- [Environment Variables](#environment-variables)
- [Docker](#docker)
- [Security Model](#security-model)
- [Scripts Reference](#scripts-reference)

---

## Package Exports

```json
{
  ".":        "./dist/lib.js"      // Library — scraping functions and types
  "./server": "./dist/app.js"      // HTTP server — Express app + PORT export
}
```

Import the library:

```ts
import { scrapeUrl, scrapeItem, configurePage } from '@dabzsl/scraper-api';
import type { Item, Permissions, PageOptions, ScrapeOptions } from '@dabzsl/scraper-api';
```

Import the server (e.g. for tests):

```ts
import { app, PORT } from '@dabzsl/scraper-api/server';
```

---

## Library API

### `scrapeUrl(url, opts?): Promise<Item>`

High-level helper that manages the full Playwright browser lifecycle.

Opens Chromium, creates a context (optionally restoring a saved session), scrapes the given SL Marketplace product page, and closes the browser — even on error.

```ts
const item = await scrapeUrl('https://marketplace.secondlife.com/p/item-name/12345');
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | `string` | — | Full SL Marketplace product URL |
| `opts.headless` | `boolean` | `true` | Run Chromium in headless mode |
| `opts.storageStatePath` | `string` | — | Path to `auth.json` Playwright session file (for authenticated scrapes) |
| `opts.onStage` | `(stage: string) => void` | — | Callback fired at the start of each scrape phase |
| `opts.timeout` | `number` | `4000` | Locator timeout in ms |
| `opts.navTimeout` | `number` | `10000` | Navigation timeout in ms |
| `opts.blockAssets` | `boolean` | `true` | Block images/fonts/media to speed up page loads |

---

### `scrapeItem(page, url, onStage?): Promise<Item>`

Low-level function. The caller is responsible for creating and closing the Playwright `Page`.

Use `scrapeUrl` unless you need fine-grained control over the browser context (e.g. batching many scrapes in a single browser).

```ts
import { chromium } from 'playwright';
import { scrapeItem, configurePage } from '@dabzsl/scraper-api';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await configurePage(page);
const item = await scrapeItem(page, url, (stage) => console.log(stage));

await page.close();
await browser.close();
```

---

### `configurePage(page, opts?): Promise<void>`

Applies per-page Playwright settings: timeouts and optional asset blocking. Safe to call multiple times — errors are swallowed.

---

### `scrapeStore(store, opts?): Promise<StoreScrapeResult>`

Scrapes an **entire store** in two phases:

1. **Enumerate** — walk the store's paginated listing. One request covers 96
   products, so a 2500-item store needs ~27 requests instead of 2500.
2. **Detail** — visit each product page with a bounded worker pool.

```ts
import { scrapeStore } from '@dabzsl/scraper-api';

const result = await scrapeStore('199625', {
  concurrency: 2,
  minDelayMs: 1000,
  onItem: (item, done, total) => console.log(`${done}/${total} ${item.title}`),
});

console.log(result.items);      // full Item objects
console.log(result.listing);    // cheap index rows
console.log(result.failures);   // { url, error, status? }[]
console.log(result.aborted);    // set if the marketplace started refusing requests
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `opts.concurrency` | `number` | `2` | Product pages fetched in parallel. |
| `opts.minDelayMs` | `number` | `1000` | Minimum gap between **any two** requests, enforced globally across all workers. |
| `opts.listingOnly` | `boolean` | `false` | Stop after enumeration; never visit a product page. |
| `opts.maxPages` | `number` | all | Cap how many listing pages to enumerate. |
| `opts.query` | `Record<string,string>` | — | Extra query params for the store URL (e.g. `search[sort]`). |
| `opts.checkpointPath` | `string` | — | Path to the run's checkpoint file. The single source of truth for progress: it holds the enumerated listing, the completed table, the failures and the item in flight. |
| `opts.reuseListing` | `boolean` | `false` | Reuse the listing already in the checkpoint instead of re-enumerating the store. |
| `opts.listingPath` | `string` | — | Also write the enumerated listing to this path as plain JSON. |
| `opts.onItem` | `(item, done, total) => void` | — | Called after each item is scraped. |
| `opts.onEnumerated` | `(listing, total) => void` | — | Called when enumeration completes. |
| `opts.onPage` | `(page, found, total) => void` | — | Called after each listing page is fetched. |
| `opts.onAborted` | `(reason) => void` | — | Called when the marketplace starts refusing requests. |

Plus everything from `ScrapeOptions` (`headless`, `storageStatePath`, `onStage`, `timeout`, `navTimeout`, `blockAssets`).

### Rate limiting

The marketplace is a shared, rate-limited origin and it answers `406` to
clients that do not look like a browser. `scrapeStore` is deliberately
conservative:

- **One shared browser context** for the whole run — one session, one device
  fingerprint, one client as far as the site is concerned.
- **A global request pacer.** `minDelayMs` is enforced across *all* workers,
  not per worker. Per-worker pacing would multiply the total rate by the
  worker count.
- **Hard abort on refusal.** `403`, `406`, `429` and `503` stop the run
  immediately and set `result.aborted`. Continuing against a refusing origin
  is what turns a throttle into a ban.
- **Checkpointing.** With `checkpointPath`, a run that is interrupted resumes
  where it stopped rather than starting over. The checkpoint is append-only
  JSONL, written after every item at O(1) cost, so a crash loses at most the
  item that was in flight. It also holds the enumerated listing, so a resumed
  run does not re-request every listing page.

The default 1 request/second keeps a 2000-item store to roughly 35 minutes.

### `enumerateStore(page, storeId, opts?): Promise<{ listing, totalItems, pagesFetched }>`

The enumeration half on its own, for callers that want to drive their own
detail pass. `listing` rows carry `productId`, `url`, `title`, `price`,
`brand`, `category` and `image`.

### `parseStoreId(input)`, `parseStoreUrl(input)` and `buildStoreUrl(storeId, page?, opts?)`

Helpers for turning a store URL or bare id into a store id, and for building
listing URLs. `buildStoreUrl` caps `per_page` at 96 — the marketplace silently
clamps anything higher and renders *fewer* cards per page, not more.

`parseStoreUrl` returns the id **and** the `search[...]` filters carried in a
store URL, so a pasted URL's page size, sort order and price bounds are not
silently discarded.

Demo items and limited-quantity items are always excluded — see
`ALWAYS_FILTERS`. Neither is a real catalog entry: a demo is a free preview of
another product, and a limited-quantity item cannot be bought again once its
stock runs out.

### Checkpoint helpers

`readCheckpointFile(file)`, `pendingFrom(state)` and `describeCheckpoint(state)`
read a run's checkpoint and render its state.

`describeCheckpoint` returns the completed table, the uncompleted table, the
failures, and the item that was in flight when the run stopped. The
uncompleted table is derived — the listing minus the completed set — so it can
never disagree with the rest of the file.

---

## Types

### `Item`

A fully-scraped SL Marketplace product listing.

| Field | Type | Description |
|-------|------|-------------|
| `url` | `string` | Source product URL |
| `title` | `string` | Product title |
| `version` | `string` | Version string extracted from the listing |
| `images` | `string[]` | Image URLs |
| `price` | `string` | Linden dollar price (as text, e.g. `"L$250"`) |
| `creator` | `{ name: string; link: string }` | Creator display name and profile link |
| `soldBy` | `string` | In-world avatar username of the seller |
| `store` | `string` | Store link URL |
| `permissions` | `Permissions` | Copy / Modify / Transfer permission strings |
| `description` | `string` | Full product description |
| `features` | `string[]` | Bullet-point feature list |
| `contents` | `string[]` | Package contents list |
| `updatedOn` | `string` | Last updated date string |
| `meshInfo` | `string` | Mesh type (e.g. `"100% Mesh, Fitted Mesh"`) |
| `itemCategories` | `string[]` | Breadcrumb category path |
| `demoUrl` | `string` | Demo listing URL |
| `inWorldUrl` | `string` | SLurl (`maps.secondlife.com`) |
| `categories?` | `Array<{ primary: string; sub: string }>` | CLI-assigned grouping (not scraped) |

### `Permissions`

```ts
interface Permissions {
  copy: string;     // e.g. "Copy"
  modify: string;   // e.g. "No Modify"
  transfer: string; // e.g. "Transfer"
}
```

### `PageOptions`

```ts
interface PageOptions {
  timeout?: number;      // Default: 4000
  navTimeout?: number;   // Default: 10000
  blockAssets?: boolean; // Default: true
}
```

### `ScrapeOptions`

Extends `PageOptions` with:

```ts
interface ScrapeOptions extends PageOptions {
  headless?: boolean;
  storageStatePath?: string;
  onStage?: (stage: string) => void;
}
```

---

## HTTP Server

### Endpoints

#### `GET /health`

No authentication required. Used by load balancers and uptime monitors.

**Response:**
```json
{ "ok": true, "version": "0.1.0" }
```

---

#### `POST /api/scrape`

Scrapes a single SL Marketplace product page.

**Authentication:** `Authorization: Bearer <SCRAPER_API_KEY>` (required when `SCRAPER_API_KEY` is set)

**Request body:**

```json
{
  "url": "https://marketplace.secondlife.com/p/item-name/12345",
  "timeout": 4000,
  "navTimeout": 10000,
  "blockAssets": true
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `url` | `string` | Yes | Must start with `https://marketplace.secondlife.com/` |
| `timeout` | `number` | No | 5000–120000 ms |
| `navTimeout` | `number` | No | 5000–120000 ms |
| `blockAssets` | `boolean` | No | — |

**Success response (200):**

```json
{
  "ok": true,
  "data": { /* Item object */ }
}
```

**Error responses:**

| Status | Body | Reason |
|--------|------|--------|
| `400` | `{ "ok": false, "error": { /* zod flatten */ } }` | Invalid request body |
| `401` | `{ "ok": false, "error": "Unauthorized" }` | Missing or wrong API key |
| `429` | `{ "ok": false, "error": "Too many requests…" }` | Rate limit exceeded (20 req/min per IP) |
| `500` | `{ "ok": false, "error": "…" }` | Scrape failure |

---

#### `POST /api/scrape/store`

Scrapes every product in an SL Marketplace store.

**Authentication:** `Authorization: Bearer <SCRAPER_API_KEY>` (required when `SCRAPER_API_KEY` is set)

**Request body:**

```json
{
  "store": "199625",
  "listingOnly": false,
  "maxPages": 10,
  "concurrency": 2,
  "minDelayMs": 1000,
  "timeout": 4000,
  "navTimeout": 10000,
  "blockAssets": true
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `store` | `string` | Yes | Store id or store URL |
| `listingOnly` | `boolean` | No | Enumerate only; never visit product pages |
| `maxPages` | `number` | No | 1–200 listing pages to enumerate |
| `concurrency` | `number` | No | 1–4 product pages in parallel |
| `minDelayMs` | `number` | No | 250–60000 ms between any two requests |
| `timeout` | `number` | No | 5000–120000 ms |
| `navTimeout` | `number` | No | 5000–120000 ms |
| `blockAssets` | `boolean` | No | — |

**Success response (200):**

```json
{
  "ok": true,
  "data": {
    "storeId": "199625",
    "totalItems": 4911,
    "pagesFetched": 52,
    "items": [ /* full Item objects */ ],
    "listing": [ /* { productId, url, title, price, brand, category, image } */ ],
    "failures": []
  }
}
```

**Error responses:**

| Status | Body | Reason |
|--------|------|--------|
| `400` | `{ "ok": false, "error": { /* zod flatten */ } }` | Invalid request body |
| `401` | `{ "ok": false, "error": "Unauthorized" }` | Missing or wrong API key |
| `429` | `{ "ok": false, "error": "Marketplace responded 429 …", "data": { … } }` | The marketplace started refusing requests. The run stopped rather than pushing into a block — back off and retry later. |
| `500` | `{ "ok": false, "error": "…" }` | Scrape failure |

> A full-store scrape of a few thousand products takes tens of minutes at the
> default pacing. Prefer `listingOnly: true` for a quick catalog, or drive the
> scrape from the CLI, which checkpoints and can resume.

---

## Running Locally

```bash
# Install deps from repo root
pnpm install

# Dev mode (tsx watch)
pnpm --filter @dabzsl/scraper-api dev

# Build TypeScript
pnpm --filter @dabzsl/scraper-api build

# Run compiled output
pnpm --filter @dabzsl/scraper-api start
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Port the server listens on |
| `SCRAPER_API_KEY` | No | `""` | Bearer token for `POST /api/scrape`. If empty the server runs open (useful in dev). |
| `EXTRA_ORIGINS` | No | `""` | Comma-separated additional CORS origins beyond `sl.itzdabbzz.me` |
| `NODE_ENV` | No | — | Set to `production` in Docker; controls whether localhost origins are added to CORS |

---

## Docker

The package includes a multi-stage Dockerfile and a `docker-compose.yml`.

### Build and run with Docker Compose

```bash
cd packages/scraper-api

# Build and start
SCRAPER_API_KEY=your-secret docker compose up --build

# Or pass the key via .env
echo "SCRAPER_API_KEY=your-secret" > .env
docker compose up --build
```

The compose file builds from the **workspace root** (so it can access `pnpm-workspace.yaml` and `pnpm-lock.yaml`).

### Dockerfile stages

| Stage | Base | Purpose |
|-------|------|---------|
| `builder` | `node:22-slim` | Install all deps and compile TypeScript |
| `runtime` | `mcr.microsoft.com/playwright:v1.59.1-noble` | Production image with Chromium pre-installed |

The runtime image uses the official Playwright image, which includes Chromium and all its Linux dependencies. `SYS_ADMIN` capability is added in the compose file to avoid Chromium sandbox issues in Docker.

### Direct Docker build (from repo root)

```bash
docker build -f packages/scraper-api/Dockerfile -t scraper-api .
docker run -p 3000:3000 -e SCRAPER_API_KEY=secret scraper-api
```

---

## Security Model

Security middleware layers applied in order:

1. **CORS** — Only origins in `ALLOWED_ORIGINS` are permitted. Defaults: `sl.itzdabbzz.me`, and localhost in non-production. Add staging/preview URLs via `EXTRA_ORIGINS`.
2. **Rate limiter** — 20 requests per minute per IP. Returns `429` when exceeded.
3. **API key auth** — `Authorization: Bearer <key>` checked on protected routes. No key configured → server is open (dev convenience).
4. **Zod body validation** — Request body for `POST /api/scrape` is validated before reaching the scrape logic.

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `dev` | Start with `tsx --watch` (no build step needed) |
| `build` | Compile TypeScript to `dist/` |
| `typecheck` | `tsc --noEmit` |
| `start` | Run compiled `dist/index.js` |
