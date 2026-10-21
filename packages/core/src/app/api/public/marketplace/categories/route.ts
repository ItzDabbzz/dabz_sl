// The response depends on the query - the NSFW filter changes what is
// returned - so it is served live rather than cached for every caller.
export const dynamic = "force-dynamic";
export const revalidate = 300;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpCategories, mpItemCategories } from "@/schemas/sl-schema";
import { count } from "drizzle-orm";
import {
    normalizePath,
} from "@/features/marketplace/shared/category-path";

export async function GET(req: NextRequest) {
  try {
    const showNsfw = req.nextUrl.searchParams.get("showNsfw") === "true";
    const rows = await db
      .select({
        id: mpCategories.id,
        path: mpCategories.path,
        isNsfw: mpCategories.isNsfw,
      })
      .from(mpCategories);

    // A category marked as adult is hidden until the visitor asks for it.
    const visible = showNsfw
      ? rows
      : rows.filter((row) => !row.isNsfw);

    // Items are tagged with the deepest category they belong to, so a parent
    // holds almost nothing of its own. The tree shows the total of the whole
    // branch, which is the number a shopper actually wants.
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

    const categories = visible.map((row) => ({
        id: row.id as string,
        path: normalizePath(row.path as unknown as string[]),
        direct: directCounts.get(row.id as string) ?? 0,
        isNsfw: row.isNsfw ?? false,
    }));

    // Roll the direct counts up the path: a branch total is the node plus
    // every descendant.
    const totals = new Map<string, number>();
    for (const category of categories) {
      const key = category.path.join("\u001f");
      const own = totals.get(key) ?? 0;
      totals.set(key, own + category.direct);
    }
    for (const category of categories) {
      for (let depth = category.path.length - 1; depth > 0; depth--) {
        const parentKey = category.path.slice(0, depth).join("\u001f");
        totals.set(parentKey, (totals.get(parentKey) ?? 0) + category.direct);
      }
    }

    // The tree is deeper than a fixed number of levels, so the path travels
    // with the row and the client renders whatever depth it has.
    return NextResponse.json({
      items: categories.map((category) => ({
        id: category.id,
        path: category.path,
        // The total of the whole branch, for a shopper reading the tree.
        count: totals.get(category.path.join("\u001f")) ?? 0,
        // The items tagged to this exact category.
        direct: category.direct,
        // Whether the branch holds adult material, so the client can mark it.
        isNsfw: category.isNsfw,
      })),
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
