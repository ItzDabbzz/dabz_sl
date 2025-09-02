import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mpCategories, mpItemCategories } from "@/schemas/sl-schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

async function getScope() {
  const ses = await auth.api.getSession({ headers: (await headers()) as any });
  if (!ses?.user) throw new Error("unauthorized");
  return { userId: ses.user.id };
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { userId } = await getScope();
    const id = ctx.params.id;
    const { primary, sub } = await req.json();
    const [row] = await db
      .update(mpCategories)
      .set({ ...(primary ? { primary } : {}), ...(sub ? { sub } : {}) })
      .where(and(eq(mpCategories.id as any, id as any) as any, eq(mpCategories.ownerUserId as any, userId as any) as any) as any)
      .returning();
    return NextResponse.json({ item: row });
  } catch (e: any) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { userId } = await getScope();
    const id = ctx.params.id;
    // Remove mappings first
    await db.delete(mpItemCategories as any).where(eq(mpItemCategories.categoryId as any, id as any) as any);
    // Then delete the category (scoped to owner)
    await db
      .delete(mpCategories as any)
      .where(and(eq(mpCategories.id as any, id as any) as any, eq(mpCategories.ownerUserId as any, userId as any) as any) as any);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
