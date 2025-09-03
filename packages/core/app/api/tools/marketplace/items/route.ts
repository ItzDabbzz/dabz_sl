import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mpItems, mpCategories, mpItemCategories } from "@/schemas/sl-schema";
import { and, count, eq, inArray, sql, desc, asc, notInArray, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { revalidateTag } from "next/cache";

async function getUserFromRequest(req: NextRequest) {
  const ses = await auth.api.getSession({ headers: req.headers as any });
  if (!ses?.user) throw new Error("unauthorized");
  return ses.user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const q = (searchParams.get("q") || "").trim();
    const sort = (searchParams.get("sort") || "most").toLowerCase(); // most | least
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "25", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));
    const uncategorized = (searchParams.get("uncategorized") || "").toLowerCase() === "true";
    const sinceMinutes = parseInt(searchParams.get("sinceMinutes") || "", 10);
    const idsParam = (searchParams.get("ids") || "").trim();
    const idList = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];

    let where = and(eq(mpItems.ownerUserId as any, user.id as any) as any);

    // Filter by specific ids (batch view)
    if (idList.length) {
      where = and(where, inArray(mpItems.id as any, idList as any) as any);
    }

    // Filter by category via join table
    if (categoryId) {
      const itemIdRows = await db
        .select({ itemId: mpItemCategories.itemId })
        .from(mpItemCategories)
        .where(eq(mpItemCategories.categoryId as any, categoryId as any) as any);
      const ids = itemIdRows.map((r: any) => r.itemId);
      if (!ids.length) return NextResponse.json({ items: [], total: 0, limit, offset });
      where = and(where, inArray(mpItems.id as any, ids as any) as any);
    }

    // Uncategorized: exclude any item that appears in join table
    if (uncategorized) {
      const withCats = await db
        .select({ itemId: mpItemCategories.itemId })
        .from(mpItemCategories);
      const withIds = withCats.map((r: any) => r.itemId);
      if (withIds.length) {
        where = and(where, notInArray(mpItems.id as any, withIds as any) as any);
      }
    }

    // Time filter: items created in the last N minutes
    if (!Number.isNaN(sinceMinutes) && sinceMinutes > 0) {
      const since = new Date(Date.now() - sinceMinutes * 60_000);
      where = and(where, sql`${mpItems.createdAt} >= ${since}` as any);
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

    const [{ value: total }] = (await db
      .select({ value: count() })
      .from(mpItems)
      .where(where as any)) as any;

    let query = db.select().from(mpItems).where(where as any) as any;
    if (sort === "most") {
      query = query.orderBy(desc(mpItems.ratingCount as any), desc(mpItems.ratingAvg as any));
    } else if (sort === "least") {
      query = query.orderBy(asc(mpItems.ratingCount as any), asc(mpItems.ratingAvg as any));
    }

    try {
      const itemRows = await query.limit(limit as any).offset(offset as any);
      return NextResponse.json({ items: itemRows, total, limit, offset });
    } catch (err: any) {
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
    if (e?.message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// Import items and attach categories
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    const body = await req.json();
    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    const assign: Array<{ url: string; categories: Array<{ primary: string; sub?: string }> }> = body?.assign || [];

    // Upsert categories and map names to ids
    const catMap = new Map<string, string>();
    const ensureCat = async (primary: string, sub = "All") => {
      const [row] = await db
        .insert(mpCategories)
        .values({ primary, sub, ownerUserId: user.id as any })
        .onConflictDoNothing()
        .returning();
      const key = `${primary}::${sub}`;
      if (row?.id) catMap.set(key, row.id);
      if (!row?.id) {
        const existing = await db
          .select()
          .from(mpCategories)
          .where(eq(mpCategories.primary as any, primary as any) as any);
        const found = existing.find((c: any) => c.sub === sub && c.ownerUserId === user.id);
        if (found) catMap.set(key, found.id);
      }
      return catMap.get(key)!;
    };

    // Insert/update items
    const results: any[] = [];
    for (const it of items) {
      const values = {
        ownerUserId: user.id as any,
        url: it.url,
        title: it.title,
        version: it.version || null,
        images: it.images || [],
        price: it.price || null,
        creator: it.creator || null,
        store: it.store || null,
        permissions: it.permissions || null,
        description: it.description || null,
        features: it.features || [],
        contents: it.contents || [],
        updatedOn: it.updatedOn || null,
      } as any;

      let row;
      try {
        [row] = await db.insert(mpItems).values(values).returning();
      } catch {
        // conflict on url -> update
        const [existing] = await db.select().from(mpItems).where(eq(mpItems.url as any, it.url as any) as any);
        if (existing) {
          [row] = await db
            .update(mpItems)
            .set({ ...values, updatedAt: new Date() as any })
            .where(eq(mpItems.id as any, existing.id as any) as any)
            .returning();
        }
      }
      if (!row) continue;

      // Attach categories
      const catSpec = assign.find((a) => a.url === it.url)?.categories || [];
      for (const c of catSpec) {
        const cid = await ensureCat(c.primary, c.sub || "All");
        try {
          await db
            .insert(mpItemCategories)
            .values({ itemId: row.id as any, categoryId: cid as any })
            .onConflictDoNothing();
        } catch {}
      }

      results.push(row);
    }

    // Invalidate stats cache after import
    revalidateTag("marketplace:stats");

    return NextResponse.json({ items: results }, { status: 201 });
  } catch (e: any) {
    if (e?.message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}

function isAdminId(id: string | undefined | null) {
  const admins = (process.env.BETTER_AUTH_ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return !!id && admins.includes(id);
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!isAdminId(user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = await req.json();
    const id = body?.id as string | undefined;
    const updates = body?.updates as any;
    if (!id || !updates) return NextResponse.json({ error: "bad_request" }, { status: 400 });

    const [row] = await db
      .update(mpItems)
      .set({ ...updates, updatedAt: new Date() as any })
      .where(eq(mpItems.id as any, id as any) as any)
      .returning();

    revalidateTag("marketplace:stats");
    return NextResponse.json({ item: row });
  } catch (e: any) {
    if (e?.message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!isAdminId(user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

    // Delete mappings first to satisfy FK if any, then item
    await db.delete(mpItemCategories).where(eq(mpItemCategories.itemId as any, id as any) as any);
    const [row] = await db.delete(mpItems).where(eq(mpItems.id as any, id as any) as any).returning();

    revalidateTag("marketplace:stats");
    return NextResponse.json({ item: row });
  } catch (e: any) {
    if (e?.message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
