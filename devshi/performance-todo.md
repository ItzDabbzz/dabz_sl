# Performance Improvement Plan

Status: WIP

Owner: @ItzDabbzz

Goals

- Reduce initial JS/CSS payload
- Speed up list/render-heavy pages (Marketplace, Dashboard Explorer)
- Improve image loading and caching
- Harden server-side caching and DB performance

Quick wins (this week)

- [x] Images: switch to `next/image` where possible; until domains are known, add `loading="lazy"` and `decoding="async"` to all `<img>` usages.
  - Done for Marketplace client, Dashboard Explorer, and logo component.
- [x] Add bundle analyzer to find heavy routes.
  - Added `@next/bundle-analyzer` and `analyze` script.
- [ ] Dynamic import heavy, rarely-used UI.
  - Syntax highlighting (`react-syntax-highlighter`) only when content has code. Files: `components/markdown.tsx`, `app/debug/*`.
- [ ] Use React Query for marketplace search results to get request dedupe/stale caching.
  - Replace manual fetch/setState with `useQuery` keyed by `q, sort, limit, category`.
- [x] Consolidate toast system (use only Sonner).
  - Marketplace client now uses Sonner; ActionToast migrated; legacy `ui/toast` and `ui/toaster` removed.

Images and media

- [x] Configure `next.config.js` images.remotePatterns for Second Life Marketplace/CDN hosts.
  - Added patterns for `marketplace.secondlife.com`, `*.secondlife.com`, `*.slm-assets.com`, `*.cloudfront.net`, `*.imgur.com`.
- [x] Replace `<img>` with `<Image>` (Next) with proper sizes and blur placeholders where practical.
  - Migrated Marketplace client media and modals to `next/image` with `sizes` and `fill`. Dashboard Explorer thumbnails and preview migrated.
- [x] Add `<link rel="preconnect" />` to image/CDN hosts in `app/layout.tsx` once domains are known.

Rendering and UX

- [x] Virtualize long result lists (grid/list) with `react-virtuoso`.
  - Implemented in Marketplace client for both grid and list with endReached pagination.
- [ ] Use `useDeferredValue` for search input text to reduce re-render pressure of derived UI.
- [ ] Memoize derived arrays (already partly done); audit with React Profiler.

Routing and caching

- [ ] Prefer static/ISR with personalization islands.
  - Keep public blog index static (`revalidate: 60` already); ensure per-user parts move to client where feasible.
- [ ] Add fetch caching/revalidate tags for internal API where safe (e.g., categories list).
- [ ] Audit `force-dynamic` usage; restrict to pages that genuinely need it.

Database (Neon + Drizzle)

- [ ] Review slow queries and add/adjust indexes.
  - Use Neon monitoring (pg_stat_statements) and Drizzle migrations. See `packages/core/drizzle/*.sql`.
- [ ] Tag revalidation after mutating server actions (`revalidateTag`, `revalidatePath`).

Build and tooling

- [ ] Remove `ignoreBuildErrors` once type issues are addressed to prevent shipping broken code.
- [ ] Run bundle analyzer regularly; split oversized route chunks with dynamic imports.

Quality gates

- [ ] Add Lighthouse CI (or Vercel Analytics) budget checks in CI.
- [ ] Track Web Vitals (TTI/CLS/LCP) and real-user metrics.

Rollout plan

1) Land quick wins PR (images lazy+async, analyzer, todo cleanup)
2) Configure image domains and migrate to `next/image` (done for Marketplace + Dashboard)
3) Introduce list virtualization in Marketplace (done)
4) Adopt React Query for Marketplace search
5) DB/index review and API caching tags

Notes

- Any `<img>` usage left is either email templates or will be migrated later when safe.
- Standardized on Sonner (mounted in `app/layout.tsx`); legacy Radix toasts removed.
- React Query complements Next features on the client: it dedupes, caches, and retries client-side requests. Keep server routes using Next fetch caching/ISR where applicable; use React Query only where UX benefits from client caching (e.g., search pagination, filters).
