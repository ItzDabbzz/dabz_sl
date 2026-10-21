import { revalidatePath } from "next/cache";

/**
 * Telling the caches that a page has changed.
 *
 * The public page is cached, so a change to the page behind it has to be
 * announced. Clearing a cache is housekeeping, though, and housekeeping
 * that fails must not undo the change that was already made - the
 * creator's edit is saved either way, and a stale cache is a smaller
 * problem than a lost edit reported as an error.
 *
 * The paths that are cleared are the console and the public page at the
 * old and the new address, because the address itself may have changed.
 */
export function refreshProfileCaches(
    slugs: Array<string | null | undefined>,
): void {
    const paths = new Set<string>(["/dashboard/profile"]);
    for (const slug of slugs) {
        if (slug) paths.add(`/c/${slug}`);
    }

    for (const path of paths) {
        try {
            revalidatePath(path);
        } catch (error) {
            console.warn(
                `creator-profile: could not refresh ${path}`,
                error,
            );
        }
    }
}
