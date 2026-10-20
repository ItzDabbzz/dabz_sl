export const revalidate = 300;

import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpCategories } from "@/schemas/sl-schema";
import {
    normalizePath,
} from "@/features/marketplace/shared/category-path";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: mpCategories.id,
        path: mpCategories.path,
      })
      .from(mpCategories);

    // The tree is deeper than a fixed number of levels, so the path travels
    // with the row and the client renders whatever depth it has.
    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        path: normalizePath(row.path as unknown as string[]),
      })),
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
