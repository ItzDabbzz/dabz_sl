export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpCategories, mpItemCategories } from "@/schemas/sl-schema";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { requirePermission } from "@/server/auth/guards";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("marketplace.moderate", req.headers as any);
    const { id } = await ctx.params;
    const { primary, sub, sub2 } = await req.json();
    const [row] = await db
      .update(mpCategories)
      .set({ ...(primary ? { primary } : {}), ...(sub ? { sub } : {}), ...(sub2 ? { sub2 } : {}) })
      .where(eq(mpCategories.id as any, id as any) as any)
      .returning();
    revalidateTag("marketplace:stats", {});
    return NextResponse.json({ item: row });
  } catch (e: any) {
    if (e?.message === "forbidden" || e?.message === "unauthorized") {
      return NextResponse.json({ error: e.message }, { status: e.message === "unauthorized" ? 401 : 403 });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("marketplace.moderate", req.headers as any);
    const { id } = await ctx.params;
    // Remove mappings first, then delete the category
    await db.delete(mpItemCategories as any).where(eq(mpItemCategories.categoryId as any, id as any) as any);
    await db.delete(mpCategories as any).where(eq(mpCategories.id as any, id as any) as any);
    revalidateTag("marketplace:stats", {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === "forbidden" || e?.message === "unauthorized") {
      return NextResponse.json({ error: e.message }, { status: e.message === "unauthorized" ? 401 : 403 });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}

