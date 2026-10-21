export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpCategories, mpItemCategories } from "@/schemas/sl-schema";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/server/auth/guards";
import { normalizePath } from "@/features/marketplace/shared/category-path";

// Fetch existing categories for an item
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    await requireStaff(req);

    const rows = await db
      .select({
        id: mpCategories.id,
        path: mpCategories.path,
      })
      .from(mpItemCategories)
      .innerJoin(
        mpCategories,
        eq(mpItemCategories.categoryId as any, mpCategories.id as any) as any,
      )
      .where(eq(mpItemCategories.itemId as any, id as any) as any);

    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        path: normalizePath(row.path as unknown as string[]),
      })),
    });
  } catch (e: any) {
    if (e?.message === "unauthorized")
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e?.message === "forbidden")
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// Replace an item's categories with the given set
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    await requireStaff(req);

    const body = await req.json();
    const categoryIds: string[] = Array.isArray(body?.categoryIds)
      ? body.categoryIds
      : [];

    // Replace the set: delete what is not wanted, add what is.
    await db
      .delete(mpItemCategories as any)
      .where(eq(mpItemCategories.itemId as any, id as any) as any);

    for (const categoryId of categoryIds) {
      try {
        await db
          .insert(mpItemCategories)
          .values({
            itemId: id as any,
            categoryId: categoryId as any,
          })
          .onConflictDoNothing();
      } catch {
        /* duplicate link */
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === "unauthorized")
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e?.message === "forbidden")
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
