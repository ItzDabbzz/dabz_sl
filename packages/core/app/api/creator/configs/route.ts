import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userConfigs } from "@/schemas/sl-schema";
import { and, desc, eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.configs:read");

    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get("instanceId") || undefined;

    const conditions: any[] = [];
    if (ctx.targets?.orgId) conditions.push(eq(userConfigs.createdByUserId, ctx.targets.orgId as any));
    else if (ctx.targets?.teamId) conditions.push(eq(userConfigs.createdByUserId, ctx.targets.teamId as any));
    else conditions.push(eq(userConfigs.createdByUserId, ctx.userId as any));

    if (instanceId) conditions.push(eq(userConfigs.instanceId, instanceId as any));

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const rows = await db.select().from(userConfigs).where(where).orderBy(desc(userConfigs.createdAt)).limit(200);
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
