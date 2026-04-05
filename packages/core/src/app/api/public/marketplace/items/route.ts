export const revalidate = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpItems, mpItemCategories } from "@/schemas/sl-schema";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

function isMissingColumnError(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === "42703" || candidate?.cause?.code === "42703";
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

    const buildWhere = async (includeNsfwFilter: boolean) => {
      let where: any = sql`true` as any;

      if (categoryId) {
        const itemIdRows = await db
          .select({ itemId: mpItemCategories.itemId })
          .from(mpItemCategories)
          .where(eq(mpItemCategories.categoryId as any, categoryId as any) as any);
        const ids = itemIdRows.map((r: any) => r.itemId);
        if (!ids.length) return null;
        where = and(where, inArray(mpItems.id as any, ids as any) as any);
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
