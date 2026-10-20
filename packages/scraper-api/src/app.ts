/**
 * Production Express application for scraper-api.
 *
 * Security layers (in order):
 *   1. CORS — only allows origins in ALLOWED_ORIGINS
 *   2. Rate limiter — 20 requests / minute per IP
 *   3. API-key auth middleware — checks Authorization: Bearer <key>
 *   4. Zod body validation on POST /api/scrape
 */

import cors from 'cors';
import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { scrapeUrl } from './lib.js';
import { scrapeStore } from './scrape-store.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const API_KEY = process.env['SCRAPER_API_KEY'] ?? '';

/** Origins allowed to call this API. Add staging/preview URLs as needed. */
const ALLOWED_ORIGINS: string[] = [
  'https://sl.itzdabbzz.me',
  ...(process.env['EXTRA_ORIGINS'] ? process.env['EXTRA_ORIGINS'].split(',') : []),
];

if (process.env['NODE_ENV'] !== 'production') {
  // Allow localhost during development
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:5173');
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    // If no key is configured treat the server as open (useful in dev).
    next();
    return;
  }

  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (token !== API_KEY) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app: Application = express();

app.set('trust proxy', 1);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser requests (curl, server-to-server) when no Origin header
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin not allowed — ${origin}`));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

app.use(express.json());

app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { ok: false, error: 'Too many requests — try again in a minute.' },
  }),
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Health check — no auth required so load-balancers / uptime monitors can probe it. */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, version: process.env['npm_package_version'] ?? 'unknown' });
});

/** Scrape a single SL Marketplace product page. */
const scrapeBodySchema = z.object({
  url: z.string().url().startsWith('https://marketplace.secondlife.com/'),
  timeout: z.number().int().min(5_000).max(120_000).optional(),
  navTimeout: z.number().int().min(5_000).max(120_000).optional(),
  blockAssets: z.boolean().optional(),
});

app.post('/api/scrape', apiKeyAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = scrapeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.flatten() });
    return;
  }

  const { url, timeout, navTimeout, blockAssets } = parsed.data;

  try {
    const item = await scrapeUrl(url, { timeout, navTimeout, blockAssets });
    res.json({ ok: true, data: item });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scrape] failed for ${url}: ${message}`);
    res.status(500).json({ ok: false, error: message });
  }
});

/** Scrape every product in an SL Marketplace store. */
const storeBodySchema = z.object({
  store: z.string().min(1).describe('Store id or store URL, e.g. 199625'),
  /** Enumerate the listing only; do not visit product pages. */
  listingOnly: z.boolean().optional(),
  /** Cap the number of listing pages to enumerate. */
  maxPages: z.number().int().min(1).max(200).optional(),
  /** Product pages fetched in parallel. */
  concurrency: z.number().int().min(1).max(4).optional(),
  /** Minimum milliseconds between any two requests. */
  minDelayMs: z.number().int().min(250).max(60_000).optional(),
  timeout: z.number().int().min(5_000).max(120_000).optional(),
  navTimeout: z.number().int().min(5_000).max(120_000).optional(),
  blockAssets: z.boolean().optional(),
});

app.post('/api/scrape/store', apiKeyAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = storeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.flatten() });
    return;
  }

  const { store, listingOnly, maxPages, concurrency, minDelayMs, timeout, navTimeout, blockAssets } =
    parsed.data;

  try {
    const result = await scrapeStore(store, {
      listingOnly,
      maxPages,
      concurrency,
      minDelayMs,
      timeout,
      navTimeout,
      blockAssets,
    });

    // A throttled origin is not a server fault — report it as 429 so callers
    // can back off rather than retrying into a block.
    if (result.aborted) {
      res.status(429).json({ ok: false, error: result.aborted, data: result });
      return;
    }

    res.json({ ok: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scrape/store] failed for ${store}: ${message}`);
    res.status(500).json({ ok: false, error: message });
  }
});

// ---------------------------------------------------------------------------
// 404 catch-all
// ---------------------------------------------------------------------------
app.use((_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// ---------------------------------------------------------------------------
// Exports — index.ts calls app.listen(); tests can import app directly.
// ---------------------------------------------------------------------------
export { app, PORT };
