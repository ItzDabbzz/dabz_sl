import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { webhookDestinations, webhooks } from "@/schemas/sl-schema";
import { getCreatorContextFromApiKey, requireScope } from "@/features/creator/api/auth";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; destId: string }> }) {
  try {
    const ctxAuth = await getCreatorContextFromApiKey(req as any);
    requireScope(ctxAuth, "sl.webhooks:write");
    // Verify webhook ownership first
    const { id, destId } = await ctx.params;
    const whRows = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    if (!whRows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const wh = whRows[0];
    const scopeOk =
      (wh.scopeType === "org" && wh.scopeId === (ctxAuth.targets?.orgId as any)) ||
      (wh.scopeType === "team" && wh.scopeId === (ctxAuth.targets?.teamId as any)) ||
      (wh.scopeType === "user" && wh.scopeId === (ctxAuth.userId as any));
    if (!scopeOk) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = await req.json();
    const { type, enabled, events, configJson } = body || {};
    const res = await db
      .update(webhookDestinations)
      .set({
        ...(type !== undefined ? { type } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
        ...(events !== undefined ? { events } : {}),
        ...(configJson !== undefined ? { configJson } : {}),
      })
      .where(and(eq(webhookDestinations.id, destId), eq(webhookDestinations.webhookId, id)))
      .returning({ id: webhookDestinations.id });
    if (!res.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ id: res[0].id }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; destId: string }> }) {
  try {
    const ctxAuth = await getCreatorContextFromApiKey(req as any);
    requireScope(ctxAuth, "sl.webhooks:write");
    const { id, destId } = await ctx.params;
    const whRows = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    if (!whRows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const wh = whRows[0];
    const scopeOk =
      (wh.scopeType === "org" && wh.scopeId === (ctxAuth.targets?.orgId as any)) ||
      (wh.scopeType === "team" && wh.scopeId === (ctxAuth.targets?.teamId as any)) ||
      (wh.scopeType === "user" && wh.scopeId === (ctxAuth.userId as any));
    if (!scopeOk) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const res = await db
      .delete(webhookDestinations)
      .where(and(eq(webhookDestinations.id, destId), eq(webhookDestinations.webhookId, id)))
      .returning({ id: webhookDestinations.id });
    if (!res.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ id: res[0].id }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });


  }
}
