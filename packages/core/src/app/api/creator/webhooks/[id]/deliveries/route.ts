export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { webhooks, webhookDeliveries, webhookDestinations, discordChannels } from "@/schemas/sl-schema";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/features/creator/api/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.webhooks:read");

    const { id } = await params;

    // Verify webhook belongs to caller scope
    const wh = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    if (!wh.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const row = wh[0];
    const scopeOk =
      (row.scopeType === "org" && row.scopeId === (ctx.targets?.orgId as any)) ||
      (row.scopeType === "team" && row.scopeId === (ctx.targets?.teamId as any)) ||
      (row.scopeType === "user" && row.scopeId === (ctx.userId as any));
    if (!scopeOk) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize") || 25)));
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const status = (req.nextUrl.searchParams.get("status") || "all").toLowerCase();

  const whereBase: any[] = [eq(webhookDeliveries.webhookId, id as any)];
  if (q) whereBase.push(ilike(webhookDeliveries.event, `%${q}%` as any));
  if (status === "2xx") whereBase.push(sql`${webhookDeliveries.responseStatus} >= 200 AND ${webhookDeliveries.responseStatus} < 300`);
  else if (status === "4xx") whereBase.push(sql`${webhookDeliveries.responseStatus} >= 400 AND ${webhookDeliveries.responseStatus} < 500`);
  else if (status === "5xx") whereBase.push(sql`${webhookDeliveries.responseStatus} >= 500 AND ${webhookDeliveries.responseStatus} < 600`);
  else if (status === "failed") whereBase.push(sql`${webhookDeliveries.responseStatus} IS NULL OR ${webhookDeliveries.error} IS NOT NULL`);

    const offset = (page - 1) * pageSize;

    const rows = await db
      .select({
        id: webhookDeliveries.id,
        event: webhookDeliveries.event,
        responseStatus: webhookDeliveries.responseStatus,
        error: webhookDeliveries.error,
        durationMs: webhookDeliveries.durationMs,
        createdAt: webhookDeliveries.createdAt,
        responseBody: webhookDeliveries.responseBody,
        targetUrl: webhookDeliveries.targetUrl,
        transport: webhookDeliveries.transport,
        destinationId: webhookDeliveries.destinationId,
      })
      .from(webhookDeliveries)
      .where(whereBase.length > 1 ? and(...whereBase) : whereBase[0])
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(pageSize + 1)
      .offset(offset);

    // Optionally enrich with destination labels
    const destIds = Array.from(new Set(rows.map((r) => r.destinationId).filter(Boolean))) as string[];
    let labels: Record<string, string> = {};
    if (destIds.length) {
      const dests = await db.select().from(webhookDestinations).where(sql`${webhookDestinations.id} = ANY(${destIds}::uuid[])`);
      labels = Object.fromEntries(
        await Promise.all(
          dests.map(async (d: any) => {
            let label = '';
            if (d.type === 'http') label = d.configJson?.url || d.configJson?.targetUrl || 'HTTP';
            else if (d.type === 'discord') {
              label = Array.isArray(d.configJson?.urls) ? d.configJson.urls[0] : d.configJson?.url || 'Discord';
            }
            return [d.id, label];
          })
        )
      );

      // Try resolving Discord channel names when URL matches a saved channel
      const allUrls = Object.values(labels).filter(Boolean);
      if (allUrls.length) {
        const chans = await db.select().from(discordChannels).where(sql`${discordChannels.webhookUrl} = ANY(${allUrls}::text[])`);
        for (const c of chans as any[]) {
          labels = Object.fromEntries(
            Object.entries(labels).map(([k, v]) => [k, v === c.webhookUrl ? `${c.name}` : v])
          );
        }
      }
    }

    const hasMore = rows.length > pageSize;
    const items = (hasMore ? rows.slice(0, pageSize) : rows).map((r) => ({
      ...r,
      destinationLabel: r.destinationId ? labels[r.destinationId] : undefined,
    }));

    return NextResponse.json({ items, page, pageSize, hasMore }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });



  }
}
