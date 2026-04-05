export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpItems, mpCategories, mpItemCategories } from "@/schemas/sl-schema";
import {
    and,
    count,
    eq,
    inArray,
    sql,
    desc,
    asc,
    notInArray,
} from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { requirePermission } from "@/server/auth/guards";
import { requireUserFromRequest } from "@/server/auth/session";
import {
    isConfiguredAdminId,
    isPrivilegedMarketplaceRole,
} from "@/server/auth/roles";

function isPrivileged(user: any): boolean {
    return (
        isPrivilegedMarketplaceRole((user as any).role) ||
        isConfiguredAdminId((user as any).id)
    );
}

function isMissingColumnError(error: unknown) {
    const candidate = error as { code?: string; cause?: { code?: string } };
    return candidate?.code === "42703" || candidate?.cause?.code === "42703";
}

function normalizeIsNsfw(value: unknown): boolean {
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return ["true", "1", "yes", "on"].includes(normalized);
    }

    return value === true || value === 1;
}

async function insertMarketplaceItem(values: Record<string, unknown>) {
    try {
        const [row] = await db.insert(mpItems).values(values as any).returning();
        return row;
    } catch (error) {
        if (!isMissingColumnError(error) || !("isNsfw" in values)) {
            throw error;
        }

        const { isNsfw: _isNsfw, ...legacyValues } = values;
        const [row] = await db
            .insert(mpItems)
            .values(legacyValues as any)
            .returning();
        return row;
    }
}

async function updateMarketplaceItem(
    id: string,
    values: Record<string, unknown>,
) {
    try {
        const [row] = await db
            .update(mpItems)
            .set(values as any)
            .where(eq(mpItems.id as any, id as any) as any)
            .returning();
        return row;
    } catch (error) {
        if (!isMissingColumnError(error) || !("isNsfw" in values)) {
            throw error;
        }

        const { isNsfw: _isNsfw, ...legacyValues } = values;
        const [row] = await db
            .update(mpItems)
            .set(legacyValues as any)
            .where(eq(mpItems.id as any, id as any) as any)
            .returning();
        return row;
    }
}

export async function GET(req: NextRequest) {
    try {
        const user = await requireUserFromRequest(req);
        const { searchParams } = new URL(req.url);
        const categoryId = searchParams.get("categoryId");
        const q = (searchParams.get("q") || "").trim();
        const sort = (searchParams.get("sort") || "most").toLowerCase(); // most | least
        const limit = Math.max(
            1,
            Math.min(100, parseInt(searchParams.get("limit") || "25", 10)),
        );
        const offset = Math.max(
            0,
            parseInt(searchParams.get("offset") || "0", 10),
        );
        const uncategorized =
            (searchParams.get("uncategorized") || "").toLowerCase() === "true";
        const sinceMinutes = parseInt(
            searchParams.get("sinceMinutes") || "",
            10,
        );
        const idsParam = (searchParams.get("ids") || "").trim();
        const idsOnly =
            (searchParams.get("idsOnly") || "").toLowerCase() === "true";
        const idList = idsParam
            ? idsParam
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
            : [];

        let where = isPrivileged(user)
            ? undefined
            : and(eq(mpItems.ownerUserId as any, user.id as any) as any);

        // Filter by specific ids (batch view)
        if (idList.length) {
            where = and(
                where,
                inArray(mpItems.id as any, idList as any) as any,
            );
        }

        // Filter by category via join table
        if (categoryId) {
            const itemIdRows = await db
                .select({ itemId: mpItemCategories.itemId })
                .from(mpItemCategories)
                .where(
                    eq(
                        mpItemCategories.categoryId as any,
                        categoryId as any,
                    ) as any,
                );
            const ids = itemIdRows.map((r: any) => r.itemId);
            if (!ids.length)
                return NextResponse.json({
                    items: idsOnly ? undefined : [],
                    ids: idsOnly ? [] : undefined,
                    total: 0,
                    limit,
                    offset,
                });
            where = and(where, inArray(mpItems.id as any, ids as any) as any);
        }

        // Uncategorized: exclude any item that appears in join table
        if (uncategorized) {
            const withCats = await db
                .select({ itemId: mpItemCategories.itemId })
                .from(mpItemCategories);
            const withIds = withCats.map((r: any) => r.itemId);
            if (withIds.length) {
                where = and(
                    where,
                    notInArray(mpItems.id as any, withIds as any) as any,
                );
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
                sql`(${lower(mpItems.title)} like ${pat} or ${lower(mpItems.description)} like ${pat})` as any,
            );
        }

        const [{ value: total }] = (await db
            .select({ value: count() })
            .from(mpItems)
            .where(where as any)) as any;

        if (idsOnly) {
            const idRows = await db
                .select({ id: mpItems.id })
                .from(mpItems)
                .where(where as any);
            return NextResponse.json({
                ids: idRows.map((row: any) => row.id),
                total,
            });
        }

        let query = db
            .select()
            .from(mpItems)
            .where(where as any) as any;
        if (sort === "most") {
            query = query.orderBy(
                desc(mpItems.ratingCount as any),
                desc(mpItems.ratingAvg as any),
            );
        } else if (sort === "least") {
            query = query.orderBy(
                asc(mpItems.ratingCount as any),
                asc(mpItems.ratingAvg as any),
            );
        }

        try {
            const itemRows = await query
                .limit(limit as any)
                .offset(offset as any);
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
                return NextResponse.json({
                    items: fallbackRows,
                    total,
                    limit,
                    offset,
                });
            }
            throw err;
        }
    } catch (e: any) {
        if (e?.message === "unauthorized")
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        console.error(e);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

// Import items and attach categories
export async function POST(req: NextRequest) {
    try {
        await requirePermission("marketplace.edit", req.headers as any);
        const user = await requireUserFromRequest(req);
        const body = await req.json();
        const items: any[] = Array.isArray(body?.items) ? body.items : [];
        const assign: Array<{
            url: string;
            categories: Array<{ primary: string; sub?: string }>;
        }> = body?.assign || [];

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
                    .where(
                        eq(mpCategories.primary as any, primary as any) as any,
                    );
                const found = existing.find(
                    (c: any) => c.sub === sub && c.ownerUserId === user.id,
                );
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
                isNsfw: normalizeIsNsfw(it.isNsfw),
                updatedOn: it.updatedOn || null,
            } as any;

            let row;
            try {
                row = await insertMarketplaceItem(values);
            } catch {
                // conflict on url -> update
                const [existing] = await db
                    .select({ id: mpItems.id })
                    .from(mpItems)
                    .where(eq(mpItems.url as any, it.url as any) as any);
                if (existing) {
                    row = await updateMarketplaceItem(existing.id, {
                        ...values,
                        updatedAt: new Date() as any,
                    });
                }
            }
            if (!row) continue;

            // Attach categories
            const catSpec =
                assign.find((a) => a.url === it.url)?.categories || [];
            for (const c of catSpec) {
                const cid = await ensureCat(c.primary, c.sub || "All");
                try {
                    await db
                        .insert(mpItemCategories)
                        .values({
                            itemId: row.id as any,
                            categoryId: cid as any,
                        })
                        .onConflictDoNothing();
                } catch {}
            }

            results.push(row);
        }

        // Invalidate stats cache after import
        revalidateTag("marketplace:stats", {});

        return NextResponse.json({ items: results }, { status: 201 });
    } catch (e: any) {
        if (e?.message === "unauthorized")
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        if (e?.message === "forbidden")
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        console.error(e);
        return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const user = await requireUserFromRequest(req);
        if (!isPrivileged(user)) {
            await requirePermission("marketplace.moderate", req.headers as any);
        }
        const body = await req.json();
        const id = body?.id as string | undefined;
        const ids = Array.isArray(body?.ids)
            ? (body.ids as unknown[])
                  .filter((value): value is string => typeof value === "string")
                  .map((value) => value.trim())
                  .filter(Boolean)
            : [];
        const updates = body?.updates ? { ...body.updates } : null;
        if ((!id && !ids.length) || !updates)
            return NextResponse.json({ error: "bad_request" }, { status: 400 });

        if ("isNsfw" in updates) {
            updates.isNsfw = normalizeIsNsfw(updates.isNsfw);
        }

        const now = new Date() as any;

        if (ids.length) {
            const uniqueIds = Array.from(new Set(ids));
            await db
                .update(mpItems)
                .set({ ...updates, updatedAt: now } as any)
                .where(inArray(mpItems.id as any, uniqueIds as any) as any);

            revalidateTag("marketplace:stats", {});
            return NextResponse.json({ updated: uniqueIds.length });
        }

        const row = await updateMarketplaceItem(id!, {
            ...updates,
            updatedAt: now,
        });

        revalidateTag("marketplace:stats", {});
        return NextResponse.json({ item: row });
    } catch (e: any) {
        if (e?.message === "unauthorized")
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        if (e?.message === "forbidden")
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        console.error(e);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        await requirePermission("marketplace.admin", req.headers as any);
        const user = await requireUserFromRequest(req);
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        const idsParam = (searchParams.get("ids") || "").trim();
        let idsFromBody: string[] = [];
        if (!idsParam && !id) {
            try {
                const body = await req.json();
                idsFromBody = Array.isArray(body?.ids)
                    ? (body.ids as unknown[])
                          .filter((value): value is string =>
                              typeof value === "string",
                          )
                          .map((value) => value.trim())
                          .filter(Boolean)
                    : [];
            } catch {}
        }

        const ids = idsParam
            ? idsParam
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean)
            : idsFromBody;

        if (!id && !ids.length)
            return NextResponse.json({ error: "bad_request" }, { status: 400 });

        if (ids.length) {
            const privileged = isPrivileged(user);
            const ownedRows = privileged
                ? await db
                      .select({ id: mpItems.id })
                      .from(mpItems)
                      .where(inArray(mpItems.id as any, ids as any) as any)
                : await db
                      .select({ id: mpItems.id })
                      .from(mpItems)
                      .where(
                          and(
                              inArray(mpItems.id as any, ids as any) as any,
                              eq(mpItems.ownerUserId as any, user.id as any) as any,
                          ) as any,
                      );
            const ownedIds = ownedRows.map((row: any) => row.id);
            if (!ownedIds.length) {
                return NextResponse.json({ deleted: 0 });
            }

            await db
                .delete(mpItemCategories)
                .where(
                    inArray(mpItemCategories.itemId as any, ownedIds as any) as any,
                );
            await db
                .delete(mpItems)
                .where(inArray(mpItems.id as any, ownedIds as any) as any);

            revalidateTag("marketplace:stats", {});
            return NextResponse.json({ deleted: ownedIds.length });
        }

        // Delete mappings first to satisfy FK if any, then item
        await db
            .delete(mpItemCategories)
            .where(eq(mpItemCategories.itemId as any, id as any) as any);
        const [row] = await db
            .delete(mpItems)
            .where(eq(mpItems.id as any, id as any) as any)
            .returning();

        revalidateTag("marketplace:stats", {});
        return NextResponse.json({ item: row });
    } catch (e: any) {
        if (e?.message === "unauthorized")
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        if (e?.message === "forbidden")
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        console.error(e);
        return NextResponse.json({ error: "server_error" }, { status: 500 });



    }
}
