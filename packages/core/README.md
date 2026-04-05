# `@dabzsl/core`

Next.js 15 App Router web app for the Sanctum / Second Life ecosystem. Deployed to Vercel.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Authentication](#authentication)
- [App Routes](#app-routes)
- [API Routes](#api-routes)
- [Features Overview](#features-overview)
- [Scripts Reference](#scripts-reference)
- [Deployment](#deployment)
- [Known Incomplete / TODO](#known-incomplete--todo)

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | Next.js 15 (App Router) |
| Database | Neon PostgreSQL via `@neondatabase/serverless` |
| ORM | Drizzle ORM |
| Auth | Better Auth (`better-auth`) |
| UI Components | shadcn/ui + Radix UI primitives |
| Styling | Tailwind CSS v4 |
| Validation | Zod + `zod-openapi` |
| Email | React Email + Resend |
| Data fetching | TanStack Query v5 |

---

## Directory Structure

```
packages/core/
├── src/
│   ├── app/                  — Next.js App Router routes, pages, and route handlers
│   │   ├── (auth)/           — Authentication-related pages (sign-in, sign-up, etc.)
│   │   ├── api/              — Route handlers
│   │   │   ├── admin/        — Admin-only API endpoints
│   │   │   ├── auth/         — Better Auth handler
│   │   │   ├── creator/      — SL creator system API
│   │   │   ├── docs/         — API docs (OpenAPI)
│   │   │   ├── protected/    — Authenticated user endpoints
│   │   │   ├── public/       — Unauthenticated public endpoints
│   │   │   ├── sl/           — Second Life in-world client endpoints
│   │   │   ├── tools/        — Internal tooling API routes
│   │   │   ├── v1/           — Versioned public REST API
│   │   │   └── webhooks/     — Incoming webhook handlers
│   │   ├── apps/             — App launcher / portal pages
│   │   ├── blog/             — Public blog (SSG + ISR)
│   │   ├── dashboard/        — Authenticated user dashboard
│   │   │   ├── admin/        — Admin panel pages
│   │   │   ├── apikeys/      — API key management
│   │   │   ├── blog/         — Blog post editor
│   │   │   ├── database/     — Raw DB viewer (admin)
│   │   │   ├── tools/        — Internal tools (marketplace explorer, etc.)
│   │   │   ├── userprofile/  — User profile settings
│   │   │   └── webhooks/     — Webhook destination management
│   │   ├── marketplace/      — Public SL Marketplace catalog
│   │   ├── oauth/            — OAuth callback handling
│   │   ├── wearing/          — HUD / wearing status pages
│   │   ├── layout.tsx        — Root layout
│   │   ├── page.tsx          — Homepage
│   │   ├── sitemap.ts        — Dynamic sitemap
│   │   ├── metadata.ts       — Shared metadata helpers
│   │   ├── error.tsx         — App-level error boundary
│   │   ├── not-found.tsx     — 404 page
│   │   └── global-error.tsx  — Root error boundary
│   ├── components/
│   │   ├── ui/               — shadcn/ui base components
│   │   ├── shared/           — Layout, nav, and global shared components
│   │   ├── dashboard/        — Dashboard-specific components
│   │   ├── providers/        — React context providers (theme, query client, etc.)
│   │   ├── action-toast.tsx  — Server action result toasts
│   │   ├── theme-provider.tsx
│   │   └── web-bg.tsx        — Decorative background (CSS-only, no framer-motion)
│   ├── features/
│   │   ├── admin/            — Admin feature modules
│   │   ├── auth/             — Auth forms, hooks, and session helpers
│   │   ├── creator/          — SL creator system feature logic
│   │   ├── emails/           — React Email templates
│   │   ├── marketplace/      — Marketplace data components and helpers
│   │   ├── public/           — Public-facing features
│   │   └── shared/           — Cross-feature utilities
│   ├── lib/
│   │   ├── db.ts             — Drizzle/Neon singleton DB instance
│   │   ├── utils.ts          — General utility helpers
│   │   └── hljs/             — Syntax highlighting config
│   ├── schemas/
│   │   ├── auth-schema.ts    — Drizzle schema: users, sessions, API keys
│   │   ├── blog.ts           — Drizzle schema: blog posts and categories
│   │   ├── fertility-schema.ts — Drizzle schema: fertility system tables
│   │   ├── rbac.ts           — Drizzle schema: roles and permissions
│   │   ├── sl-schema.ts      — Drizzle schema: SL master objects, instances, events
│   │   ├── sl.zod.ts         — Zod validation for SL API payloads
│   │   └── webhook.ts        — Drizzle schema: webhook destinations and logs
│   ├── server/               — Server-side helpers and data access utilities
│   ├── types/                — Package-local type declarations
│   └── proxy.ts              — Internal proxy helper
├── middleware.ts              — Next.js middleware (re-exports src/middleware)
├── drizzle.config.ts          — Drizzle Kit configuration
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## Getting Started

### 1. Install dependencies (from repo root)

```bash
pnpm install
```

### 2. Configure environment variables

Create a `.env` file at the **repo root** (`/mnt/dev/GitRepos/dabz_sl/.env`). The `dev` and `build` scripts load it automatically via `dotenv`.

### 3. Run database migrations

```bash
pnpm --filter @dabzsl/core db:migrate
```

### 4. Start the dev server

```bash
pnpm --filter @dabzsl/core dev
# → http://localhost:3000
```

### 5. (Optional) Start with HTTPS

```bash
pnpm --filter @dabzsl/core dev:secure
# → https://localhost:3000
```

---

## Environment Variables

All variables are loaded from `../../.env` relative to `packages/core`.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Secret used to sign sessions and tokens |
| `BETTER_AUTH_URL` | Yes | Canonical base URL of the app (e.g. `https://sanctumrp.net`) |
| `RESEND_API_KEY` | Yes | Resend API key for transactional email |
| `NEXT_PUBLIC_APP_URL` | Yes | Public-facing base URL (used in client-side code) |
| `SCRAPER_API_URL` | No | Base URL of the deployed `scraper-api` HTTP server |
| `SCRAPER_API_KEY` | No | Bearer token for the scraper API |

---

## Database

- **Driver:** `@neondatabase/serverless` (HTTP/WebSocket-based, works in Edge and Node)
- **ORM:** Drizzle ORM
- **Migrations:** stored in `drizzle/` directory

### Schema files

| File | Contents |
|------|----------|
| `schemas/auth-schema.ts` | Users, sessions, API keys (Better Auth tables) |
| `schemas/blog.ts` | Blog posts, categories, settings, announcements |
| `schemas/sl-schema.ts` | SL master objects, object versions, instances, events, wearing sessions |
| `schemas/fertility-schema.ts` | Fertility system data tables |
| `schemas/rbac.ts` | Roles, permissions, and user-role assignments |
| `schemas/webhook.ts` | Webhook destinations, deliveries, and logs |

### DB commands

```bash
# Generate a new migration from schema changes
pnpm --filter @dabzsl/core db:generate

# Apply pending migrations
pnpm --filter @dabzsl/core db:migrate

# Push schema directly (no migration file — dev only)
pnpm --filter @dabzsl/core db:push

# Open Drizzle Studio
pnpm --filter @dabzsl/core db:studio
```

---

## Authentication

Uses [Better Auth](https://better-auth.com) with the following plugins active:

- **API keys** (`@better-auth/api-key`) — scoped API keys for creators and third-party integrations
- **Passkeys** (`@better-auth/passkey`) — WebAuthn support

Auth handler lives at `app/api/auth/[...all]/route.ts` and is configured in `lib/` (auth config file). Sessions are stored in the database via the Drizzle adapter.

---

## App Routes

| Route | Description |
|-------|-------------|
| `/` | Homepage (static, client-side account pill) |
| `/blog` | Public blog listing |
| `/blog/[slug]` | Individual blog post |
| `/marketplace` | Public SL Marketplace catalog |
| `/wearing` | HUD / wearing status public view |
| `/apps` | App portal |
| `/(auth)/sign-in` | Sign-in page |
| `/(auth)/sign-up` | Sign-up page |
| `/dashboard` | Authenticated user dashboard |
| `/dashboard/userprofile` | User profile settings |
| `/dashboard/apikeys` | API key management |
| `/dashboard/webhooks` | Webhook destination management |
| `/dashboard/blog` | Blog post editor (admin) |
| `/dashboard/admin` | Admin panel |
| `/dashboard/tools/marketplace/explorer` | Marketplace explorer tool |
| `/oauth` | OAuth callback handler |

---

## API Routes

### Public

| Endpoint | Description |
|----------|-------------|
| `GET /api/public/*` | Public data endpoints (no auth required) |

### Protected (session required)

| Endpoint | Description |
|----------|-------------|
| `GET /api/protected/*` | Authenticated user endpoints |

### Creator System (API key scoped)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/creator/*` | API key | SL creator system endpoints (object check-in, events, wearing) |
| `POST /api/sl/*` | API key | In-world Second Life LSL client endpoints |

### Admin

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET/POST /api/admin/*` | Session + admin role | Admin-only management endpoints |

### Webhooks

| Endpoint | Description |
|----------|-------------|
| `POST /api/webhooks/*` | Incoming webhook handlers (verified by HMAC) |

### Auth

| Endpoint | Description |
|----------|-------------|
| `ALL /api/auth/[...all]` | Better Auth handler |

---

## Features Overview

### Marketplace

Public catalog of Second Life Marketplace items stored in the database (seeded via the scraper CLI/API). Supports search, filtering, and item detail pages. The explorer tool in the dashboard provides admin-level data views.

### SL Creator System

Allows Second Life object creators to register scripted in-world objects (LSL scripts) and manage them via the API. Covers:

- Master object registration and versioning
- Instance check-in/heartbeat
- Event logging
- Wearing/usage tracking via the HUD
- Webhook delivery for object events

RBAC is partially enforced — see TODO section.

### Blog

Server-rendered blog with a markdown editor in the dashboard. Categories, visibility controls, and announcement settings are available.

### Webhooks

Outbound webhook system for delivering creator system events to user-configured HTTP endpoints. Includes delivery logs and retry logic.

### RBAC

Roles and permissions system built on top of Better Auth API keys. Role assignments live in `schemas/rbac.ts`.

---

## Scripts Reference

Run from `packages/core/` or prefix with `pnpm --filter @dabzsl/core` from the repo root.

| Script | Description |
|--------|-------------|
| `dev` | Start Next.js dev server on port 3000 |
| `dev:secure` | Start with experimental HTTPS |
| `build` | Production build (webpack) |
| `start` | Start production server |
| `lint` | Run ESLint |
| `typecheck` | Run `tsc --noEmit` |
| `db:generate` | Generate Drizzle migration |
| `db:migrate` | Apply pending migrations |
| `db:push` | Push schema directly (dev only) |
| `db:studio` | Open Drizzle Studio |
| `db:introspect` | Introspect existing DB schema |
| `analyze` | Bundle analysis build (`ANALYZE=true`) |

---

## Deployment

Deployed via Vercel. The `vercel.json` in `packages/core/` overrides the root config for package-level settings.

**Build environment requirements:**

- `NODE_ENV=production`
- All env vars from the [Environment Variables](#environment-variables) section must be set in the Vercel project settings.

**Build command used by Vercel (from repo root):**

```bash
pnpm install --frozen-lockfile && pnpm -r build
```

---

## Known Incomplete / TODO

### ASAP
- Remove tracked `packages/core/node_modules/.bin/*` files from git.
- Break up the heaviest route bundles — first-load JS is over 300 kB on `/dashboard/tools/marketplace/explorer`, `/dashboard/userprofile`, `/dashboard`, `/blog/[slug]`, and `/marketplace`.
- Add automated coverage for build-critical flows: homepage render, public blog, sitemap, auth/session, RBAC route handlers.
- Audit every API route and tighten caching/runtime to what is actually needed.

### High
- Finish RBAC and API-key scope enforcement end-to-end.
- Complete the remaining creator system pieces: LSL client reference flow, stronger data constraints, webhook event coverage, heartbeat/anomaly detection, and rollout/staging docs.
- Wire real error monitoring for App Router failures and background route issues (`src/app/error.tsx` has a TODO for this).
- Reduce client-side overfetching on the marketplace explorer and profile/admin surfaces.

### Medium
- Add a proper data-access layer for repeated public/blog/marketplace queries.
- Replace fallback-only resilience with observable operational behavior (alerting on degraded states).
- Add route-level performance budgets and bundle analysis checks in CI.
- Clean up long, mixed-responsibility page files in admin and marketplace areas.

### Low
- Refresh local setup docs and env var reference.
- Add staging seed data and example workflows for creator APIs, webhook testing, and marketplace moderation.

