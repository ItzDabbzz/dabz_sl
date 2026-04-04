export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { mpCategories } from "@/schemas/sl-schema";
import { and, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { requireUserFromRequest } from "@/server/auth/session";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUserFromRequest(req);
    const rows = await db
      .select()
      .from(mpCategories)
      .where(eq(mpCategories.ownerUserId as any, user.id as any) as any);
    return NextResponse.json({ items: rows });
  } catch (e: any) {
    if (e?.message === "unauthorized")
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUserFromRequest(req);
    const { primary, sub = "All", sub2 = "All" } = await req.json();
    let row;
    try {
      [row] = await db
        .insert(mpCategories)
        .values({ primary, sub, sub2, ownerUserId: user.id as any })
        .onConflictDoNothing()
        .returning();
    } catch {}
    if (!row) {
      const existing = await db
        .select()
        .from(mpCategories)
        .where(
          and(
            eq(mpCategories.primary as any, primary as any) as any,
            eq(mpCategories.sub as any, sub as any) as any,
            eq(mpCategories.sub2 as any, sub2 as any) as any,
            eq(mpCategories.ownerUserId as any, user.id as any) as any
          ) as any
        );
      row = existing[0];
    }
    // Invalidate marketplace stats cache
    revalidateTag("marketplace:stats");
    return NextResponse.json({ item: row }, { status: 201 });
  } catch (e: any) {
    if (e?.message === "unauthorized")
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
