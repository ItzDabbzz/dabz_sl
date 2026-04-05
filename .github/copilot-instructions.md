# Copilot / Assistant Instructions — merged

This file consolidates project-specific rules for this repo with canonical upstream guidance for Next.js, Tailwind, commenting, performance, and Copilot behavior. It is intended to guide automated assistants and human contributors so suggestions and edits are safe, minimal, and aligned with project conventions.

## Quick task receipt & plan
- What I'll do: produce a single, authoritative instructions file merging your repo rules and the referenced upstream guidance, remove duplication, and keep project-specific overrides.
- Outcome: updated `.github/copilot-instructions.md` in the repo root.

## Requirements checklist (kept visible)
- Use Next.js App Router conventions (no pages/). — Done
- Respect repo-level policies (monorepo, Drizzle, Scraper CLI, transpile packages). — Done
- Prefer TypeScript, shadcn UI, Tailwind patterns, and server components. — Done
- Apply upstream best-practices for Next.js, Tailwind, performance, commenting, and minimal Copilot behavior. — Done
- Include conventional commit guidance and a lightweight commit workflow. — Done
- Preserve "primacy of user directives" and surgical edits (do minimal necessary changes). — Done

## Core project rules (repo-specific)
- Monorepo layout: `packages/core` (Next.js App Router app), `packages/scraper-cli` (Playwright scraper), `packages/shared-data` (shared utilities/types).
- Use pnpm workspace and follow existing runbook. Install: `pnpm install`. Dev core: `pnpm --filter @dabzsl/core dev`.
- `packages/core` specifics:
  - App Router only. Keep server/client boundaries correct and colocate components as the repo expects.
  - Global CSS: `app/globals.css`. Middleware: `packages/core/middleware.ts`.
  - DB: use `packages/core/lib/db.ts` (singleton Drizzle/Neon instance). Import tables from `packages/core/schemas/*`.
  - Validation: prefer `zod` + `zod-openapi` in `packages/core/schemas/*`.
- Scraper CLI: entrypoint `packages/scraper-cli/src/index.ts` → `src/scrape.ts`. Login persists to `out/auth.json`. Follow documented CLI flags.

## High-level assistant principles (combined / canonical)
1. Primacy of user directives: explicit user commands take precedence over other rules.
2. Factual verification: when version-sensitive facts are needed, fetch authoritative docs.
3. Minimal, surgical edits: change the smallest amount of code to implement requested behavior.
4. Simplicity first: prefer simple, standard solutions. Avoid over-engineering.
5. Explain reasoning briefly when adding non-obvious changes.

## Next.js (App Router) best practices
- App Router is mandatory for all new routes and pages; do not use the legacy `pages/` router.
- Use Server Components by default for non-interactive UI and data fetching. Use `'use client'` at the top for Client Components.
- Never use `next/dynamic` with `{ ssr: false }` inside a Server Component. Instead, move client logic into a client component imported in the server component.
- Co-locate route-specific components, tests, and styles near the route. Use route groups (parentheses) for logical grouping without affecting URL paths.
- API route handlers: place under `app/api/*`; export HTTP verb functions (`GET`, `POST`, etc.). Validate inputs (use `zod`) and return appropriate status codes.
- Use `lib/` for shared utilities and `components/` for shared UI.

## Styling & Tailwind
- Use Tailwind CSS, mobile-first responsive design, and a consistent design system (shadcn/Radix patterns used in this repo).
- Prefer utility-first styling and keep styles predictable; use `globals.css` for shared rules.
- Implement dark mode, container-queries where appropriate, and optimize fonts/images (use next/image, next/font).

## Component & file conventions
- Files: `PascalCase` for components, `camelCase` for hooks/utilities, `kebab-case` for directories and assets.
- Props: use TypeScript interfaces, explicit props, and defaults where useful.
- For single-export files, default export the component; for related exports, use an `index.ts` barrel file.

## Commenting & self-documenting code
- Principle: prefer self-explanatory code. Comment WHY, not WHAT.
- Avoid obvious/redundant comments, outdated comments, and decorative dividers.
- Write comments for:
  - Complex business logic (explain why an algorithm/choice was made).
  - Non-obvious algorithms and regex patterns.
  - External API constraints, performance assumptions, security caveats.
- Use TODO/FIXME/HACK/NOTE/PERF/SECURITY tags sparingly and accurately.
- For public APIs use JSDoc/TSDoc for parameter and return descriptions.

## Performance guidance (short checklist)
- Measure before optimizing. Use profiling tools (DevTools, Lighthouse, k6, etc.).
- Optimize for the common case. Avoid premature optimization.
- Frontend: minimize bundle sizes, lazy load noncritical JS, `loading="lazy"` for images, use modern image formats (WebP/AVIF), use `React.memo`/`useMemo`/`useCallback` where appropriate.
- Backend: use async I/O, batch DB operations, caching (Redis) with proper invalidation, monitor slow queries.
- Database: add indexes for frequent filters/joins, avoid SELECT *, watch for N+1 queries.
- CI: include simple performance checks and set budgets for regressions when feasible.

## Taming Copilot / assistant behavior (practical rules)
- Default language: TypeScript for this repo. Prefer interfaces over types for props where the project convention uses interfaces.
- Minimal code by default: produce the smallest working change. Avoid global refactors unless requested.
- Preserve style and structure of existing code. Do not reformat unrelated files.
- When editing code in the repo, apply changes directly (via PR or local edit) rather than pasting large snippets unless asked otherwise.
- Run/build/test after edits when possible and report result (quick smoke test or typecheck). Keep changes green.

## Process & logging (thought-logging and execution)
- Follow a concise plan for multi-step work. State the immediate intent before using tools.
- Avoid flooding the user with repeated status updates; provide concise progress checkpoints after groups of actions.
- Do not output internal step-by-step Thought logs in user-facing messages. Keep internal reasoning internal, but provide short explanations for design choices.
- If the user asks to run a strict "phase-based" thought-logging workflow (the `copilot-thought-logging` phases), follow those phases only when explicitly requested; otherwise prefer the standard concise progress updates described above.

## Conventional commits (lightweight guidance)
- Use Conventional Commits format for automated commit workflows: `type(scope): short-description`.
- Common types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
- Use `!` in the type to indicate BREAKING CHANGE and add details in the body/footer.
- Keep the description imperative and concise. Include body and footer when additional context, breaking changes, or issue references are required.

## Safety, security, and code reviews
- Never commit secrets. Use `.env` files and secret stores.
- Validate and sanitize all external input. Protect API routes with authentication and rate limiting as required.
- Add tests for critical logic and include typechecks (`pnpm typecheck`) and lint (`pnpm lint`) in CI.

## Quality gates (short)
- After edits: Build / Typecheck / Run unit tests (where applicable). Report PASS/FAIL briefly.
- If build/tests fail, attempt up to two quick targeted fixes; if unresolved, summarize root cause and next steps.

## Small proactive improvements (when safe)
- When implementing requested features, add minimal tests (happy path + 1 edge case) if it is low risk.
- Add README updates or small docs for new public APIs or major behaviors added.

## Where to look for context in this repo
- `packages/core/app` — Next.js App Router app and API routes.
- `packages/core/lib/db.ts` — Drizzle/Neon DB instance.
- `packages/core/schemas` — Zod/Drizzle schemas.
- `packages/scraper-cli/src` — Scraper logic.

## If you need to fetch upstream docs
- Prefer official docs (Next.js, Tailwind, React) and canonical sources. When fetching, state the specific doc you retrieved and why it was needed.

---

This merged guidance keeps the repository's strict conventions (App Router, Drizzle, pnpm monorepo) while adopting canonical upstream best-practices for Next.js, Tailwind, commenting, performance, and assistant behavior. If you want a variant that strictly enforces phase-by-phase copilot thought-logging or auto-committing behavior, tell me which parts to enforce and I will produce an alternate file that enforces them verbatim.