import { db } from "@/server/db/client";
import { and, asc, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { blogPosts } from "@/schemas/blog";
import {
    creatorProfileItems,
    creatorProfiles,
    creatorSlAccounts,
} from "@/schemas/creator";
import { mpItems } from "@/schemas/sl-schema";
import { organization, user } from "@/schemas/auth-schema";

/** How many creators one page of the directory shows. */
export const DIRECTORY_PAGE_SIZE = 24;

/** The ways a visitor can order the directory. */
export type DirectorySort = "name" | "newest" | "products";

/**
 * One creator, as the directory shows them.
 *
 * A creator is a person or a team of creators selling in Second Life.
 * Everything here is theirs: the name they publish under, the products
 * of the Second Life accounts they have proven they own, and the posts
 * they have written.
 */
export type DirectoryCreator = {
    id: string;
    slug: string;
    displayName: string;
    tagline: string | null;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    locations: string | null;
    ownerType: "user" | "organization";
    /** The name of the person or team behind the page. */
    ownerName: string | null;
    /** The owner's picture, used when the creator has no avatar of their own. */
    ownerImage: string | null;
    /** The Second Life accounts the creator has proven they own. */
    accountNames: string[];
    /** How many products are on the creator's page. */
    productCount: number;
    /** How many posts the creator has published. */
    postCount: number;
};

/** The directory, ready to render. */
export type CreatorDirectory = {
    creators: DirectoryCreator[];
    /** How many published creators match the search. */
    total: number;
    page: number;
    totalPages: number;
    perPage: number;
    q: string;
    sort: DirectorySort;
};

/**
 * The products of a creator.
 *
 * A product belongs to the creator when it was sold by a Second Life
 * account they have proven they own, or when they put it on their page
 * themselves - the same rule the creator's own page uses.
 */
function productCounts() {
    const byAccount = db
        .select({
            profileId: sql`${creatorSlAccounts.profileId}`.as("profile_id"),
            itemId: sql`${mpItems.id}`.as("item_id"),
        })
        .from(creatorSlAccounts)
        .innerJoin(
            mpItems,
            eq(mpItems.soldBy, creatorSlAccounts.slAccountName),
        )
        .where(eq(creatorSlAccounts.verified, true));

    const byChoice = db
        .select({
            profileId: sql`${creatorProfileItems.profileId}`.as("profile_id"),
            itemId: sql`${mpItems.id}`.as("item_id"),
        })
        .from(creatorProfileItems)
        .innerJoin(mpItems, eq(mpItems.id, creatorProfileItems.itemId));

    return db
        .select({
            profileId: sql`profile_id`.as("profile_id"),
            productCount: sql<number>`count(distinct item_id)::int`.as(
                "product_count",
            ),
        })
        .from(byAccount.union(byChoice).as("item_rows"))
        .groupBy(sql`profile_id`)
        .as("product_counts");
}

/**
 * The posts of a creator.
 *
 * A post belongs to a person or to a team, so the count is kept under
 * both the person and the team that wrote it.
 */
function postCounts() {
    const byUser = db
        .select({
            ownerType: sql`'user'`.as("owner_type"),
            ownerId: sql`${blogPosts.authorUserId}`.as("owner_id"),
            postCount: sql<number>`count(*)::int`.as("post_count"),
        })
        .from(blogPosts)
        .where(
            and(
                eq(blogPosts.published, true),
                sql`${blogPosts.authorUserId} is not null`,
            ),
        )
        .groupBy(blogPosts.authorUserId);

    const byOrganization = db
        .select({
            ownerType: sql`'organization'`.as("owner_type"),
            ownerId: sql`${blogPosts.authorOrganizationId}`.as("owner_id"),
            postCount: sql<number>`count(*)::int`.as("post_count"),
        })
        .from(blogPosts)
        .where(
            and(
                eq(blogPosts.published, true),
                sql`${blogPosts.authorOrganizationId} is not null`,
            ),
        )
        .groupBy(blogPosts.authorOrganizationId);

    return byUser.union(byOrganization).as("post_counts");
}

/**
 * What a search on the directory matches.
 *
 * A visitor knows a creator by the name they publish under, by what
 * they say about themselves, or by the Second Life account they sell
 * under - so all of those are searched.
 */
function searchFilter(q: string) {
    if (!q) return undefined;

    const pattern = `%${q}%`;
    const accountMatch = exists(
        db
            .select({ id: creatorSlAccounts.id })
            .from(creatorSlAccounts)
            .where(
                and(
                    eq(creatorSlAccounts.profileId, creatorProfiles.id),
                    eq(creatorSlAccounts.verified, true),
                    ilike(creatorSlAccounts.slAccountName, pattern),
                ),
            ),
    );

    return or(
        ilike(creatorProfiles.displayName, pattern),
        ilike(creatorProfiles.tagline, pattern),
        ilike(creatorProfiles.bio, pattern),
        ilike(creatorProfiles.slug, pattern),
        accountMatch,
    );
}

/**
 * The published creators, for the public directory.
 *
 * Only a published page is listed. A draft belongs to its owner alone,
 * so it stays out of the way until they choose to show it.
 */
export async function listPublishedCreators(options: {
    q?: string;
    sort?: DirectorySort;
    page?: number;
    perPage?: number;
} = {}): Promise<CreatorDirectory> {
    const q = (options.q ?? "").trim();
    const sort: DirectorySort = options.sort ?? "name";
    const perPage = Math.min(
        Math.max(options.perPage ?? DIRECTORY_PAGE_SIZE, 1),
        100,
    );

    const filter = and(eq(creatorProfiles.published, true), searchFilter(q));

    const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(creatorProfiles)
        .where(filter);

    const totalCount = Number(total) || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
    const page = Math.min(Math.max(options.page ?? 1, 1), totalPages);

    const products = productCounts();
    const posts = postCounts();

    const rows = await db
        .select({
            id: creatorProfiles.id,
            slug: creatorProfiles.slug,
            displayName: creatorProfiles.displayName,
            tagline: creatorProfiles.tagline,
            bio: creatorProfiles.bio,
            avatarUrl: creatorProfiles.avatarUrl,
            bannerUrl: creatorProfiles.bannerUrl,
            locations: creatorProfiles.locations,
            ownerType: creatorProfiles.ownerType,
            ownerName: sql<string | null>`coalesce(${user.name}, ${organization.name})`,
            ownerImage: sql<string | null>`coalesce(${user.image}, ${organization.logo})`,
            productCount: sql<number>`coalesce("product_counts"."product_count", 0)::int`,
            postCount: sql<number>`coalesce("post_counts"."post_count", 0)::int`,
        })
        .from(creatorProfiles)
        .leftJoin(
            user,
            and(
                eq(user.id, creatorProfiles.ownerId),
                eq(creatorProfiles.ownerType, "user"),
            ),
        )
        .leftJoin(
            organization,
            and(
                eq(organization.id, creatorProfiles.ownerId),
                eq(creatorProfiles.ownerType, "organization"),
            ),
        )
        .leftJoin(
            products,
            sql`"product_counts"."profile_id" = ${creatorProfiles.id}`,
        )
        .leftJoin(
            posts,
            sql`"post_counts"."owner_type" = ${creatorProfiles.ownerType}
                 and "post_counts"."owner_id" = ${creatorProfiles.ownerId}`,
        )
        .where(filter)
        .orderBy(
            ...(sort === "products"
                ? [
                      desc(
                          sql`coalesce("product_counts"."product_count", 0)`,
                      ),
                  ]
                : sort === "newest"
                  ? [desc(creatorProfiles.createdAt)]
                  : []),
            asc(creatorProfiles.displayName),
        )
        .limit(perPage)
        .offset((page - 1) * perPage);

    const ids = rows.map((row) => row.id);
    const accounts = ids.length
        ? await db
              .select({
                  profileId: creatorSlAccounts.profileId,
                  name: creatorSlAccounts.slAccountName,
              })
              .from(creatorSlAccounts)
              .where(
                  and(
                      inArray(creatorSlAccounts.profileId, ids),
                      eq(creatorSlAccounts.verified, true),
                  ),
              )
              .orderBy(asc(creatorSlAccounts.slAccountName))
        : [];

    const namesByProfile = new Map<string, string[]>();
    for (const account of accounts) {
        const list = namesByProfile.get(account.profileId) ?? [];
        list.push(account.name);
        namesByProfile.set(account.profileId, list);
    }

    const creators: DirectoryCreator[] = rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        displayName: row.displayName,
        tagline: row.tagline,
        bio: row.bio,
        avatarUrl: row.avatarUrl,
        bannerUrl: row.bannerUrl,
        locations: row.locations,
        ownerType: row.ownerType as "user" | "organization",
        ownerName: row.ownerName,
        ownerImage: row.ownerImage,
        accountNames: namesByProfile.get(row.id) ?? [],
        productCount: Number(row.productCount) || 0,
        postCount: Number(row.postCount) || 0,
    }));

    return { creators, total: totalCount, page, totalPages, perPage, q, sort };
}
