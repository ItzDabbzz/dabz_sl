export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { mpItemCategories, mpItems, mpCategories } from "@/schemas/sl-schema";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { requireUserFromRequest } from "@/server/auth/session";

// Fetch existing categories for an item
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUserFromRequest(req);
    const { id } = await ctx.params;

    // Ensure item belongs to the user
    const [item] = await db
      .select({ id: mpItems.id, ownerUserId: mpItems.ownerUserId })
      .from(mpItems)
      .where(eq(mpItems.id as any, id as any) as any);
    if (!item || (item as any).ownerUserId !== (user as any).id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const rows = await db
      .select({
        id: mpCategories.id,
        primary: mpCategories.primary,
        sub: mpCategories.sub,
      })
      .from(mpItemCategories)
      .innerJoin(
        mpCategories,
        eq(mpItemCategories.categoryId as any, mpCategories.id as any) as any
      )
      .where(eq(mpItemCategories.itemId as any, id as any) as any);

    return NextResponse.json({ items: rows });
  } catch (e: any) {
    if (e?.message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// Bulk replace categories for an item
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireUserFromRequest(req);
    const { id } = await ctx.params;
    const body = await req.json();
    const categoryIds: string[] = Array.isArray(body?.categoryIds) ? body.categoryIds : [];

    await db.delete(mpItemCategories as any).where(eq(mpItemCategories.itemId as any, id as any) as any);

    for (const cid of categoryIds) {
      try {
        await db
          .insert(mpItemCategories)
          .values({ itemId: id as any, categoryId: cid as any })
          .onConflictDoNothing();
      } catch {}
    }

    revalidateTag("marketplace:stats");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
