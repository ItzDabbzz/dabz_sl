export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { entitlements } from "@/schemas/sl-schema";
import { and, desc, eq } from "drizzle-orm";
import { getCreatorContextFromApiKey, requireScope } from "@/lib/creator-auth";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getCreatorContextFromApiKey(req as any);
    requireScope(ctx, "sl.entitlements:read");

    const { searchParams } = new URL(req.url);
    const ownerSlUuid = searchParams.get("ownerSlUuid") || undefined;
    const masterObjectId = searchParams.get("masterObjectId") || undefined;

    const conditions: any[] = [];

    // Scope enforcement (placeholder: tie entitlements to org/team/user via joins or ownership metadata when available)
    if (ownerSlUuid) conditions.push(eq(entitlements.ownerSlUuid, ownerSlUuid as any));
    if (masterObjectId) conditions.push(eq(entitlements.masterObjectId, masterObjectId as any));

    const where = conditions.length ? and(...conditions) : undefined as any;

    const rows = await db.select().from(entitlements).where(where).orderBy(desc(entitlements.createdAt)).limit(200);
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (e: any) {
    if (e.message?.includes("missing_bearer")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e.message?.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });



  }
}
