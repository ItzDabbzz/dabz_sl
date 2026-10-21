import { db } from "@/server/db/client";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
    creatorProfileItems,
    creatorProfiles,
    creatorSlAccounts,
} from "@/schemas/creator";
import { blogPosts } from "@/schemas/blog";
import { mpItems } from "@/schemas/sl-schema";
import { user } from "@/schemas/auth-schema";

/** A creator page, as the public side sees it. */
export type PublicProfile = {
    id: string;
    slug: string;
    displayName: string;
    tagline: string | null;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    websiteUrl: string | null;
    locations: string | null;
    ownerType: "user" | "organization";
    ownerId: string;
    /** Whether the page is public yet. */
    published: boolean;
    /** The accounts the creator has proven they own. */
    verifiedAccounts: { name: string; uuid: string | null }[];
};

/**
 * The creator page at a slug.
 *
 * A page is only public once its owner publishes it, but the draft is
 * still found so the owner can preview their own page.
 */
export async function getProfileBySlug(
    slug: string,
): Promise<PublicProfile | null> {
    const [profile] = await db
        .select()
        .from(creatorProfiles)
        .where(eq(creatorProfiles.slug, slug))
        .limit(1);
    if (!profile) return null;

    const accounts = await db
        .select({
            name: creatorSlAccounts.slAccountName,
            uuid: creatorSlAccounts.slAccountUuid,
        })
        .from(creatorSlAccounts)
        .where(
            and(
                eq(creatorSlAccounts.profileId, profile.id),
                eq(creatorSlAccounts.verified, true),
            ),
        );

    return {
        id: profile.id,
        slug: profile.slug,
        displayName: profile.displayName,
        tagline: profile.tagline,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        bannerUrl: profile.bannerUrl,
        websiteUrl: profile.websiteUrl,
        locations: profile.locations,
        ownerType: profile.ownerType as "user" | "organization",
        ownerId: profile.ownerId,
        published: profile.published,
        verifiedAccounts: accounts,
    };
}

/** The profile of a given owner, if they have one. */
export async function getProfileForOwner(
    ownerType: "user" | "organization",
    ownerId: string,
) {
    const [profile] = await db
        .select()
        .from(creatorProfiles)
        .where(
            and(
                eq(creatorProfiles.ownerType, ownerType),
                eq(creatorProfiles.ownerId, ownerId),
            ),
        )
        .limit(1);
    return profile ?? null;
}

/**
 * The products a creator lists.
 *
 * A product appears when the creator chose it, or when it was sold by a
 * Second Life account the creator has proven they own - that is what
 * makes the page a shop rather than a list of favourites.
 */
export async function getProfileItems(profileId: string, limit = 24) {
    const chosen = await db
        .select({ itemId: creatorProfileItems.itemId })
        .from(creatorProfileItems)
        .where(eq(creatorProfileItems.profileId, profileId));

    const accounts = await db
        .select({ name: creatorSlAccounts.slAccountName })
        .from(creatorSlAccounts)
        .where(
            and(
                eq(creatorSlAccounts.profileId, profileId),
                eq(creatorSlAccounts.verified, true),
            ),
        );

    const itemIds = chosen.map((row) => row.itemId);
    const names = accounts.map((row) => row.name);

    const byChoice = itemIds.length
        ? await db
              .select()
              .from(mpItems)
              .where(inArray(mpItems.id, itemIds))
        : [];

    const byAccount = names.length
        ? await db
              .select()
              .from(mpItems)
              .where(inArray(mpItems.soldBy, names))
        : [];

    const seen = new Set<string>();
    const merged: (typeof byChoice)[number][] = [];
    for (const row of [...byChoice, ...byAccount]) {
        const key = String(row.id);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
    }
    return merged.slice(0, limit);
}

/** The posts a creator has written. */
export async function getProfilePosts(
    ownerType: "user" | "organization",
    ownerId: string,
    limit = 12,
) {
    return await db
        .select({
            id: blogPosts.id,
            slug: blogPosts.slug,
            title: blogPosts.title,
            excerpt: blogPosts.excerpt,
            publishedAt: blogPosts.publishedAt,
            createdAt: blogPosts.createdAt,
        })
        .from(blogPosts)
        .where(
            and(
                eq(blogPosts.published, true),
                ownerType === "organization"
                    ? eq(blogPosts.authorOrganizationId, ownerId)
                    : eq(blogPosts.authorUserId, ownerId),
            ),
        )
        .orderBy(desc(blogPosts.publishedAt))
        .limit(limit);
}

/** The name a creator's page shows when it belongs to a person. */
export async function getOwnerName(
    ownerType: "user" | "organization",
    ownerId: string,
): Promise<string | null> {
    if (ownerType === "organization") {
        const { organization } = await import("@/schemas/auth-schema");
        const [org] = await db
            .select({ name: organization.name })
            .from(organization)
            .where(eq(organization.id, ownerId))
            .limit(1);
        return org?.name ?? null;
    }
    const [person] = await db
        .select({ name: user.name, image: user.image })
        .from(user)
        .where(eq(user.id, ownerId))
        .limit(1);
    return person?.name ?? null;
}
