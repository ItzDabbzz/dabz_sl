import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { SignInButton, SignInFallback } from "@/components/sign-in-btn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { mpCategories, mpItemCategories, mpItems } from "@/schemas/sl-schema";
import { count, sql } from "drizzle-orm";

// Real session fetcher (returns null if not logged in)
async function getSession() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session;
  } catch (e) {
    return null;
  }
}

// --- Live Data (Second Life) ---
function parseKeyValueText(text: string): Record<string, string> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const out: Record<string, string> = {};
  for (let i = 0; i < lines.length - 1; i += 2) {
    out[lines[i]] = lines[i + 1];
  }
  return out;
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

type HomeFeed = {
  signups?: number;
  signups_updated_unix?: number;
  signups_updated_slt?: string;
  inworld?: number;
  inworld_updated_unix?: number;
  inworld_updated_slt?: string;
  exchange_rate?: number;
  exchange_rate_updated_unix?: number;
  exchange_rate_updated_slt?: string;
};

// Marketplace stats type
type MarketplaceStats = {
  totalItems: number;
  totalCategories: number;
  distinctPrimaries: number;
  distinctSubs: number;
  itemsWithCategories: number;
  uncategorizedItems: number;
  lastItemUpdateIso: string | null;
};

// Cached stats (10 min)
const getMarketplaceStats = unstable_cache(async (): Promise<MarketplaceStats> => {
  const [{ value: totalItems }] = (await db.select({ value: count() }).from(mpItems)) as any;
  const [{ value: totalCategories }] = (await db.select({ value: count() }).from(mpCategories)) as any;
  const [{ value: distinctPrimaries }] = (await db
    .select({ value: sql<number>`count(distinct ${mpCategories.primary})` })
    .from(mpCategories)) as any;
  const [{ value: distinctSubs }] = (await db
    .select({ value: sql<number>`count(distinct ${mpCategories.sub})` })
    .from(mpCategories)) as any;
  const [{ value: itemsWithCategories }] = (await db
    .select({ value: sql<number>`count(distinct ${mpItemCategories.itemId})` })
    .from(mpItemCategories)) as any;
  const uncategorizedItems = Math.max(0, Number(totalItems || 0) - Number(itemsWithCategories || 0));
  const [{ value: lastItemUpdateIso }] = (await db
    .select({ value: sql<string>`coalesce(max(${mpItems.updatedAt}), max(${mpItems.createdAt}))` })
    .from(mpItems)) as any;
  return {
    totalItems: Number(totalItems || 0),
    totalCategories: Number(totalCategories || 0),
    distinctPrimaries: Number(distinctPrimaries || 0),
    distinctSubs: Number(distinctSubs || 0),
    itemsWithCategories: Number(itemsWithCategories || 0),
    uncategorizedItems,
    lastItemUpdateIso: lastItemUpdateIso ? String(lastItemUpdateIso) : null,
  };
}, ["marketplace:stats"], { revalidate: 600, tags: ["marketplace:stats"] });

type LindexWindow = { min_rate?: number; max_rate?: number; l_volume?: number; us_volume?: number };

type LindexFeed = {
  updated_unix?: number;
  updated_slt?: string;
  market_buy?: {
    one_hour?: LindexWindow;
    one_day?: LindexWindow;
    today?: LindexWindow;
  };
  market_sell?: {
    one_hour?: LindexWindow;
    one_day?: LindexWindow;
    today?: LindexWindow;
  };
  limit_buy_best_10?: { min_rate?: number; max_rate?: number; l_offered?: number };
  limit_sell_best_10?: { min_rate?: number; max_rate?: number; l_offered?: number };
};

function toNum(v?: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function mapHomeFeed(map: Record<string, string>): HomeFeed {
  return {
    signups: toNum(map["signups"]),
    signups_updated_unix: toNum(map["signups_updated_unix"]),
    signups_updated_slt: map["signups_updated_slt"],
    inworld: toNum(map["inworld"]),
    inworld_updated_unix: toNum(map["inworld_updated_unix"]),
    inworld_updated_slt: map["inworld_updated_slt"],
    exchange_rate: toNum(map["exchange_rate"]),
    exchange_rate_updated_unix: toNum(map["exchange_rate_updated_unix"]),
    exchange_rate_updated_slt: map["exchange_rate_updated_slt"],
  };
}

function mapLindexFeed(map: Record<string, string>): LindexFeed {
  const getWin = (prefix: string): LindexWindow => ({
    min_rate: toNum(map[`${prefix}_min_rate`]),
    max_rate: toNum(map[`${prefix}_max_rate`]),
    l_volume: toNum(map[`${prefix}_l$`]),
    us_volume: toNum(map[`${prefix}_us$`]),
  });
  return {
    updated_unix: toNum(map["updated_unix"]),
    updated_slt: map["updated_slt"],
    market_buy: {
      one_hour: getWin("mb_1h"),
      one_day: getWin("mb_1d"),
      today: getWin("mb_t"),
    },
    market_sell: {
      one_hour: getWin("ms_1h"),
      one_day: getWin("ms_1d"),
      today: getWin("ms_t"),
    },
    limit_buy_best_10: {
      min_rate: toNum(map["lb_10%_min_rate"]),
      max_rate: toNum(map["lb_10%_max_rate"]),
      l_offered: toNum(map["lb_10%_l$_offer"]),
    },
    limit_sell_best_10: {
      min_rate: toNum(map["ls_10%_min_rate"]),
      max_rate: toNum(map["ls_10%_max_rate"]),
      l_offered: toNum(map["ls_10%_l$_offer"]),
    },
  };
}

async function getLiveData(): Promise<{ home: HomeFeed | null; lindex: LindexFeed | null }> {
  const [homeTxt, lindexTxt] = await Promise.all([
    fetchText("https://api.secondlife.com/datafeeds/homepage.txt"),
    fetchText("https://api.secondlife.com/datafeeds/lindex.txt"),
  ]);
  const home = homeTxt ? mapHomeFeed(parseKeyValueText(homeTxt)) : null;
  const lindex = lindexTxt ? mapLindexFeed(parseKeyValueText(lindexTxt)) : null;
  return { home, lindex };
}

function formatNumber(n?: number) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function formatRate(n?: number) {
  if (n == null) return "—";
  return `${n} L$ / 1 US$`;
}

function timeAgoFromUnix(unix?: number) {
  if (!unix) return "n/a";
  const ms = unix * 1000;
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

// Helper for ISO string dates
function timeAgoFromIso(iso?: string | null) {
  if (!iso) return "n/a";
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "n/a";
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export default async function Home() {
  const [session, live, mpStats] = await Promise.all([getSession(), getLiveData(), getMarketplaceStats()]);
  const home = live.home;
  const lindex = live.lindex;

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-gradient-to-b from-background via-background to-background">
      {/* Floating minimal user header */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs shadow backdrop-blur">
          {session && (session as any).user ? (
            <>
              <span className="hidden sm:inline text-muted-foreground">Signed in as</span>
              <span className="font-medium">
                {(session as any).user.name || (session as any).user.email || "User"}
              </span>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <span className="hidden sm:inline text-muted-foreground">You are not signed in</span>
              <Button asChild size="sm" variant="outline">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Animated aurora / gradient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[40rem] w-[40rem] rounded-full bg-primary/20 blur-3xl opacity-40 animate-pulse" />
        <div className="absolute -bottom-40 right-0 h-[32rem] w-[32rem] rounded-full bg-secondary/20 blur-3xl opacity-40 animate-[pulse_10s_ease-in-out_infinite]" />
      </div>

      <main className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col items-center justify-center gap-10 px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Live Alpha
        </span>

        <h1 className="text-balance font-extrabold tracking-tight text-4xl sm:text-6xl md:text-7xl">
          Tools for your Second Life
        </h1>
        <p className="text-balance max-w-2xl text-base sm:text-lg text-muted-foreground">
          A sleek suite of utilities crafted by Dabz. Authenticate to explore dashboards, manage objects, webhooks, API keys, and more.
        </p>

        <div className="relative mt-2">
          <div
            className={cn(
              "bg-card/70 backdrop-blur-xl border border-border/60 shadow-2xl",
              "rounded-2xl px-6 py-5 sm:px-8 sm:py-6 flex flex-col items-center gap-3 w-[90vw] max-w-md"
            )}
          >
            {/* Clean public navigation buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link href="/marketplace">Marketplace</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/api-docs">API Docs</Link>
              </Button>
              {session && (session as any).user ? (
                <Button asChild variant="secondary">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Feature bullets */}
        <ul className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          {["Master Objects", "Instances", "API Keys"].map((t) => (
            <li key={t} className="rounded-xl border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground backdrop-blur hover:bg-muted/30 transition">
              {t}
            </li>
          ))}
        </ul>

        {/* Live Stats */}
        <section className="mt-10 w-full text-left">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Live Second Life stats</h2>
            <Badge variant="outline" className="text-xs">Data by Linden Lab</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>In-world now</CardTitle>
                <CardDescription>Currently logged-in residents</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-extrabold">{formatNumber(home?.inworld)}</div>
                <div className="mt-2">
                  <Badge variant="secondary" className="text-[11px]">Updated {timeAgoFromUnix(home?.inworld_updated_unix)}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total residents</CardTitle>
                <CardDescription>Accounts open and in good standing</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-extrabold">{formatNumber(home?.signups)}</div>
                <div className="mt-2">
                  <Badge variant="secondary" className="text-[11px]">Updated {timeAgoFromUnix(home?.signups_updated_unix)}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exchange rate</CardTitle>
                <CardDescription>Average L$ per US$</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">{home?.exchange_rate ? `${home.exchange_rate.toFixed(2)} L$ / 1 US$` : "—"}</div>
                <div className="mt-2">
                  <Badge variant="secondary" className="text-[11px]">Updated {timeAgoFromUnix(home?.exchange_rate_updated_unix)}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Market Buy (1d)</CardTitle>
                <CardDescription>Completed volume and rates</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 pt-0 text-sm">
                <div>
                  <div className="text-muted-foreground">Min–Max</div>
                  <div className="font-semibold">{lindex?.market_buy?.one_day?.min_rate ?? "—"}–{lindex?.market_buy?.one_day?.max_rate ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">USD Volume</div>
                  <div className="font-semibold">${formatNumber(lindex?.market_buy?.one_day?.us_volume)}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Market Sell (1d)</CardTitle>
                <CardDescription>Completed volume and rates</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 pt-0 text-sm">
                <div>
                  <div className="text-muted-foreground">Min–Max</div>
                  <div className="font-semibold">{lindex?.market_sell?.one_day?.min_rate ?? "—"}–{lindex?.market_sell?.one_day?.max_rate ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">USD Volume</div>
                  <div className="font-semibold">${formatNumber(lindex?.market_sell?.one_day?.us_volume)}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Book (Best 10%)</CardTitle>
                <CardDescription>Limit orders snapshot</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 pt-0 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Limit Buy</div>
                  <div className="font-semibold">{lindex?.limit_buy_best_10?.min_rate ?? "—"}–{lindex?.limit_buy_best_10?.max_rate ?? "—"}</div>
                  <div className="text-muted-foreground">L$ offered: {formatNumber(lindex?.limit_buy_best_10?.l_offered)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Limit Sell</div>
                  <div className="font-semibold">{lindex?.limit_sell_best_10?.min_rate ?? "—"}–{lindex?.limit_sell_best_10?.max_rate ?? "—"}</div>
                  <div className="text-muted-foreground">L$ offered: {formatNumber(lindex?.limit_sell_best_10?.l_offered)}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">Homepage updated {timeAgoFromUnix(home?.inworld_updated_unix || home?.signups_updated_unix || home?.exchange_rate_updated_unix)}</Badge>
            <Badge variant="outline" className="text-[10px]">LindeX updated {timeAgoFromUnix(lindex?.updated_unix)}</Badge>
            <a className="underline underline-offset-4 hover:no-underline" href="https://wiki.secondlife.com/wiki/Linden_Lab_Official:Live_Data_Feeds" target="_blank" rel="noopener noreferrer">Source</a>
          </div>
        </section>

        {/* Marketplace Stats */}
        <section className="mt-10 w-full text-left">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Marketplace stats</h2>
            <Badge variant="outline" className="text-xs">Cached ~10m</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Total items</CardTitle>
                <CardDescription>All imported listings</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-extrabold">{formatNumber(mpStats.totalItems)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total categories</CardTitle>
                <CardDescription>Primary + sub combinations</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-extrabold">{formatNumber(mpStats.totalCategories)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Primary groups</CardTitle>
                <CardDescription>Distinct primary labels</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-extrabold">{formatNumber(mpStats.distinctPrimaries)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subcategories</CardTitle>
                <CardDescription>Distinct sub labels</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-extrabold">{formatNumber(mpStats.distinctSubs)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Categorized items</CardTitle>
                <CardDescription>Items linked to any category</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-extrabold">{formatNumber(mpStats.itemsWithCategories)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Uncategorized</CardTitle>
                <CardDescription>Items needing review</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-extrabold">{formatNumber(mpStats.uncategorizedItems)}</div>
                <div className="mt-2">
                  <Badge variant="secondary" className="text-[11px]">Last change {timeAgoFromIso(mpStats.lastItemUpdateIso)}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer copyright */}
        <footer className="mt-10 w-full">
          <div className="mx-auto max-w-6xl px-2 sm:px-6 py-6 text-xs sm:text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between border-t border-border/60">
            <span>© {new Date().getFullYear()} DABZ · aka ItzDabbzz</span>
            <div className="mt-2 sm:mt-0 flex items-center gap-4">
              <a
                href="https://itzdabbzz.me"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:no-underline"
              >
                itzdabbzz.me
              </a>
              <a
                href="https://github.com/itzdabbzz/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:no-underline"
              >
                github.com/itzdabbzz
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
