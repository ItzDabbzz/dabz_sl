# dabz_sl

Monorepo for the Sanctum / Second Life toolchain. Houses the Next.js web app, a Playwright-based scraper HTTP API, and a local CLI scraper.

---

## Repository Layout

```
dabz_sl/
├── packages/
│   ├── core/           — @dabzsl/core    — Next.js 15 App Router web app (Vercel)
│   ├── scraper-api/    — @dabzsl/scraper-api — Playwright scraper library + Express HTTP server
│   └── scraper-cli/    — @dabzsl/scraper-cli — Local CLI for bulk scraping to JSON/XLSX
├── pnpm-workspace.yaml
├── turbo.json
├── vercel.json         — Vercel build config (targets packages/core)
└── .env                — Shared env vars loaded by all packages during local dev
```

> **Note:** `packages/shared-data` is reserved in the workspace but not yet published.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22+ |
| pnpm | 9.12.0 (pinned via `packageManager`) |
| Playwright Chromium | Installed automatically via `pnpm install` |

```bash
# Install all workspace dependencies
pnpm install
```

---

## Packages

### `packages/core` — Web App

The main product. Next.js 15 App Router, deployed to Vercel.

- **Local dev:** `pnpm --filter @dabzsl/core dev`
- **Production build:** `pnpm --filter @dabzsl/core build`
- **Typecheck:** `pnpm --filter @dabzsl/core typecheck`

See [`packages/core/README.md`](packages/core/README.md) for full structure, env vars, DB setup, and deployment notes.

---

### `packages/scraper-api` — Scraper Library + HTTP Server

A dual-purpose package:

- **Library** (`import from '@dabzsl/scraper-api'`): exports `scrapeUrl`, `scrapeItem`, `configurePage`, and all types. Used by the CLI.
- **HTTP server**: a secured Express 5 API that exposes `POST /api/scrape` for remote scrape requests.

See [`packages/scraper-api/README.md`](packages/scraper-api/README.md) for API docs, Docker setup, and env vars.

---

### `packages/scraper-cli` — Bulk Scraper CLI

A local CLI tool for scraping multiple Second Life Marketplace product pages and exporting results to JSON and/or XLSX.

```bash
# Scrape URLs from a text file
pnpm --filter @dabzsl/scraper-cli scrape -- --input urls.txt --xlsx

# Scrape a single URL
pnpm --filter @dabzsl/scraper-cli scrape -- --url https://marketplace.secondlife.com/p/item-name/12345
```

See [`packages/scraper-cli/README.md`](packages/scraper-cli/README.md) for all CLI flags and output options.

---

## Workspace Commands

Run from the repo root:

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspace deps |
| `pnpm -r build` | Build all packages |
| `pnpm -r typecheck` | Typecheck all packages |
| `pnpm -r lint` | Lint all packages |
| `pnpm --filter @dabzsl/core dev` | Start core app in dev mode |

---

## Environment Variables

Create a `.env` file at the workspace root. The core package loads it via `dotenv`. Key variables:

| Variable | Used By | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | core | Neon PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | core | Auth signing secret |
| `SCRAPER_API_KEY` | scraper-api | Bearer token for the scraper HTTP API |
| `EXTRA_ORIGINS` | scraper-api | Comma-separated additional CORS origins |

See each package's README for the full list of required env vars.

---

## Deployment

`vercel.json` at the repo root configures Vercel to build and serve `packages/core`.

```
Install command:  pnpm install --frozen-lockfile
Build command:    pnpm -r build
Output directory: packages/core/.next
```

The scraper API is deployed separately via Docker (see `packages/scraper-api/README.md`).
