export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpCategories, mpItemCategories } from "@/schemas/sl-schema";
import { and, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { requireUserFromRequest } from "@/server/auth/session";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserFromRequest(req);
    const { id } = await ctx.params;
    const { primary, sub, sub2 } = await req.json();
    const [row] = await db
      .update(mpCategories)
      .set({ ...(primary ? { primary } : {}), ...(sub ? { sub } : {}), ...(sub2 ? { sub2 } : {}) })
      .where(and(eq(mpCategories.id as any, id as any) as any, eq(mpCategories.ownerUserId as any, user.id as any) as any) as any)
      .returning();
    revalidateTag("marketplace:stats");
    return NextResponse.json({ item: row });
  } catch (e: any) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserFromRequest(req);
    const { id } = await ctx.params;
    // Remove mappings first
    await db.delete(mpItemCategories as any).where(eq(mpItemCategories.categoryId as any, id as any) as any);
    // Then delete the category (scoped to owner)
    await db
      .delete(mpCategories as any)
      .where(and(eq(mpCategories.id as any, id as any) as any, eq(mpCategories.ownerUserId as any, user.id as any) as any) as any);
    revalidateTag("marketplace:stats");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
