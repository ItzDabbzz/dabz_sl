export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpCategories } from "@/schemas/sl-schema";
import { eq } from "drizzle-orm";
import { requireUserFromRequest } from "@/server/auth/session";
import {
    isConfiguredAdminId,
    isPrivilegedMarketplaceRole,
} from "@/server/auth/roles";
import { normalizePath } from "@/features/marketplace/shared/category-path";

// Lightweight list for picker: returns the id and the full path
export async function GET(req: NextRequest) {
  try {
    const user = await requireUserFromRequest(req);
    const privileged =
      isPrivilegedMarketplaceRole((user as any).role) ||
      isConfiguredAdminId((user as any).id);
    const rows = privileged
      ? await db
          .select({
            id: mpCategories.id,
            path: mpCategories.path,
          })
          .from(mpCategories)
      : await db
          .select({
            id: mpCategories.id,
            path: mpCategories.path,
          })
          .from(mpCategories)
          .where(eq(mpCategories.ownerUserId as any, user.id as any) as any);

    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        path: normalizePath(row.path as unknown as string[]),
      })),
    });
  } catch (e: any) {
    if (e?.message === "unauthorized")
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
