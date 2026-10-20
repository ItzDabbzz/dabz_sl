/**
 * Grouping scraped items by their marketplace category path, and matching
 * those paths to the categories that already exist.
 *
 * Why this exists: a store of 2,000 items does not have 2,000 categories to
 * assign. The marketplace's own category path is the same for every item in a
 * group, and a store typically collapses into a few dozen distinct paths. So
 * the unit of work is the *path*, not the item — which turns 2,000 decisions
 * into a few dozen.
 */

import {
    normalizePath,
    pathKey,
    pathLabel,
} from "@/features/marketplace/shared/category-path";
import type { ScrapedItem } from "./types";

export { normalizePath, pathKey, pathLabel };
export type { CategoryPath } from "@/features/marketplace/shared/category-path";

/** Items that share a marketplace category path. */
export interface PathGroup {
    /** The marketplace's own path, e.g. ["Apparel", "Women's", "Boots"]. */
    path: string[];
    /** The items in this group. */
    items: ScrapedItem[];
}

/** The marketplace path of an item, as an array of levels. */
export function pathOf(item: ScrapedItem): string[] {
    return normalizePath(item.itemCategories ?? []);
}

/**
 * Group items by their marketplace category path.
 *
 * Items with no path land in one "Uncategorised" group, so they are still
 * visible and assignable rather than silently dropped.
 */
export function groupByPath(items: ScrapedItem[]): PathGroup[] {
    const groups = new Map<string, PathGroup>();

    for (const item of items) {
        const path = pathOf(item);
        const key = pathKey(path) || "uncategorised";
        let group = groups.get(key);
        if (!group) {
            group = { path, items: [] };
            groups.set(key, group);
        }
        group.items.push(item);
    }

    return Array.from(groups.values()).sort(
        (a, b) => b.items.length - a.items.length,
    );
}

/**
 * Suggest the category a marketplace path should map to.
 *
 * The suggestion prefers a category that already exists, so an import lands
 * inside the tree that is already there rather than minting new branches:
 *
 *   1. an exact match on the whole path
 *   2. the deepest existing prefix of the path, with the rest of the
 *      marketplace path as new deeper levels
 *   3. otherwise the marketplace's own path, in full
 *
 * The marketplace's own path is four levels deep, and the tree here is
 * deeper still, so an import can end up more detailed than the marketplace.
 */
export function suggestCategory(
    path: string[],
    existing: string[][],
): string[] | null {
    const segments = normalizePath(path);
    if (!segments.length) return null;

    // 1. Exact match.
    for (const candidate of existing) {
        if (pathKey(candidate) === pathKey(segments)) {
            return normalizePath(candidate);
        }
    }

    // 2. The deepest existing prefix, with the marketplace's tail as new
    //    deeper levels.
    for (let depth = segments.length - 1; depth >= 1; depth--) {
        const prefix = segments.slice(0, depth);
        for (const candidate of existing) {
            const normalized = normalizePath(candidate);
            if (pathKey(normalized) === pathKey(prefix)) {
                return normalizePath([...normalized, ...segments.slice(depth)]);
            }
        }
    }

    // 3. Nothing to reuse — use the marketplace's own path.
    return segments;
}

/**
 * Whether a path could be split further.
 *
 * The tree's depth is unbounded — a path is an array, not a fixed set of
 * columns — so a path can always be split one level deeper. The function is
 * kept so the call sites read the same as before.
 */
export function canGoDeeper(_path: string[]): boolean {
    return true;
}
