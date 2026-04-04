export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhooks } from "@/schemas/sl-schema";
import { and, eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.webhooks:read");

    const scopeType = (req.nextUrl.searchParams.get("scopeType") || "org") as "org" | "team" | "user";
    const scopeId = req.nextUrl.searchParams.get("scopeId") || ctx.targets?.orgId || ctx.userId;

    const rows = await db.select().from(webhooks).where(and(eq(webhooks.scopeType, scopeType), eq(webhooks.scopeId, scopeId as any)));
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.webhooks:write");

    const body = await req.json();
    const { targetUrl, events, secret, scopeType = "org", scopeId = ctx.targets?.orgId || ctx.userId } = body || {};

    const inserted = await db
      .insert(webhooks)
      .values({ scopeType, scopeId, targetUrl, events, secret, active: true })
      .returning({ id: webhooks.id });

    return NextResponse.json({ id: inserted[0].id }, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });



  }
}
