import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mpItemCategories } from "@/schemas/sl-schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function getUserFromRequest(req: NextRequest) {
  const ses = await auth.api.getSession({ headers: req.headers as any });
  if (!ses?.user) throw new Error("unauthorized");
  return ses.user;
}

// Bulk replace categories for an item
export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await getUserFromRequest(req);
    const id = ctx.params.id;
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

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
