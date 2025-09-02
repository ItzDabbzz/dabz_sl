import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { objectInstances } from "@/schemas/sl-schema";
import { and, eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.instances:read");

    const { searchParams } = new URL(req.url);
    const masterObjectId = searchParams.get("masterObjectId") || undefined;
    const ownerSlUuid = searchParams.get("ownerSlUuid") || undefined;
    const status = searchParams.get("status") || undefined;

    const conditions: any[] = [];

    // Scope enforcement
    if (ctx.targets?.orgId) conditions.push(eq(objectInstances.orgId, ctx.targets.orgId as any));
    else if (ctx.targets?.teamId) conditions.push(eq(objectInstances.teamId, ctx.targets.teamId as any));
    else conditions.push(eq(objectInstances.ownerUserId, ctx.userId as any));

    if (masterObjectId) conditions.push(eq(objectInstances.masterObjectId, masterObjectId as any));
    if (ownerSlUuid) conditions.push(eq(objectInstances.ownerSlUuid, ownerSlUuid as any));
    if (status) conditions.push(eq(objectInstances.status, status as any));

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);
    const rows = await db.select().from(objectInstances).where(where);

    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
