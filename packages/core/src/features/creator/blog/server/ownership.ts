import { isStaffUser } from "@/features/auth/permissions/staff";
import { PermissionService } from "@/server/auth/permission-service";

/** The part of a post that says who owns it. */
export type PostOwnership = {
    authorUserId?: string | null;
    authorOrganizationId?: string | null;
};

/**
 * Whether a user may change a post.
 *
 * A post belongs to the person who wrote it, or to the team it was
 * written for. Staff may change any post.
 *
 * Without this, anyone with the blog editor permission could rewrite
 * everyone else's posts by guessing an id - the blog was a single shared
 * board rather than a set of creator pages.
 */
export async function canEditPost(
    user: { id: string; role?: string | null } | null | undefined,
    post: PostOwnership | null | undefined,
): Promise<boolean> {
    if (!user || !post) return false;
    if (isStaffUser(user)) return true;

    // Their own post.
    if (post.authorUserId && post.authorUserId === user.id) return true;

    // A post of a team they write for.
    if (post.authorOrganizationId) {
        return await PermissionService.hasPermission(
            user.id,
            post.authorOrganizationId,
            "blog.write",
        );
    }

    return false;
}
