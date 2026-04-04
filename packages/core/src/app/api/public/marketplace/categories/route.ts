export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mpCategories } from "@/schemas/sl-schema";
import { asc } from "drizzle-orm";

export async function GET(_req: NextRequest) {
  try {
    const rows = await db
      .select({ id: mpCategories.id, primary: mpCategories.primary, sub: mpCategories.sub, sub2: mpCategories.sub2 })
      .from(mpCategories)
      .orderBy(asc(mpCategories.primary as any), asc(mpCategories.sub as any), asc(mpCategories.sub2 as any));
    return NextResponse.json({ items: rows });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });


  }
}
