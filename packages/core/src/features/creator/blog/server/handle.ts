import { db } from "@/server/db/client";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { creatorProfiles } from "@/schemas/creator";
import {
    blogCategories,
    blogPostCategories,
    blogPosts,
} from "@/schemas/blog";
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

/**
 * Who writes on the blog.
 *
 * A visitor should be able to read one person's work rather than
 * everybody's, so the blog needs to know who the authors are and what to
 * call them in a URL.
 */
export type AuthorRef = {
    /** The name the author's posts are addressed under. */
    handle: string;
    /** The author's name. */
    name: string | null;
    /** The author's picture. */
    image: string | null;
    /** The user id, when the author is a person. */
    authorUserId: string | null;
    /** The organization id, when the author is a team. */
    authorOrganizationId: string | null;
    /** How many published posts they have. */
    postCount: number;
    /** Whether they have a public creator page. */
    hasProfile: boolean;
};

/**
 * The authors with published posts.
 *
 * The list is by author, not by post, so a visitor can pick a person
 * and read only what they wrote.
 */
export async function listAuthors(options?: {
    /** Include posts that are not published yet (the console's own view). */
    includeUnpublished?: boolean;
}): Promise<AuthorRef[]> {
    const rows = await db
        .select({
            authorUserId: blogPosts.authorUserId,
            authorOrganizationId: blogPosts.authorOrganizationId,
            count: sql<number>`count(distinct ${blogPosts.id})::int`,
        })
        .from(blogPosts)
        .innerJoin(
            blogPostCategories,
            eq(blogPostCategories.postId, blogPosts.id),
        )
        .innerJoin(
            blogCategories,
            eq(blogPostCategories.categoryId, blogCategories.id),
        )
        .where(
            options?.includeUnpublished
                ? sql`true`
                : and(
                      eq(blogPosts.published, true),
                      sql`(${blogCategories.visibility} ->> 'mode') = 'public'`,
                  ),
        )
        .groupBy(blogPosts.authorUserId, blogPosts.authorOrganizationId);

    if (!rows.length) return [];

    const userIds = rows
        .map((r) => r.authorUserId)
        .filter((id): id is string => !!id);
    const orgIds = rows
        .map((r) => r.authorOrganizationId)
        .filter((id): id is string => !!id);

    const [people, teams, profiles] = await Promise.all([
        userIds.length
            ? db
                  .select({ id: user.id, name: user.name, image: user.image })
                  .from(user)
                  .where(inArray(user.id, userIds))
            : Promise.resolve([]),
        orgIds.length
            ? db
                  .select({ id: organization.id, name: organization.name })
                  .from(organization)
                  .where(inArray(organization.id, orgIds))
            : Promise.resolve([]),
        db
            .select({
                ownerId: creatorProfiles.ownerId,
                ownerType: creatorProfiles.ownerType,
                slug: creatorProfiles.slug,
            })
            .from(creatorProfiles)
            .where(
                or(
                    ...(userIds.length
                        ? [
                              and(
                                  eq(creatorProfiles.ownerType, "user"),
                                  inArray(creatorProfiles.ownerId, userIds),
                              ),
                          ]
                        : []),
                    ...(orgIds.length
                        ? [
                              and(
                                  eq(creatorProfiles.ownerType, "organization"),
                                  inArray(creatorProfiles.ownerId, orgIds),
                              ),
                          ]
                        : []),
                ),
            ),
    ]);

    const personById = new Map(people.map((p) => [p.id, p]));
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const profileByOwner = new Map(
        profiles.map((p) => [`${p.ownerType}:${p.ownerId}`, p.slug]),
    );

    return rows
        .map((row) => {
            const isTeam = !!row.authorOrganizationId;
            const ownerId = isTeam
                ? (row.authorOrganizationId as string)
                : (row.authorUserId as string);
            const person = row.authorUserId
                ? personById.get(row.authorUserId)
                : undefined;
            const team = row.authorOrganizationId
                ? teamById.get(row.authorOrganizationId)
                : undefined;
            const name = person?.name ?? team?.name ?? null;
            const slug = profileByOwner.get(
                `${isTeam ? "organization" : "user"}:${ownerId}`,
            );

            return {
                handle: slug ?? slugifyHandle(name) ?? "creator",
                name,
                image: person?.image ?? null,
                authorUserId: row.authorUserId,
                authorOrganizationId: row.authorOrganizationId,
                postCount: Number(row.count) || 0,
                hasProfile: !!slug,
            } satisfies AuthorRef;
        })
        .filter((author) => author.authorUserId || author.authorOrganizationId)
        .sort((a, b) => b.postCount - a.postCount || (a.name ?? "").localeCompare(b.name ?? ""));
}

/**
 * The author a handle refers to.
 *
 * A handle is a creator page's address when the author has one, and the
 * name they write under otherwise.
 */
export async function resolveAuthorByHandle(
    handle: string,
): Promise<{ authorUserId: string | null; authorOrganizationId: string | null } | null> {
    const wanted = (handle ?? "").trim().toLowerCase();
    if (!wanted) return null;

    const [profile] = await db
        .select({
            ownerId: creatorProfiles.ownerId,
            ownerType: creatorProfiles.ownerType,
        })
        .from(creatorProfiles)
        .where(eq(creatorProfiles.slug, wanted))
        .limit(1);

    if (profile) {
        return profile.ownerType === "organization"
            ? { authorUserId: null, authorOrganizationId: profile.ownerId }
            : { authorUserId: profile.ownerId, authorOrganizationId: null };
    }

    // No creator page: the handle is the name the author writes under.
    const people = await db
        .select({ id: user.id, name: user.name })
        .from(user);
    for (const person of people) {
        if (slugifyHandle(person.name) === wanted) {
            return { authorUserId: person.id, authorOrganizationId: null };
        }
    }

    const teams = await db
        .select({ id: organization.id, name: organization.name })
        .from(organization);
    for (const team of teams) {
        if (slugifyHandle(team.name) === wanted) {
            return {
                authorUserId: null,
                authorOrganizationId: team.id,
            };
        }
    }

    return null;
}
