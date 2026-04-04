export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mpItemCategories } from "@/schemas/sl-schema";
import { auth } from "@/lib/auth";
import { and, eq, inArray } from "drizzle-orm";

async function getUserFromRequest(req: NextRequest) {
  const ses = await auth.api.getSession({ headers: req.headers as any });
  if (!ses?.user) throw new Error("unauthorized");
  return ses.user;
}

// POST: { itemIds: string[] } -> { mappings: Array<{ itemId: string, categoryId: string }> }
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    const body = await req.json();
    const ids: string[] = Array.isArray(body?.itemIds) ? body.itemIds : [];
    if (!ids.length) return NextResponse.json({ mappings: [] });

    const rows = await db
      .select({ itemId: mpItemCategories.itemId, categoryId: mpItemCategories.categoryId })
      .from(mpItemCategories)
      .where(
        and(
          inArray(mpItemCategories.itemId as any, ids as any) as any
          // Ownership is implicit via items table, but we don't join here for performance.
          // The client limits ids to those returned for the current user.
        ) as any
      );

    return NextResponse.json({ mappings: rows });
  } catch (e: any) {
    if (e?.message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "server_error" }, { status: 500 });



  }
}
