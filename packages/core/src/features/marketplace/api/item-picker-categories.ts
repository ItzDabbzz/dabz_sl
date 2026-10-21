export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpCategories } from "@/schemas/sl-schema";
import { requireStaff } from "@/server/auth/guards";
import { normalizePath } from "@/features/marketplace/shared/category-path";

// Lightweight list for picker: returns the id and the full path
export async function GET(req: NextRequest) {
  try {
    await requireStaff(req);
    const rows = await db
      .select({
        id: mpCategories.id,
        path: mpCategories.path,
      })
      .from(mpCategories);

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
