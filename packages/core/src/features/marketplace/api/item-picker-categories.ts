export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { mpCategories } from "@/schemas/sl-schema";
import { eq, asc } from "drizzle-orm";
import { requireUserFromRequest } from "@/server/auth/session";

// Lightweight list for picker: returns id, primary, sub
export async function GET(req: NextRequest) {
  try {
    const user = await requireUserFromRequest(req);
    const rows = await db
      .select({ id: mpCategories.id, primary: mpCategories.primary, sub: mpCategories.sub })
      .from(mpCategories)
      .where(eq(mpCategories.ownerUserId as any, user.id as any) as any)
      .orderBy(asc(mpCategories.primary as any) as any, asc(mpCategories.sub as any) as any);

    return NextResponse.json({ items: rows });
  } catch (e: any) {
    if (e?.message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
