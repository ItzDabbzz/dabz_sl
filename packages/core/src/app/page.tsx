import Link from "next/link";
import { cn } from "@/lib/utils";
import { getMarketplaceStats, getSecondLifeSnapshot } from "@/features/public/home/server/site-stats";
import HomeAccountPill from "@/features/auth/profile/components/home-account-pill";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SanctumBg from "@/features/public/home/components/sanctum-bg";

export const revalidate = 300;

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
    const [live, mpStats] = await Promise.all([getSecondLifeSnapshot(), getMarketplaceStats()]);
    const home = live.home;
    const lindex = live.lindex;

    return (
        <div className="relative min-h-[100svh] w-full overflow-hidden bg-gradient-to-b from-background via-background to-background">
            {/* Sanctum cathedral background */}
            <SanctumBg mode="cathedral" moon="blood" />

            {/* Floating minimal user header */}
            <div className="fixed top-4 right-4 z-50">
                <HomeAccountPill />
            </div>

            <main className="relative mx-auto flex min-h-[100svh] max-w-[90rem] flex-col items-center justify-center gap-5 px-6 text-center z-10">
                <span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500 font-secondary" />
                    Gate Open
                </span>

                <h1 className="text-balance font-enchanted tracking-tight text-7xl sm:text-5xl md:text-7xl">
                    Sanctum Realms
                </h1>
                <p className="font-secondary text-balance max-w-3xl text-md sm:text-base text-muted-foreground">
                    A hidden refuge of power, craft, and knowledge. Enter to
                    chart realms, bind artifacts, and keep the rites.
                </p>

                <div className="relative mt-2">
                    <div
                        className={cn(
                            "bg-card/70 backdrop-blur-xl border border-border/60 shadow-2xl",
                            "rounded-2xl px-4 py-3 sm:px-5 sm:py-4 flex flex-col items-center gap-2 w-[90vw] max-w-md",
                            // subtle sanctum glow ring
                            "ring-1 ring-rose-900/20 hover:ring-rose-700/25 transition-shadow duration-300 shadow-[0_0_60px_-20px_rgba(193,30,55,0.35)]",
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
                        </div>
                    </div>
                </div>

                {/* Stats: Side-by-side on large screens */}
                <section className="mt-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Live Stats */}
                    <div className="text-left">
                        <div className="mb-2.5 flex items-center justify-between">
                            <h2 className="text-base sm:text-lg font-bold tracking-tight md:font-enchanted">
                                The World Beyond
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
                            <h2 className="text-base sm:text-lg font-bold tracking-tight md:font-enchanted">
                                Relics and Ledgers
                            </h2>
                            <Badge variant="outline" className="text-[10px]">
                                Cached ~10m
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
                            <Card className="h-[180px]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Cataloged Relics
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
                                        Bound to Orders
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
                                        Untethered
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
                                            Last Stirring{" "}
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
