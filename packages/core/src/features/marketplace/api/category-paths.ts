/**
 * Resolving and creating category paths on the server.
 *
 * A category is a path of segments. This module is the only place that knows
 * how a path maps to a row, so the API routes and the import all agree on how
 * a path is found or created.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mpCategories } from "@/schemas/sl-schema";
import {
    normalizePath,
    pathKey,
    type CategoryPath,
} from "@/features/marketplace/shared/category-path";

/**
 * Find the category row for a path, or create it.
 *
 * The row is looked up before inserting because the unique index cannot do it
 * for us on its own: it spans `org_id` and `team_id`, which are NULL for
 * these rows, and Postgres treats NULLs as distinct in a unique index — so
 * the constraint does not fire for a NULL-bearing row and an insert would
 * silently create a duplicate path. The live index is created NULLS NOT
 * DISTINCT as a backstop, but the lookup is what makes this correct.
 */
export async function resolveCategoryPath(
    path: CategoryPath,
    ownerUserId: string,
): Promise<string | undefined> {
    const segments = normalizePath(path);
    if (!segments.length) return undefined;

    const existing = await db
        .select({ id: mpCategories.id })
        .from(mpCategories)
        .where(
            and(
                eq(mpCategories.path as any, segments as any) as any,
                eq(mpCategories.ownerUserId as any, ownerUserId as any) as any,
            ),
        )
        .limit(1);

    if (existing[0]?.id) return existing[0].id;

    const [created] = await db
        .insert(mpCategories)
        .values({ path: segments, ownerUserId: ownerUserId as any } as any)
        .returning({ id: mpCategories.id });

    return created?.id;
}

/**
 * Every category path that exists for a user, as path arrays.
 *
 * Used to build the picker and to match imported paths against the tree.
 *
 * This is a better-drizzle delegate: the table's own queries, typed, without
 * the query builder. The path column is a text array, so the lookup for one
 * specific path stays on the raw client below.
 */
export async function listCategoryPaths(
    ownerUserId: string | null,
): Promise<CategoryPath[]> {
    const rows = await db.mpCategories.findMany({
        ...(ownerUserId ? { where: { ownerUserId } } : {}),
        select: { path: true },
    });

    return rows.map((row) => normalizePath(row.path as unknown as string[]));
}

/**
 * The category rows for a user, with their paths.
 *
 * The id is needed alongside the path so a caller can act on a specific row.
 */
export async function listCategoryRows(ownerUserId: string | null) {
    const rows = await db.mpCategories.findMany({
        ...(ownerUserId ? { where: { ownerUserId } } : {}),
        select: { id: true, path: true },
    });

    return rows.map((row) => ({
        id: row.id,
        path: normalizePath(row.path as unknown as string[]),
    }));
}

/**
 * The row for a path, or null.
 *
 * Unlike `resolveCategoryPath` this never creates anything.
 */
export async function findCategoryByPath(
    path: CategoryPath,
    ownerUserId: string,
): Promise<{ id: string; path: string[] } | null> {
    const segments = normalizePath(path);
    if (!segments.length) return null;

    const [row] = await db
        .select({ id: mpCategories.id, path: mpCategories.path })
        .from(mpCategories)
        .where(
            and(
                eq(mpCategories.path as any, segments as any) as any,
                eq(mpCategories.ownerUserId as any, ownerUserId as any) as any,
            ),
        )
        .limit(1);

    if (!row) return null;
    return {
        id: row.id,
        path: normalizePath(row.path as unknown as string[]),
    };
}

/** A stable key for a path. Re-exported so writers and readers share it. */
export { pathKey };
export type { CategoryPath };
