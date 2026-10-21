export const dynamic = 'force-dynamic';
export const revalidate = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpItems, mpItemCategories, mpCategories } from "@/schemas/sl-schema";
import { and, asc, count, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { normalizePath } from "@/features/marketplace/shared/category-path";

function isMissingColumnError(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === "42703" || candidate?.cause?.code === "42703";
}

type CategoryRow = { id: string; path: string[] };

/**
 * The category table, cached briefly.
 *
 * Items are tagged with the deepest category they belong to, so a parent
 * category has almost no items of its own. Resolving a selection to its
 * subtree needs the whole path of every category, which is a small table.
 */
let categoryCache: { rows: CategoryRow[]; at: number } | null = null;
const CATEGORY_CACHE_MS = 60_000;

async function loadCategories(): Promise<CategoryRow[]> {
  if (categoryCache && Date.now() - categoryCache.at < CATEGORY_CACHE_MS) {
    return categoryCache.rows;
  }
  const rows = await db
    .select({ id: mpCategories.id, path: mpCategories.path })
    .from(mpCategories);
  const normalized = rows.map((row) => ({
    id: row.id as string,
    path: normalizePath(row.path as unknown as string[]),
  }));
  categoryCache = { rows: normalized, at: Date.now() };
  return normalized;
}

/**
 * The ids of a category and everything beneath it.
 *
 * A category is a path, so "beneath" means the path starts with the
 * selected path. Selecting a parent must show the items of its whole
 * subtree, otherwise the parent looks empty.
 */
async function resolveSubtreeIds(categoryId: string): Promise<string[]> {
  const categories = await loadCategories();
  const selected = categories.find((c) => c.id === categoryId);
  if (!selected) return [categoryId];
  const prefix = selected.path;
  return categories
    .filter(
      (c) =>
        c.path.length >= prefix.length &&
        prefix.every((segment, i) => c.path[i] === segment),
    )
    .map((c) => c.id);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const q = (searchParams.get("q") || "").trim();
    const sort = (searchParams.get("sort") || "most").toLowerCase(); // most | least
    const author = (searchParams.get("author") || "").trim().toLowerCase();
    const showNsfw = searchParams.get("showNsfw") === "true";
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "24", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));
    // Optional explicit id list, used to resolve a shared compare selection
    // (?ids=a,b) whose items are not on the current page of results.
    const idsParam = (searchParams.get("ids") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const buildWhere = async (includeNsfwFilter: boolean) => {
      let where: any = sql`true` as any;

      if (idsParam.length) {
        where = and(where, inArray(mpItems.id as any, idsParam as any) as any);
      }

      if (categoryId) {
        // A parent category holds the items of everything beneath it. The
        // item ids are matched with a subquery so the category list stays
        // the only parameter - a parent can carry thousands of items.
        const subtreeIds = await resolveSubtreeIds(categoryId);
        const itemIds = db
          .select({ itemId: mpItemCategories.itemId })
          .from(mpItemCategories)
          .where(inArray(mpItemCategories.categoryId as any, subtreeIds as any) as any);
        where = and(where, inArray(mpItems.id as any, itemIds as any) as any);
      }

      if (q) {
        const pat = `%${q.toLowerCase()}%`;
        const lower = (c: any) => sql`lower(${c})` as any;
        where = and(
          where,
          sql`(${lower(mpItems.title)} like ${pat} or ${lower(mpItems.description)} like ${pat})` as any
        );
      }

      if (author) {
        const pat = `%${author}%`;
        where = and(
          where,
          sql`lower(${mpItems.creator}::text) like ${pat}` as any
        );
      }

      if (includeNsfwFilter) {
        where = and(where, sql`coalesce(${mpItems.isNsfw}, false) = false` as any);
      } else {
        // An item filed under a category marked as adult stays hidden until
        // the visitor asks for it, whatever the item's own flag says.
        const adultItemIds = db
          .select({ itemId: mpItemCategories.itemId })
          .from(mpItemCategories)
          .innerJoin(
            mpCategories,
            eq(mpItemCategories.categoryId as any, mpCategories.id as any) as any,
          )
          .where(eq(mpCategories.isNsfw as any, true) as any);
        where = and(where, notInArray(mpItems.id as any, adultItemIds as any) as any);
      }

      return where;
    };

    try {
      const where = await buildWhere(!showNsfw);
      if (!where) {
        return NextResponse.json({ items: [], total: 0, limit, offset });
      }

      const [{ value: total }] = (await db
        .select({ value: count() })
        .from(mpItems)
        .where(where as any)) as any;

      let query: any = db.select().from(mpItems).where(where as any);
      if (sort === "most") {
        query = query.orderBy(desc(mpItems.ratingCount as any), desc(mpItems.ratingAvg as any));
      } else if (sort === "least") {
        query = query.orderBy(asc(mpItems.ratingCount as any), asc(mpItems.ratingAvg as any));
      }

      const itemRows = await query.limit(limit as any).offset(offset as any);
      return NextResponse.json({ items: itemRows, total, limit, offset });
    } catch (err: any) {
      if (isMissingColumnError(err)) {
        const fallbackWhere = await buildWhere(false);
        if (!fallbackWhere) {
          return NextResponse.json({ items: [], total: 0, limit, offset });
        }

        const [{ value: fallbackTotal }] = (await db
          .select({ value: count() })
          .from(mpItems)
          .where(fallbackWhere as any)) as any;

        const fallbackRows = await db
          .select({
            id: mpItems.id,
            ownerUserId: mpItems.ownerUserId,
            orgId: mpItems.orgId,
            teamId: mpItems.teamId,
            url: mpItems.url,
            title: mpItems.title,
            version: mpItems.version,
            images: mpItems.images,
            price: mpItems.price,
            creator: mpItems.creator,
            store: mpItems.store,
            permissions: mpItems.permissions,
            description: mpItems.description,
            features: mpItems.features,
            contents: mpItems.contents,
            updatedOn: mpItems.updatedOn,
            createdAt: mpItems.createdAt,
            updatedAt: mpItems.updatedAt,
          })
          .from(mpItems)
          .where(fallbackWhere as any)
          .limit(limit as any)
          .offset(offset as any);
        return NextResponse.json({ items: fallbackRows, total: fallbackTotal, limit, offset });
      }
      throw err;
    }
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
