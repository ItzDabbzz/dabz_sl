import { db } from "@/server/db/client";
import { and, eq, inArray } from "drizzle-orm";
import { creatorProfiles } from "@/schemas/creator";
import { user } from "@/schemas/auth-schema";
import { organization } from "@/schemas/auth-schema";

/**
 * The handle a creator's posts live under.
 *
 * A post is addressed by the creator who wrote it and the post itself,
 * so the URL says who is speaking: /blog/dabz/rlv-deep-dive.
 */

/** Turn a name into something that can sit in a URL. */
export function slugifyHandle(name: string | null | undefined) {
    return (name ?? "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "")
        .slice(0, 48);
}

/** A post and the person who wrote it. */
export type HandleablePost = {
    id?: string;
    authorUserId?: string | null;
    authorOrganizationId?: string | null;
    authorName?: string | null;
};

/**
 * The handle of one post's author.
 *
 * A creator page decides the handle when there is one; otherwise the
 * name is used, so a creator has a URL from the moment they post.
 */
export async function resolveAuthorHandle(
    post: HandleablePost,
): Promise<string> {
    if (post.authorOrganizationId) {
        const [profile] = await db
            .select({ slug: creatorProfiles.slug })
            .from(creatorProfiles)
            .where(
                and(
                    eq(creatorProfiles.ownerType, "organization"),
                    eq(creatorProfiles.ownerId, post.authorOrganizationId),
                ),
            )
            .limit(1);
        if (profile) return profile.slug;

        const [org] = await db
            .select({ name: organization.name })
            .from(organization)
            .where(eq(organization.id, post.authorOrganizationId))
            .limit(1);
        return slugifyHandle(org?.name) || "creator";
    }

    if (post.authorUserId) {
        const [profile] = await db
            .select({ slug: creatorProfiles.slug })
            .from(creatorProfiles)
            .where(
                and(
                    eq(creatorProfiles.ownerType, "user"),
                    eq(creatorProfiles.ownerId, post.authorUserId),
                ),
            )
            .limit(1);
        if (profile) return profile.slug;

        if (!post.authorName) {
            const [person] = await db
                .select({ name: user.name })
                .from(user)
                .where(eq(user.id, post.authorUserId))
                .limit(1);
            return slugifyHandle(person?.name) || "creator";
        }
        return slugifyHandle(post.authorName) || "creator";
    }

    return "creator";
}

/**
 * The handles of many posts at once.
 *
 * A list of posts asks for all of their authors in one go, rather than
 * one query per row.
 */
export async function resolveHandles(
    posts: HandleablePost[],
): Promise<Map<string, string>> {
    const handles = new Map<string, string>();
    if (!posts.length) return handles;

    const userIds = [
        ...new Set(
            posts
                .map((p) => p.authorUserId)
                .filter((id): id is string => !!id),
        ),
    ];
    const orgIds = [
        ...new Set(
            posts
                .map((p) => p.authorOrganizationId)
                .filter((id): id is string => !!id),
        ),
    ];

    const userProfiles = userIds.length
        ? await db
              .select({
                  ownerId: creatorProfiles.ownerId,
                  slug: creatorProfiles.slug,
              })
              .from(creatorProfiles)
              .where(
                  and(
                      eq(creatorProfiles.ownerType, "user"),
                      inArray(creatorProfiles.ownerId, userIds),
                  ),
              )
        : [];
    const orgProfiles = orgIds.length
        ? await db
              .select({
                  ownerId: creatorProfiles.ownerId,
                  slug: creatorProfiles.slug,
              })
              .from(creatorProfiles)
              .where(
                  and(
                      eq(creatorProfiles.ownerType, "organization"),
                      inArray(creatorProfiles.ownerId, orgIds),
                  ),
              )
        : [];

    const userProfileById = new Map(
        userProfiles.map((row) => [row.ownerId, row.slug]),
    );
    const orgProfileById = new Map(
        orgProfiles.map((row) => [row.ownerId, row.slug]),
    );

    // The names of authors that have no creator page yet.
    const missingUserIds = userIds.filter((id) => !userProfileById.has(id));
    const names = missingUserIds.length
        ? await db
              .select({ id: user.id, name: user.name })
              .from(user)
              .where(inArray(user.id, missingUserIds))
        : [];
    const nameById = new Map(names.map((row) => [row.id, row.name]));

    const missingOrgIds = orgIds.filter((id) => !orgProfileById.has(id));
    const orgNames = missingOrgIds.length
        ? await db
              .select({ id: organization.id, name: organization.name })
              .from(organization)
              .where(inArray(organization.id, missingOrgIds))
        : [];
    const orgNameById = new Map(orgNames.map((row) => [row.id, row.name]));

    for (const post of posts) {
        if (!post.id) continue;
        let handle: string | null = null;
        if (post.authorOrganizationId) {
            handle =
                orgProfileById.get(post.authorOrganizationId) ??
                slugifyHandle(orgNameById.get(post.authorOrganizationId)) ??
                null;
        } else if (post.authorUserId) {
            handle =
                userProfileById.get(post.authorUserId) ??
                slugifyHandle(
                    post.authorName ?? nameById.get(post.authorUserId),
                ) ??
                null;
        }
        handles.set(post.id, handle || "creator");
    }

    return handles;
}

/** The address of a post. */
export function postPath(handle: string, slug: string) {
    return `/blog/${handle}/${slug}`;
}
