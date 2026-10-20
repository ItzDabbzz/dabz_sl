/**
 * The shape of a category path.
 *
 * A category is a path of segments — `Apparel › Women's › Women's Boots` —
 * stored as a single `text[]` column. Depth is unbounded: the marketplace's
 * own tree is four levels deep, and a category can subdivide past that
 * without a schema migration. Moving or renaming a node is then a
 * single-column rewrite rather than an N-column one.
 *
 * The helpers live here rather than in the schema module so a client
 * component can use them without pulling the whole Drizzle schema into the
 * browser bundle. Writer and reader share this one module on purpose —
 * comparing paths with different separators silently fails to match, and the
 * symptom looks like "the category is missing".
 */

/** A category path: an array of segments, root first. */
export type CategoryPath = string[];

/**
 * Trim a path: drop empty segments.
 *
 * The "All" sentinel is deliberately NOT filtered. It used to pad the fixed
 * level columns out to the full depth; with the path model there is nothing to
 * pad, so a category genuinely named "All" is a real segment.
 */
export function normalizePath(
    path: Array<string | null | undefined>,
): string[] {
    return path
        .map((p) => (p ?? "").trim())
        .filter((p) => p.length > 0);
}

/** A stable key for a path. */
export function pathKey(path: CategoryPath): string {
    return normalizePath(path).join("\u001f");
}

/** A human-readable label for a path. */
export function pathLabel(path: CategoryPath): string {
    const parts = normalizePath(path);
    return parts.length ? parts.join(" › ") : "Uncategorised";
}

/** The parent of a path, or null at the root. */
export function parentPath(path: CategoryPath): CategoryPath | null {
    const parts = normalizePath(path);
    if (parts.length <= 1) return null;
    return parts.slice(0, -1);
}

/**
 * True when `prefix` is a prefix of `path`.
 *
 * Used to match an imported path against the existing tree by longest
 * common prefix.
 */
export function isPathPrefix(
    prefix: CategoryPath,
    path: CategoryPath,
): boolean {
    const a = normalizePath(prefix);
    const b = normalizePath(path);
    if (a.length > b.length) return false;
    return a.every((segment, i) => segment === b[i]);
}
