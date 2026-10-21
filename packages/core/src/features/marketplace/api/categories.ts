export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpCategories, mpItemCategories } from "@/schemas/sl-schema";
import { and, count, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { requireStaff } from "@/server/auth/guards";
import { normalizePath } from "@/features/marketplace/shared/category-path";

export async function GET(req: NextRequest) {
  try {
    await requireStaff(req);
    const rows = await db.select().from(mpCategories);

    // Items are tagged with the deepest category, so a parent holds almost
    // nothing of its own. The count here is the number of items tagged to
    // this exact category; the editor rolls the branch totals up the tree.
    const countRows = await db
      .select({
        categoryId: mpItemCategories.categoryId,
        value: count(),
      })
      .from(mpItemCategories)
      .groupBy(mpItemCategories.categoryId);

    const directCounts = new Map<string, number>();
    for (const row of countRows) {
      directCounts.set(row.categoryId as string, Number(row.value ?? 0));
    }

    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        path: normalizePath(row.path as unknown as string[]),
        count: directCounts.get(row.id as string) ?? 0,
        isNsfw: row.isNsfw ?? false,
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
    const user = await requireStaff(req);
    const body = await req.json();
    // A category is a path. It arrives as a `path` array.
    const path: string[] = Array.isArray(body?.path) ? body.path : [];
    const segments = normalizePath(path);
    if (!segments.length) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    // Look the path up before inserting. The unique index is a backstop, but
    // it spans nullable scope columns, so the lookup is what actually keeps
    // the path unique. A path belongs to the catalogue, not to whoever
    // created it, so the lookup is by path alone.
    const existing = await db
      .select()
      .from(mpCategories)
      .where(eq(mpCategories.path as any, segments as any) as any)
      .limit(1);

    let row = existing[0];
    if (!row) {
      const [created] = await db
        .insert(mpCategories)
        .values({
          path: segments,
          ownerUserId: user.id as any,
          isNsfw: body?.isNsfw === true,
        } as any)
        .returning();
      row = created;
    } else if (typeof body?.isNsfw === "boolean" && row.isNsfw !== body.isNsfw) {
      // Marking a category also marks everything beneath it, so the branch
      // follows one rule.
      const [updated] = await db
        .update(mpCategories)
        .set({ isNsfw: body.isNsfw } as any)
        .where(eq(mpCategories.id as any, row.id as any) as any)
        .returning();
      row = updated;
    }
    // Invalidate marketplace stats cache
    revalidateTag("marketplace:stats", {});
    return NextResponse.json(
      {
        item: {
          id: row.id,
          path: normalizePath(row.path as unknown as string[]),
          isNsfw: row.isNsfw ?? false,
        },
      },
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
