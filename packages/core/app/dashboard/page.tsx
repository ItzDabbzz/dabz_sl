import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  masterObjects,
  objectInstances,
  userConfigs,
  entitlements,
  webhooks,
  webhookDeliveries,
  auditLogs,
  mpItems,
  mpCategories,
  mpItemCategories,
} from "@/schemas/sl-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { count, desc, gt } from "drizzle-orm";
import { MiniArea, ActivityLines } from "@/components/dashboard/charts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DashboardPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) return redirect("/sign-in");

  // Helper: last N days as YYYY-MM-DD
  const lastNDates = (n: number) => {
    const out: string[] = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    for (let i = n - 1; i >= 0; i--) {
      const t = new Date(d);
      t.setDate(d.getDate() - i);
      out.push(
        `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
          t.getDate(),
        ).padStart(2, "0")}`,
      );
    }
    return out;
  };

  // Marketplace stats (cached-like, but inline for dashboard)
  const mpStatsPromise = (async () => {
    const [{ value: totalItems }] = (await db
      .select({ value: count() })
      .from(mpItems)) as any;
    const [{ value: totalCategories }] = (await db
      .select({ value: count() })
      .from(mpCategories)) as any;

    // Distinct primaries via groupBy
    const primaryRows = await db
      .select({ primary: mpCategories.primary })
      .from(mpCategories)
      .groupBy(mpCategories.primary);
    const distinctPrimaries = primaryRows.length;

    // Items with any category via groupBy
    const itemCatRows = await db
      .select({ itemId: mpItemCategories.itemId })
      .from(mpItemCategories)
      .groupBy(mpItemCategories.itemId);
    const itemsWithCategories = itemCatRows.length;

    const uncategorizedItems = Math.max(
      0,
      Number(totalItems || 0) - Number(itemsWithCategories || 0),
    );

    // Last item update by updatedAt desc
    const [last] = await db
      .select({ createdAt: mpItems.createdAt, updatedAt: mpItems.updatedAt })
      .from(mpItems)
      .orderBy(desc(mpItems.updatedAt))
      .limit(1);
    const lastItemUpdateIso = (last as any)?.updatedAt || (last as any)?.createdAt || null;

    return {
      totalItems: Number(totalItems || 0),
      totalCategories: Number(totalCategories || 0),
      distinctPrimaries: Number(distinctPrimaries || 0),
      itemsWithCategories: Number(itemsWithCategories || 0),
      uncategorizedItems,
      lastItemUpdateIso: lastItemUpdateIso ? String(lastItemUpdateIso) : null,
    };
  })();

  // Live SL feeds (snapshot)
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
  function toNum(v?: string | null): number | undefined {
    if (v == null) return undefined;
    const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  type HomeFeed = {
    signups?: number;
    signups_updated_unix?: number;
    inworld?: number;
    inworld_updated_unix?: number;
    exchange_rate?: number;
    exchange_rate_updated_unix?: number;
  };
  const mapHomeFeed = (m: Record<string, string>): HomeFeed => ({
    signups: toNum(m["signups"]),
    signups_updated_unix: toNum(m["signups_updated_unix"]),
    inworld: toNum(m["inworld"]),
    inworld_updated_unix: toNum(m["inworld_updated_unix"]),
    exchange_rate: toNum(m["exchange_rate"]),
    exchange_rate_updated_unix: toNum(m["exchange_rate_updated_unix"]),
  });

  type LindexWindow = { min_rate?: number; max_rate?: number; l_volume?: number; us_volume?: number };
  type LindexFeed = {
    updated_unix?: number;
    market_buy?: { today?: LindexWindow };
    market_sell?: { today?: LindexWindow };
  };
  const mapLindexFeed = (m: Record<string, string>): LindexFeed => ({
    updated_unix: toNum(m["updated_unix"]),
    market_buy: {
      today: {
        min_rate: toNum(m["mb_t_min_rate"]),
        max_rate: toNum(m["mb_t_max_rate"]),
        l_volume: toNum(m["mb_t_l$"]),
        us_volume: toNum(m["mb_t_us$"]),
      },
    },
    market_sell: {
      today: {
        min_rate: toNum(m["ms_t_min_rate"]),
        max_rate: toNum(m["ms_t_max_rate"]),
        l_volume: toNum(m["ms_t_l$"]),
        us_volume: toNum(m["ms_t_us$"]),
      },
    },
  });

  const livePromise = (async () => {
    const [homeTxt, lindexTxt] = await Promise.all([
      fetchText("https://api.secondlife.com/datafeeds/homepage.txt"),
      fetchText("https://api.secondlife.com/datafeeds/lindex.txt"),
    ]);
    const home = homeTxt ? mapHomeFeed(parseKeyValueText(homeTxt)) : null;
    const lindex = lindexTxt ? mapLindexFeed(parseKeyValueText(lindexTxt)) : null;
    return { home, lindex } as { home: HomeFeed | null; lindex: LindexFeed | null };
  })();

  // KPI counts
  const countsPromise = Promise.all([
    db.select({ v: count() }).from(masterObjects),
    db.select({ v: count() }).from(objectInstances),
    db.select({ v: count() }).from(userConfigs),
    db.select({ v: count() }).from(entitlements),
    db.select({ v: count() }).from(webhooks),
    db.select({ v: count() }).from(webhookDeliveries),
  ]);

  // Timeseries (last 14 days)
  const days = lastNDates(14);
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [instRowsRaw, deliveryRowsRaw, auditRowsRaw] = await Promise.all([
    db
      .select({ createdAt: objectInstances.createdAt })
      .from(objectInstances)
      .where(gt(objectInstances.createdAt, since)),
    db
      .select({ createdAt: webhookDeliveries.createdAt })
      .from(webhookDeliveries)
      .where(gt(webhookDeliveries.createdAt, since)),
    db
      .select({ createdAt: auditLogs.createdAt })
      .from(auditLogs)
      .where(gt(auditLogs.createdAt, since)),
  ]);

  const toKey = (d: Date | string) => {
    const x = new Date(d as any);
    const yyyy = x.getFullYear();
    const mm = String(x.getMonth() + 1).padStart(2, "0");
    const dd = String(x.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const countByDay = (rows: { createdAt: Date | string | null }[]) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (!r.createdAt) continue;
      const k = toKey(r.createdAt);
      map.set(k, (map.get(k) || 0) + 1);
    }
    return days.map((d) => ({ date: d, value: map.get(d) || 0 }));
  };

  const instSeries = countByDay(instRowsRaw as any);
  const deliverySeries = countByDay(deliveryRowsRaw as any);
  const auditSeries = countByDay(auditRowsRaw as any);
  const activitySeries = days.map((d) => ({
    date: d,
    deliveries: (deliverySeries.find((x) => x.date === d)?.value || 0) as number,
    events: (auditSeries.find((x) => x.date === d)?.value || 0) as number,
  }));

  const [counts, live, mpStats] = await Promise.all([
    countsPromise,
    livePromise,
    mpStatsPromise,
  ]);
  const [
    [{ v: moCount } = { v: 0 }],
    [{ v: instCount } = { v: 0 }],
    [{ v: cfgCount } = { v: 0 }],
    [{ v: entCount } = { v: 0 }],
    [{ v: hookCount } = { v: 0 }],
    [{ v: delivCount } = { v: 0 }],
  ] = counts as any;

  const timeAgoUnix = (unix?: number) => {
    if (!unix) return "n/a";
    const ms = unix * 1000;
    const diff = Date.now() - ms;
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const formatNum = (n?: number) =>
    new Intl.NumberFormat("en-US").format(Number(n || 0));

  // Recent audit activity
  const recentAudit = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(6);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Platform Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of objects, instances, webhooks, and live SL signals.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/api-docs">API Docs</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/objects">New Master Object</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Master Objects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatNum(moCount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Instances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatNum(instCount)}</div>
            <div className="mt-2 h-16">
              <MiniArea id="inst-mini" data={instSeries} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Configs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatNum(cfgCount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Entitlements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatNum(entCount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatNum(hookCount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatNum(delivCount)}</div>
            <div className="mt-2 h-16">
              <MiniArea id="deliv-mini" data={deliverySeries} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity chart */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Activity (last 14 days)</CardTitle>
              <Badge variant="outline" className="text-[10px]">Daily totals</Badge>
            </div>
            <CardDescription>Webhook deliveries and audit events</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ActivityLines id="activity" data={activitySeries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Live Second Life</CardTitle>
              <Badge variant="secondary" className="text-[10px]">Snapshot</Badge>
            </div>
            <CardDescription>In-world users and L$ rate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">In-world now</span>
              <span className="font-semibold">{formatNum(live.home?.inworld)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Exchange rate</span>
              <span className="font-semibold">
                {live.home?.exchange_rate ? `${live.home.exchange_rate.toFixed(2)} L$ / 1 US$` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <Badge variant="outline" className="text-[10px]">Updated {timeAgoUnix(live.home?.inworld_updated_unix || live.home?.exchange_rate_updated_unix)}</Badge>
              <Badge variant="outline" className="text-[10px]">LindeX {timeAgoUnix(live.lindex?.updated_unix)}</Badge>
            </div>
            <div className="pt-1 text-right">
              <a
                className="text-xs underline underline-offset-4 text-muted-foreground hover:no-underline"
                href="https://wiki.secondlife.com/wiki/Linden_Lab_Official:Live_Data_Feeds"
                target="_blank"
                rel="noopener noreferrer"
              >
                Source
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Marketplace mini */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Marketplace Items</CardTitle>
            <CardDescription>Imported listings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatNum(mpStats.totalItems)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Categorized</CardTitle>
            <CardDescription>Items linked to categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatNum(mpStats.itemsWithCategories)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Needs Review</CardTitle>
            <CardDescription>Uncategorized items</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatNum(mpStats.uncategorizedItems)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Last change {mpStats.lastItemUpdateIso ? new Date(mpStats.lastItemUpdateIso).toLocaleString() : "—"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/webhooks">Webhooks</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAudit.map((e) => (
                  <TableRow key={(e as any).id}>
                    <TableCell className="font-medium">{(e as any).eventType}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(e as any).scopeType || "—"}{(e as any).scopeId ? ` • ${(e as any).scopeId}` : ""}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {(e as any).createdAt ? new Date((e as any).createdAt as any).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {recentAudit.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      No recent activity.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:bg-muted/40 transition-colors">
          <CardHeader>
            <CardTitle>Master Objects</CardTitle>
            <CardDescription>Create and manage templates</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary"><Link href="/dashboard/objects">Open</Link></Button>
          </CardContent>
        </Card>
        <Card className="hover:bg-muted/40 transition-colors">
          <CardHeader>
            <CardTitle>Instances</CardTitle>
            <CardDescription>Search and monitor instances</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary"><Link href="/dashboard/instances">Open</Link></Button>
          </CardContent>
        </Card>
        <Card className="hover:bg-muted/40 transition-colors">
          <CardHeader>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Manage and inspect deliveries</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary"><Link href="/dashboard/webhooks">Open</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
