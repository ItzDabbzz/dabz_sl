# AI agent quickstart for this repo

Monorepo layout (pnpm)
- packages/core – Next.js 15 App Router app (Tailwind v4, Drizzle on Neon, Better Auth)
- packages/scraper-cli – Node/TS Playwright scraper (Second Life Marketplace ➜ JSON/XLSX)
- packages/shared-data – shared utilities/types (transpiled into core)

Runbook
- Install: pnpm install (Node 20+, pnpm 9.12.0)
- Core dev: pnpm dev (filters @dabzsl/core)
- Build all: pnpm -r build; start core: pnpm --filter @dabzsl/core start
- Typecheck/lint core: pnpm typecheck; pnpm lint
- Scraper login (saves session to out/auth.json): pnpm --filter @dabzsl/scraper-cli run login
- Scraper usage examples (Windows PowerShell: pass flags after --):
  - From file: pnpm --filter @dabzsl/scraper-cli run scrape -- --input urls_heads.txt
  - Grouped catalog: pnpm --filter @dabzsl/scraper-cli run scrape -- --primary "Catalog" --sub "Heads=urls_heads.txt" --sub "Genitals=urls_genitals.txt" --write-catalog
  - Direct URL: pnpm --filter @dabzsl/scraper-cli run scrape -- --url https://marketplace.secondlife.com/p/...

Architecture (core app)
- App Router under packages/core/app/*; global CSS in app/globals.css; middleware in packages/core/middleware.ts
- Env loading from monorepo root via @next/env in next.config.ts and dotenv in package scripts
- Database: lib/db.ts exposes a single Drizzle instance over Neon (DATABASE_URL); use this db entrypoint only
- Validation/schemas: packages/core/schemas/* (Zod + zod-openapi). Prefer using these in API routes
- UI patterns: components/* follow shadcn/Radix; hooks in hooks/*; co-locate server/client files; use "use client" or server-only appropriately
- Transpile @dabzsl/shared via next.config.ts transpilePackages; Next build ignores TS errors (ignoreBuildErrors). Run pnpm typecheck to enforce correctness

Scraper design (packages/scraper-cli)
- Entry: src/index.ts ➜ src/scrape.ts; login flow in src/login.ts (manual login, persists storage to out/auth.json)
- scrape.ts flags: --input/--url/--file, --sub & --primary for grouping, --xlsx/--xlsx-out, --concurrency, --block-assets, --timeout/--nav-timeout, --write-catalog
- Outputs: ./out/<base>.json (+ optional <base>.catalog.json and <base>.xlsx). Base name derived from URL list or --name

Env, CI, deploy
- .env at repo root; packages/core scripts use dotenv -e ../../.env; next.config.ts also loads root env
- turbo.json defines build outputs and passes required env; vercel.json builds with pnpm -r build (framework: nextjs)
- Needed env (see turbo.json): Better Auth, OAuth (GitHub/Google/Discord/MS), Stripe, Neon DATABASE_URL, etc.

Drizzle (DB) usage
- Client: packages/core/lib/db.ts uses @neondatabase/serverless + drizzle-orm/neon-http; always import and use this singleton db
- Schemas: Drizzle table models live in packages/core/schemas/*.ts (see sl-schema.ts for SL objects, marketplace, webhooks, audit)
  - Notable tables: mpItems, mpCategories, mpItemCategories; masterObjects, objectVersions, objectInstances, userConfigs, configSnapshots; entitlements; webhooks, webhookDeliveries; auditLogs
- Config: packages/core/drizzle.config.ts sets schema dir and outputs migrations to packages/core/drizzle
- Migrations: packages/core/drizzle/*.sql (numbered). Manage via pnpm --filter @dabzsl/core:
  - db:generate (emit SQL from schema changes); db:migrate (apply); db:push (apply without snapshots); db:studio (UI); db:introspect (from existing DB)
- Pattern: import tables from packages/core/schemas/* and use db in server routes/actions; avoid ad-hoc SQL or new Neon clients

Conventions
- Use pnpm filters (e.g., pnpm --filter @dabzsl/core dev) and recursive tasks (pnpm -r build)
- API routes live under app/api/* (e.g., app/api/public/foo/route.ts); validate with schemas/*; use db from lib/db.ts
- Avoid bundling server-only libs in client components; keep scraping or heavy Node code out of the browser bundle

Current features (core app)
- Auth: Email/password, passkeys, MFA, password reset, email verification (Better Auth)
- Orgs/teams, roles/permissions; rate limiting helpers (see packages/core/lib/*.ts)
- Stripe plugin integration scaffolding; session management utilities
- API docs page at packages/core/app/api-docs/page.tsx (zod-openapi)
- Data model for SL marketplace items/categories and creator-defined objects with versioned per-instance configs, webhooks, and audit logs

Concrete examples
- Add public API route: packages/core/app/api/public/new/route.ts (parse with Zod, query via db, return JSON)
- Extend scraper field set: update scrapeItem and sheetFromItems in packages/scraper-cli/src/scrape.ts
- Run catalog scrape for provided lists: urls_heads.txt and urls_genitals.txt at repo root

Troubleshooting
- Scraper exits early: ensure out/auth.json exists (run login); bump --timeout/--nav-timeout; disable --block-assets if selectors depend on images
- Next builds despite TS errors; use pnpm typecheck locally to catch issues
