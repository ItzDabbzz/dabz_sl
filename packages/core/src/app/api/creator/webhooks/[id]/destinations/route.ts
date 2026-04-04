export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { webhookDestinations, webhooks } from "@/schemas/sl-schema";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

// List + Create destinations for a webhook
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authCtx = await getCreatorContextFromApiKey(req as any);
    requireScope(authCtx, "sl.webhooks:read");
    const params = await ctx.params;
    const whRows = await db.select().from(webhooks).where(eq(webhooks.id, params.id)).limit(1);
    if (!whRows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const wh = whRows[0];
    const scopeOk =
      (wh.scopeType === "org" && wh.scopeId === (authCtx.targets?.orgId as any)) ||
      (wh.scopeType === "team" && wh.scopeId === (authCtx.targets?.teamId as any)) ||
      (wh.scopeType === "user" && wh.scopeId === (authCtx.userId as any));
    if (!scopeOk) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rows = await db.select().from(webhookDestinations).where(eq(webhookDestinations.webhookId, params.id));
  return NextResponse.json({ items: rows, webhook: { scopeType: wh.scopeType, scopeId: wh.scopeId } }, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const ctxAuth = await getCreatorContextFromApiKey(req as any);
    requireScope(ctxAuth, "sl.webhooks:write");

    const { type, enabled = true, events = [], configJson = {} } = await req.json();
    if (!type || !Array.isArray(events)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

    const params = await ctx.params;
    // Verify webhook scope ownership
    const whRows = await db.select().from(webhooks).where(eq(webhooks.id, params.id)).limit(1);
    if (!whRows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const wh = whRows[0];
    const scopeOk =
      (wh.scopeType === "org" && wh.scopeId === (ctxAuth.targets?.orgId as any)) ||
      (wh.scopeType === "team" && wh.scopeId === (ctxAuth.targets?.teamId as any)) ||
      (wh.scopeType === "user" && wh.scopeId === (ctxAuth.userId as any));
    if (!scopeOk) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const inserted = await db
      .insert(webhookDestinations)
      .values({ webhookId: params.id, type, enabled, events, configJson })
      .returning({ id: webhookDestinations.id });
    return NextResponse.json({ id: inserted[0].id }, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });



  }
}
