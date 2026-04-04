# `@dabzsl/core`

Main Next.js 15 app for the monorepo. This is the package Vercel builds and serves.

## Layout

Source now lives under `src/`.

```text
packages/core/
├─ middleware.ts          # root shim re-exporting src/middleware for Next
├─ src/
│  ├─ app/                # App Router routes, pages, route handlers
│  ├─ components/         # UI, feature, and shared client/server components
│  ├─ lib/                # auth, db, caching, guards, utilities
│  ├─ schemas/            # Drizzle schema definitions
│  └─ types/              # package-local type declarations
└─ package.json
```

## Scripts

From the repo root:

```bash
pnpm --filter @dabzsl/core dev
pnpm --filter @dabzsl/core build
pnpm --filter @dabzsl/core start
pnpm --filter @dabzsl/core lint
pnpm --filter @dabzsl/core typecheck
```

From `packages/core` directly:

```bash
pnpm dev
pnpm build
pnpm start
```

The package expects env vars from `../../.env` for local `build`, `dev`, database, auth, and email flows.

## Current State

- `app`, `components`, `lib`, `schemas`, and `types` are consolidated under `src`
- the homepage is static again with a client-side account pill instead of forcing per-request auth work
- marketplace and Second Life stats are shared through cached helpers instead of duplicated fetches
- decorative background motion no longer ships a `framer-motion` client bundle just to animate the landing page
- several admin pages now query the database directly instead of server components calling internal API routes
- production build, lint, and typecheck are currently passing

## Ranked TODO

### ASAP

- Remove tracked `packages/core/node_modules/.bin/*` files from git. They do not belong in source control and will keep creating noisy diffs.
- Break up the heaviest route bundles. Current first-load JS is still large on routes like `/dashboard/tools/marketplace/explorer` (`423 kB`), `/dashboard/userprofile` (`397 kB`), `/dashboard` (`353 kB`), `/blog/[slug]` (`328 kB`), and `/marketplace` (`323 kB`).
- Add automated coverage for the build-critical flows: homepage render, public blog, sitemap, auth/session, and RBAC route handlers. Right now regressions are too easy to ship.
- Audit every API route and remove blanket dynamic behavior where it is not needed. The app now builds cleanly, but route caching/runtime should be tightened intentionally instead of left broad.

### High

- Finish RBAC and API-key scope enforcement end-to-end. The creator-system roadmap still shows this as incomplete, and it is security-sensitive.
- Finish the missing creator-system pieces called out in `docs/sl-system-todo.md`: LSL client reference flow, stronger data constraints, webhook event coverage, heartbeat/anomaly detection, and rollout/staging docs.
- Wire real error monitoring for app-router failures and background route issues. `src/app/error.tsx` still has a TODO for that.
- Reduce client-side overfetching and oversized interactive dashboards, especially the marketplace explorer and profile/admin surfaces.

### Medium

- Add a proper data-access layer for repeated public/blog/marketplace queries so page-level code is thinner and easier to cache.
- Replace fallback-only resilience with observable operational behavior. Pages now fail soft when DB/upstream data is unavailable, but there is no alerting around those degraded states.
- Add route-level performance budgets and bundle analysis checks to stop the biggest pages from drifting upward again.
- Clean up long, mixed-responsibility page files in admin and marketplace areas. Some are still too large to reason about comfortably.

### Meh

- Refresh docs for local setup, required env vars, and data workflows beyond the core package basics.
- Add staging seed data and example workflows for creator APIs, webhook testing, and marketplace moderation.

## Known Incomplete Features

- SL creator system acceptance is not fully done yet. The roadmap still lists RBAC enforcement, LSL client behavior, testing, staging, and rollout work as open.
- Marketplace/admin tooling works, but some areas are still operationally rough rather than product-finished.
- Public-content pages now degrade safely when upstream data is missing, but the fallback UX is intentionally minimal and should be improved later.
