# dabz_sl

Monorepo for the Sanctum / Second Life toolchain.

## Packages

- `packages/core`: Next.js 15 app deployed to Vercel
- `packages/scraper-api`: scraper service and parsing helpers
- `packages/scraper-cli`: local scraper CLI
- `packages/shared-data`: shared workspace package

## Workspace Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
```

## Core App

The main product lives in `packages/core`.

- Local dev: `pnpm --filter @dabzsl/core dev`
- Production build: `pnpm --filter @dabzsl/core build`
- Local start: `pnpm --filter @dabzsl/core start`

See [packages/core/README.md](/mnt/dev/GitRepos/dabz_sl/packages/core/README.md) for structure, deployment notes, and the ranked TODO list.

## Deployment

`vercel.json` is configured for a Next.js build from the monorepo root.

- Install: `pnpm install --frozen-lockfile`
- Build: `pnpm -r build`
- Runtime target: `packages/core`
