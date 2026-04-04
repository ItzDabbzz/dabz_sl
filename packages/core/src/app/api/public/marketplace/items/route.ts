export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mpItems, mpItemCategories } from "@/schemas/sl-schema";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const q = (searchParams.get("q") || "").trim();
  const sort = (searchParams.get("sort") || "most").toLowerCase(); // most | least
  const author = (searchParams.get("author") || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "24", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    let where: any = sql`true` as any;

    // Filter by category via join table
    if (categoryId) {
      const itemIdRows = await db
        .select({ itemId: mpItemCategories.itemId })
        .from(mpItemCategories)
        .where(eq(mpItemCategories.categoryId as any, categoryId as any) as any);
      const ids = itemIdRows.map((r: any) => r.itemId);
      if (!ids.length)
        return NextResponse.json({ items: [], total: 0, limit, offset });
      where = and(where, inArray(mpItems.id as any, ids as any) as any);
    }

    // Text search on title/description
    if (q) {
      const pat = `%${q.toLowerCase()}%`;
      const lower = (c: any) => sql`lower(${c})` as any;
      where = and(
        where,
        sql`(${lower(mpItems.title)} like ${pat} or ${lower(mpItems.description)} like ${pat})` as any
      );
    }

    // Author filter (creator.name JSON -> we store entire object in jsonb creator column)
    if (author) {
      const pat = `%${author}%`;
      // Use textual representation search. For more robust queries consider jsonb_extract_path_text.
      where = and(
        where,
        sql`lower(${mpItems.creator}::text) like ${pat}` as any
      );
    }

    const [{ value: total }] = (await db
      .select({ value: count() })
      .from(mpItems)
      .where(where as any)) as any;

    // Order by ratings if available; fallback handled below
    let query: any = db.select().from(mpItems).where(where as any);
    if (sort === "most") {
      query = query.orderBy(desc(mpItems.ratingCount as any), desc(mpItems.ratingAvg as any));
    } else if (sort === "least") {
      query = query.orderBy(asc(mpItems.ratingCount as any), asc(mpItems.ratingAvg as any));
    }

    try {
      const itemRows = await query.limit(limit as any).offset(offset as any);
      return NextResponse.json({ items: itemRows, total, limit, offset });
    } catch (err: any) {
      // Fallback if rating columns missing
      const pgCode = err?.code || err?.cause?.code;
      if (pgCode === "42703") {
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
          .where(where as any)
          .limit(limit as any)
          .offset(offset as any);
        return NextResponse.json({ items: fallbackRows, total, limit, offset });
      }
      throw err;
    }
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });


  }
}
