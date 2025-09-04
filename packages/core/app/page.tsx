import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { mpCategories, mpItemCategories, mpItems } from "@/schemas/sl-schema";
import { count, sql } from "drizzle-orm";
import WebBg from "@/components/web-bg";
import { LogoutButton } from "@/components/logout-button";

// Real session fetcher (returns null if not logged in)
async function getSession() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        return session;
    } catch {
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

async function fetchText(
    url: string,
    timeoutMs = 8000,
): Promise<string | null> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            cache: "no-store",
            signal: ctrl.signal,
        });
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
const getMarketplaceStats = unstable_cache(
    async (): Promise<MarketplaceStats> => {
        const [{ value: totalItems }] = (await db
            .select({ value: count() })
            .from(mpItems)) as any;
        const [{ value: totalCategories }] = (await db
            .select({ value: count() })
            .from(mpCategories)) as any;
        const [{ value: distinctPrimaries }] = (await db
            .select({
                value: sql<number>`count(distinct ${mpCategories.primary})`,
            })
            .from(mpCategories)) as any;
        const [{ value: distinctSubs }] = (await db
            .select({ value: sql<number>`count(distinct ${mpCategories.sub})` })
            .from(mpCategories)) as any;
        const [{ value: itemsWithCategories }] = (await db
            .select({
                value: sql<number>`count(distinct ${mpItemCategories.itemId})`,
            })
            .from(mpItemCategories)) as any;
        const uncategorizedItems = Math.max(
            0,
            Number(totalItems || 0) - Number(itemsWithCategories || 0),
        );
        const [{ value: lastItemUpdateIso }] = (await db
            .select({
                value: sql<string>`coalesce(max(${mpItems.updatedAt}), max(${mpItems.createdAt}))`,
            })
            .from(mpItems)) as any;
        return {
            totalItems: Number(totalItems || 0),
            totalCategories: Number(totalCategories || 0),
            distinctPrimaries: Number(distinctPrimaries || 0),
            distinctSubs: Number(distinctSubs || 0),
            itemsWithCategories: Number(itemsWithCategories || 0),
            uncategorizedItems,
            lastItemUpdateIso: lastItemUpdateIso
                ? String(lastItemUpdateIso)
                : null,
        };
    },
    ["marketplace:stats"],
    { revalidate: 600, tags: ["marketplace:stats"] },
);

type LindexWindow = {
    min_rate?: number;
    max_rate?: number;
    l_volume?: number;
    us_volume?: number;
};

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
    limit_buy_best_10?: {
        min_rate?: number;
        max_rate?: number;
        l_offered?: number;
    };
    limit_sell_best_10?: {
        min_rate?: number;
        max_rate?: number;
        l_offered?: number;
    };
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

async function getLiveData(): Promise<{
    home: HomeFeed | null;
    lindex: LindexFeed | null;
}> {
    const [homeTxt, lindexTxt] = await Promise.all([
        fetchText("https://api.secondlife.com/datafeeds/homepage.txt"),
        fetchText("https://api.secondlife.com/datafeeds/lindex.txt"),
    ]);
    const home = homeTxt ? mapHomeFeed(parseKeyValueText(homeTxt)) : null;
    const lindex = lindexTxt
        ? mapLindexFeed(parseKeyValueText(lindexTxt))
        : null;
    return { home, lindex };
}

function formatNumber(n?: number) {
    if (n == null) return "—";
    return new Intl.NumberFormat("en-US").format(n);
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
    const [session, live, mpStats] = await Promise.all([
        getSession(),
        getLiveData(),
        getMarketplaceStats(),
    ]);
    const home = live.home;
    const lindex = live.lindex;

    return (
        <div className="relative min-h-[100svh] w-full overflow-hidden bg-gradient-to-b from-background via-background to-background">
            {/* Framer Motion Aurora */}
            <WebBg />

            {/* Floating minimal user header */}
            <div className="fixed top-4 right-4 z-50">
                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs shadow backdrop-blur">
                    {session && (session as any).user ? (
                        <>
                            <span className="hidden sm:inline text-muted-foreground">
                                Signed in as
                            </span>
                            <span className="font-medium">
                                {(session as any).user.name ||
                                    (session as any).user.email ||
                                    "User"}
                            </span>
                            <Button asChild size="sm" variant="outline">
                                <Link href="/dashboard">Dashboard</Link>
                            </Button>
                            <LogoutButton size="sm" variant="outline" label="Sign out" />
                        </>
                    ) : (
                        <>
                            <span className="hidden sm:inline text-muted-foreground">
                                You are not signed in
                            </span>
                            <Button asChild size="sm" variant="outline">
                                <Link href="/sign-in">Sign in</Link>
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <main className="relative mx-auto flex min-h-[100svh] max-w-[90rem] flex-col items-center justify-center gap-5 px-6 text-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    Live Alpha
                </span>

                <h1 className="text-balance font-extrabold tracking-tight text-3xl sm:text-4xl md:text-5xl">
                    The Sanctum Realms Project
                </h1>
                <p className="text-balance max-w-3xl text-sm sm:text-base text-muted-foreground">
                    A sleek suite of utilities crafted by Dabz. Authenticate to
                    explore dashboards, manage objects, webhooks, API keys, and
                    more.
                </p>

                <div className="relative mt-2">
                    <div
                        className={cn(
                            "bg-card/70 backdrop-blur-xl border border-border/60 shadow-2xl",
                            "rounded-2xl px-4 py-3 sm:px-5 sm:py-4 flex flex-col items-center gap-2 w-[90vw] max-w-md",
                        )}
                    >
                        {/* Clean public navigation buttons */}
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <Button asChild>
                                <Link href="/marketplace">Marketplace</Link>
                            </Button>
                            <Button asChild>
                                <Link href="/blog">Blog</Link>
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

                {/* Stats: Side-by-side on large screens */}
                <section className="mt-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Live Stats */}
                    <div className="text-left">
                        <div className="mb-2.5 flex items-center justify-between">
                            <h2 className="text-base sm:text-lg font-bold tracking-tight">
                                Live Second Life
                            </h2>
                            <Badge variant="outline" className="text-[10px]">
                                Linden Lab
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
                            <Card className="h-[180px]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        In-world now
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Currently logged-in residents
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="text-2xl font-extrabold">
                                        {formatNumber(home?.inworld)}
                                    </div>
                                    <div className="mt-1">
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px]"
                                        >
                                            Updated{" "}
                                            {timeAgoFromUnix(
                                                home?.inworld_updated_unix,
                                            )}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="h-[180px]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Total residents
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Accounts open and in good standing
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="text-2xl font-extrabold">
                                        {formatNumber(home?.signups)}
                                    </div>
                                    <div className="mt-1">
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px]"
                                        >
                                            Updated{" "}
                                            {timeAgoFromUnix(
                                                home?.signups_updated_unix,
                                            )}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="h-[180px]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Exchange rate
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Average L$ per US$
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="text-lg font-bold">
                                        {home?.exchange_rate
                                            ? `${home.exchange_rate.toFixed(2)} L$ / 1 US$`
                                            : "—"}
                                    </div>
                                    <div className="mt-1">
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px]"
                                        >
                                            Updated{" "}
                                            {timeAgoFromUnix(
                                                home?.exchange_rate_updated_unix,
                                            )}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="h-[180px]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Market Buy (1d)
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Completed volume and rates
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-2 pt-0 text-xs">
                                    <div>
                                        <div className="text-muted-foreground">
                                            Min–Max
                                        </div>
                                        <div className="font-semibold">
                                            {lindex?.market_buy?.one_day
                                                ?.min_rate ?? "—"}
                                            –
                                            {lindex?.market_buy?.one_day
                                                ?.max_rate ?? "—"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">
                                            USD Volume
                                        </div>
                                        <div className="font-semibold">
                                            $
                                            {formatNumber(
                                                lindex?.market_buy?.one_day
                                                    ?.us_volume,
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="h-[180px]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Market Sell (1d)
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Completed volume and rates
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-2 pt-0 text-xs">
                                    <div>
                                        <div className="text-muted-foreground">
                                            Min–Max
                                        </div>
                                        <div className="font-semibold">
                                            {lindex?.market_sell?.one_day
                                                ?.min_rate ?? "—"}
                                            –
                                            {lindex?.market_sell?.one_day
                                                ?.max_rate ?? "—"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">
                                            USD Volume
                                        </div>
                                        <div className="font-semibold">
                                            $
                                            {formatNumber(
                                                lindex?.market_sell?.one_day
                                                    ?.us_volume,
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="h-[180px]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Order Book (Best 10%)
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Limit orders snapshot
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-3 pt-0 text-xs">
                                    <div>
                                        <div className="text-muted-foreground mb-1">
                                            Limit Buy
                                        </div>
                                        <div className="font-semibold">
                                            {lindex?.limit_buy_best_10
                                                ?.min_rate ?? "—"}
                                            –
                                            {lindex?.limit_buy_best_10
                                                ?.max_rate ?? "—"}
                                        </div>
                                        <div className="text-muted-foreground">
                                            L$ offered:{" "}
                                            {formatNumber(
                                                lindex?.limit_buy_best_10
                                                    ?.l_offered,
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground mb-1">
                                            Limit Sell
                                        </div>
                                        <div className="font-semibold">
                                            {lindex?.limit_sell_best_10
                                                ?.min_rate ?? "—"}
                                            –
                                            {lindex?.limit_sell_best_10
                                                ?.max_rate ?? "—"}
                                        </div>
                                        <div className="text-muted-foreground">
                                            L$ offered:{" "}
                                            {formatNumber(
                                                lindex?.limit_sell_best_10
                                                    ?.l_offered,
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Badge variant="outline" className="text-[10px]">
                                Homepage updated{" "}
                                {timeAgoFromUnix(
                                    home?.inworld_updated_unix ||
                                        home?.signups_updated_unix ||
                                        home?.exchange_rate_updated_unix,
                                )}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                                LindeX updated{" "}
                                {timeAgoFromUnix(lindex?.updated_unix)}
                            </Badge>
                            <a
                                className="underline underline-offset-4 hover:no-underline"
                                href="https://wiki.secondlife.com/wiki/Linden_Lab_Official:Live_Data_Feeds"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Source
                            </a>
                        </div>
                    </div>

                    {/* Marketplace Stats */}
                    <div className="text-left">
                        <div className="mb-2.5 flex items-center justify-between">
                            <h2 className="text-base sm:text-lg font-bold tracking-tight">
                                Marketplace
                            </h2>
                            <Badge variant="outline" className="text-[10px]">
                                Cached ~10m
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
                            <Card className="h-[180px]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Total items
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        All imported listings
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="text-2xl font-extrabold">
                                        {formatNumber(mpStats.totalItems)}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="h-[180px]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Total categories
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Primary + sub combinations
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="text-2xl font-extrabold">
                                        {formatNumber(mpStats.totalCategories)}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="h-[180px]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Primary groups
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Distinct primary labels
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="text-2xl font-extrabold">
                                        {formatNumber(
                                            mpStats.distinctPrimaries,
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="h-[180px]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Subcategories
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Distinct sub labels
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="text-2xl font-extrabold">
                                        {formatNumber(mpStats.distinctSubs)}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="h-[180px]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Categorized items
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Items linked to any category
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="text-2xl font-extrabold">
                                        {formatNumber(
                                            mpStats.itemsWithCategories,
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="h-[180px]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Uncategorized
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Items needing review
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="text-2xl font-extrabold">
                                        {formatNumber(
                                            mpStats.uncategorizedItems,
                                        )}
                                    </div>
                                    <div className="mt-1">
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px]"
                                        >
                                            Last change{" "}
                                            {timeAgoFromIso(
                                                mpStats.lastItemUpdateIso,
                                            )}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </section>

                {/* Footer copyright */}
                <footer className="mt-6 w-full">
                    <div className="mx-auto max-w-[90rem] px-2 sm:px-6 py-4 text-xs sm:text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between border-t border-border/60">
                        <span>
                            © {new Date().getFullYear()} DABZ · aka ItzDabbzz
                        </span>
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
