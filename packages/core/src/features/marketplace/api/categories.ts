export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpCategories } from "@/schemas/sl-schema";
import { and, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { requireUserFromRequest } from "@/server/auth/session";
import {
  isConfiguredAdminId,
  isPrivilegedMarketplaceRole,
} from "@/server/auth/roles";
import { normalizePath } from "@/features/marketplace/shared/category-path";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUserFromRequest(req);
    if (!isPrivilegedMarketplaceRole((user as any).role) && !isConfiguredAdminId((user as any).id)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const privileged = isPrivilegedMarketplaceRole((user as any).role) || isConfiguredAdminId((user as any).id);
    const rows = privileged
      ? await db.select().from(mpCategories)
      : await db
          .select()
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

export async function POST(req: NextRequest) {
  try {
    const user = await requireUserFromRequest(req);
    if (!isPrivilegedMarketplaceRole((user as any).role) && !isConfiguredAdminId((user as any).id)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const body = await req.json();
    // A category is a path. It arrives as a `path` array.
    const path: string[] = Array.isArray(body?.path) ? body.path : [];
    const segments = normalizePath(path);
    if (!segments.length) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    // Look the path up before inserting. The unique index is a backstop, but
    // it spans nullable scope columns, so the lookup is what actually keeps
    // the path unique.
    const existing = await db
      .select()
      .from(mpCategories)
      .where(
        and(
          eq(mpCategories.path as any, segments as any) as any,
          eq(mpCategories.ownerUserId as any, user.id as any) as any,
        ),
      )
      .limit(1);

    let row = existing[0];
    if (!row) {
      const [created] = await db
        .insert(mpCategories)
        .values({ path: segments, ownerUserId: user.id as any } as any)
        .returning();
      row = created;
    }
    // Invalidate marketplace stats cache
    revalidateTag("marketplace:stats", {});
    return NextResponse.json(
      { item: { id: row.id, path: normalizePath(row.path as unknown as string[]) } },
      { status: 201 },
    );
  } catch (e: any) {
    if (e?.message === "unauthorized")
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (e?.message === "forbidden")
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
