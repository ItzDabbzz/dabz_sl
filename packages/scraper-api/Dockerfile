# ────────────────────────────────────────────────────────────────────────────
# Stage 1: builder — compile TypeScript in a full Node environment
# ────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /build

# Install pnpm
RUN npm install -g pnpm@latest

# Copy workspace manifests so pnpm can hoist deps correctly
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/scraper-api/package.json ./packages/scraper-api/

# Install ALL workspace deps (including devDeps needed by tsc)
RUN pnpm install --frozen-lockfile

# Copy source and compile
COPY packages/scraper-api/tsconfig.json ./packages/scraper-api/
COPY packages/scraper-api/src/           ./packages/scraper-api/src/

RUN pnpm --filter @dabzsl/scraper-api build

# ────────────────────────────────────────────────────────────────────────────
# Stage 2: runtime — Playwright base already includes Chromium + all deps
# ────────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.59.1-noble AS runtime

WORKDIR /app

# Install pnpm (needed to install production-only deps)
RUN npm install -g pnpm@latest

# Copy workspace manifests and production deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/scraper-api/package.json ./packages/scraper-api/

# Install production deps only — skip devDependencies
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder stage
COPY --from=builder /build/packages/scraper-api/dist ./packages/scraper-api/dist

WORKDIR /app/packages/scraper-api

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
