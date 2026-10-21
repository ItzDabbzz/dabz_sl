import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { auth } from "@/server/auth/core";
import { getMarketplaceStats, getSecondLifeSnapshot } from "@/features/public/home/server/site-stats";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import {
  masterObjects,
  objectInstances,
  userConfigs,
  entitlements,
  webhooks,
  webhookDeliveries,
  auditLogs,
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
import {
  DashboardPage as ConsolePage,
  StatCard,
} from "@/features/dashboard/components/page";
import {
  Boxes,
  Server,
  FileDiff,
  BadgeCheck,
  Webhook,
  ShoppingBag,
  Tag,
  Package,
  Activity,
} from "lucide-react";

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

  const mpStatsPromise = getMarketplaceStats();
  const livePromise = getSecondLifeSnapshot();

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

  const recentAuditPromise = db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(6);

  const [counts, live, mpStats, recentAudit] = await Promise.all([
    countsPromise,
    livePromise,
    mpStatsPromise,
    recentAuditPromise,
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

  return (
    <ConsolePage
      title="Platform Dashboard"
      description="Overview of objects, instances, webhooks, and live SL signals."
      crumbs={[
        { label: "Console", href: "/dashboard" },
        { label: "Overview" },
      ]}
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/api-docs">API Docs</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/database/objects">New Master Object</Link>
          </Button>
        </>
      }
    >
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Master Objects"
          value={formatNum(moCount)}
          icon={<Boxes className="h-4 w-4" />}
        />
        <StatCard
          label="Instances"
          value={formatNum(instCount)}
          icon={<Server className="h-4 w-4" />}
        >
          <div className="mt-2 h-12">
            <MiniArea id="inst-mini" data={instSeries} />
          </div>
        </StatCard>
        <StatCard
          label="Configs"
          value={formatNum(cfgCount)}
          icon={<FileDiff className="h-4 w-4" />}
        />
        <StatCard
          label="Entitlements"
          value={formatNum(entCount)}
          icon={<BadgeCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Webhooks"
          value={formatNum(hookCount)}
          icon={<Webhook className="h-4 w-4" />}
        />
        <StatCard
          label="Deliveries"
          value={formatNum(delivCount)}
          icon={<Activity className="h-4 w-4" />}
        >
          <div className="mt-2 h-12">
            <MiniArea id="deliv-mini" data={deliverySeries} />
          </div>
        </StatCard>
      </div>

      {/* Activity chart */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Activity (last 14 days)</CardTitle>
              <Badge variant="outline">Daily totals</Badge>
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
              <Badge variant="secondary">Snapshot</Badge>
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
              <Badge variant="outline">Updated {timeAgoUnix(live.home?.inworld_updated_unix || live.home?.exchange_rate_updated_unix)}</Badge>
              <Badge variant="outline">LindeX {timeAgoUnix(live.lindex?.updated_unix)}</Badge>
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
        <StatCard
          label="Marketplace Items"
          value={formatNum(mpStats.totalItems)}
          hint="Imported listings"
          icon={<ShoppingBag className="h-4 w-4" />}
        />
        <StatCard
          label="Categorized"
          value={formatNum(mpStats.itemsWithCategories)}
          hint="Items linked to categories"
          icon={<Tag className="h-4 w-4" />}
        />
        <StatCard
          label="Needs Review"
          value={formatNum(mpStats.uncategorizedItems)}
          hint={`Last change ${mpStats.lastItemUpdateIso ? new Date(mpStats.lastItemUpdateIso).toLocaleString() : "—"}`}
          icon={<Package className="h-4 w-4" />}
        />
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
        {[
          {
            href: "/dashboard/database/objects",
            title: "Master Objects",
            description: "Create and manage templates",
            icon: Boxes,
          },
          {
            href: "/dashboard/database/instances",
            title: "Instances",
            description: "Search and monitor instances",
            icon: Server,
          },
          {
            href: "/dashboard/webhooks",
            title: "Webhooks",
            description: "Manage and inspect deliveries",
            icon: Webhook,
          },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <link.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{link.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {link.description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </ConsolePage>
  );
}
