export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { discordChannels } from "@/schemas/sl-schema";
import { and, eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

export async function GET(req: NextRequest) {
  try {
    await headers();
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.webhooks:read");
    const scopeType = (req.nextUrl.searchParams.get("scopeType") || "org") as "org" | "team" | "user";
    const scopeId = req.nextUrl.searchParams.get("scopeId") || ctx.targets?.orgId || ctx.userId;
    const items = await db
      .select()
      .from(discordChannels)
      .where(and(eq(discordChannels.scopeType, scopeType), eq(discordChannels.scopeId, scopeId as any)));
    return NextResponse.json({ items }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await headers();
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.webhooks:write");
    const { name, webhookUrl, scopeType = "org", scopeId } = await req.json();
    const isUuid = (v: unknown) =>
      typeof v === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
    const candidate = typeof scopeId === "string" ? scopeId.trim() : "";
    const resolvedScopeId = isUuid(candidate) ? candidate : (ctx.targets?.orgId || ctx.userId);
    const rows = await db
      .insert(discordChannels)
      .values({ name, webhookUrl, scopeType, scopeId: resolvedScopeId })
      .returning({ id: discordChannels.id });
    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });


  }
}
