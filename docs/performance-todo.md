# Performance Improvement Plan

Status: WIP

Owner: @ItzDabbzz

Goals

- Reduce initial JS/CSS payload
- Speed up list/render-heavy pages (Marketplace, Dashboard Explorer)
- Improve image loading and caching
- Harden server-side caching and DB performance

Quick wins (this week)

- [ ] Images: switch to `next/image` where possible; until domains are known, add `loading="lazy"` and `decoding="async"` to all `<img>` usages.
  - Files: `packages/core/app/marketplace/ClientExplorer.tsx`, `packages/core/app/dashboard/tools/marketplace/explorer/Explorer.tsx`, debug pages.
- [ ] Add bundle analyzer to find heavy routes.
  - Add `@next/bundle-analyzer` in `packages/core`, script `analyze`.
- [ ] Dynamic import heavy, rarely-used UI.
  - Syntax highlighting (`react-syntax-highlighter`) only when content has code. Files: `components/markdown.tsx`, `app/debug/*`.
- [ ] Use React Query for marketplace search results to get request dedupe/stale caching.
  - Replace manual fetch/setState with `useQuery` keyed by `q, sort, limit, category`.
- [ ] Consolidate toast system (use only Sonner).
  - Remove/stop exporting `components/ui/toast` + `components/ui/toaster` if unused.

Images and media

- [ ] Configure `next.config.js` images.remotePatterns for Second Life Marketplace/CDN hosts.
  - Collect sample hosts from `it.images[]` at runtime logs and add allowlist.
- [ ] Replace `<img>` with `<Image>` (Next) with proper sizes and blur placeholders.
- [ ] Add `<link rel="preconnect" />` to image/CDN hosts in `app/layout.tsx` once domains are known.

Rendering and UX

- [ ] Virtualize long result lists (grid/list) with `@tanstack/react-virtual` or `react-virtuoso`.
  - Files: `ClientExplorer.tsx`, `dashboard/tools/marketplace/explorer/Explorer.tsx`.
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
- [ ] Ensure `@dabzsl/shared` is tree-shakeable (set `"sideEffects": false` where appropriate).

Quality gates

- [ ] Add Lighthouse CI (or Vercel Analytics) budget checks in CI.
- [ ] Track Web Vitals (TTI/CLS/LCP) and real-user metrics.

Rollout plan

1) Land quick wins PR (images lazy+async, analyzer, todo cleanup)
2) Configure image domains and migrate to `next/image`
3) Introduce list virtualization in Marketplace
4) Adopt React Query for Marketplace search
5) DB/index review and API caching tags

Notes

- Marketplace pages currently use many raw `<img>` tags with `eslint-disable-next-line @next/next/no-img-element`. Replace after remotePatterns are known.
- Both Radix Toast and Sonner exist; standardize on Sonner (already mounted in `app/layout.tsx`).
