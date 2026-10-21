import { randomUUID } from "crypto";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
    creatorProfileItems,
    creatorProfiles,
    creatorSlAccounts,
} from "@/schemas/creator";
import { mpItems } from "@/schemas/sl-schema";
import { getOwnerName } from "./profile";
import {
    ProfilePatch,
    isValidProfileSlug,
    slugifyProfileSlug,
    validateProfilePatch,
    validateSlAccountName,
} from "./validation";

/**
 * The write side of a creator page.
 *
 * Everything that changes a page goes through here, so the rules are in
 * one place: a slug is free, an account claim starts unproven, and a
 * product may only be listed by somebody who can account for it.
 *
 * The errors carry a code and a status, because the API and the dashboard
 * both need to say what went wrong in a way the caller can act on.
 */

export class ProfileError extends Error {
    readonly code: string;
    readonly status: number;

    constructor(code: string, status: number, message: string) {
        super(message);
        this.name = "ProfileError";
        this.code = code;
        this.status = status;
    }
}

/** A profile as the console sees it. */
export type ManagedProfile = {
    id: string;
    ownerType: string;
    ownerId: string;
    ownerName: string | null;
    slug: string;
    displayName: string;
    tagline: string | null;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    websiteUrl: string | null;
    locations: string | null;
    published: boolean;
    createdAt: Date | null;
    updatedAt: Date | null;
};

/** A claimed Second Life account. */
export type ManagedAccount = {
    id: string;
    profileId: string;
    slAccountName: string;
    slAccountUuid: string | null;
    verified: boolean;
    verifiedAt: Date | null;
    verificationMethod: string | null;
    verificationCode: string | null;
    /** When staff turned the claim down. */
    rejectedAt: Date | null;
    /** Why staff turned the claim down. */
    rejectionReason: string | null;
    createdAt: Date | null;
};

/** A product on a creator's page. */
export type ManagedItem = {
    id: string;
    title: string;
    price: string | null;
    image: string | null;
    soldBy: string | null;
    store: string | null;
    featured: boolean;
};

function toManagedProfile(row: typeof creatorProfiles.$inferSelect): ManagedProfile {
    return {
        id: row.id,
        ownerType: row.ownerType,
        ownerId: row.ownerId,
        ownerName: null,
        slug: row.slug,
        displayName: row.displayName,
        tagline: row.tagline,
        bio: row.bio,
        avatarUrl: row.avatarUrl,
        bannerUrl: row.bannerUrl,
        websiteUrl: row.websiteUrl,
        locations: row.locations,
        published: row.published,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function toManagedAccount(
    row: typeof creatorSlAccounts.$inferSelect,
): ManagedAccount {
    return {
        id: row.id,
        profileId: row.profileId,
        slAccountName: row.slAccountName,
        slAccountUuid: row.slAccountUuid,
        verified: row.verified,
        verifiedAt: row.verifiedAt,
        verificationMethod: row.verificationMethod,
        verificationCode: row.verificationCode,
        rejectedAt: row.rejectedAt,
        rejectionReason: row.rejectionReason,
        createdAt: row.createdAt,
    };
}

/** The code a creator puts on an object in-world to prove an account. */
function makeVerificationCode(): string {
    return randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
}

/**
 * Whether a slug is free.
 *
 * The check is a query rather than a guess, because the address of a page
 * is unique across the whole site - two creators cannot both be
 * /c/moonlight-atelier.
 */
async function slugIsTaken(
    slug: string,
    exceptProfileId?: string,
): Promise<boolean> {
    const rows = await db
        .select({ id: creatorProfiles.id })
        .from(creatorProfiles)
        .where(eq(creatorProfiles.slug, slug))
        .limit(2);
    return rows.some((row) => row.id !== exceptProfileId);
}

/** How much of a derived slug is left for a number. */
const SLUG_ROOM = 40;

/** A slug that is free, derived from a name. */
async function deriveFreeSlug(base: string): Promise<string> {
    const root = slugifyProfileSlug(base) || "creator";
    if (!(await slugIsTaken(root))) return root;
    for (let n = 2; n < 100; n += 1) {
        const candidate = `${root.slice(0, SLUG_ROOM)}-${n}`;
        if (!(await slugIsTaken(candidate))) return candidate;
    }
    // A hundred names is enough; past that the name is unusual enough
    // that the number can keep going.
    return `${root.slice(0, SLUG_ROOM)}-${Date.now()}`;
}

/**
 * Create a page for an owner.
 *
 * A new page starts as a draft: it is not public until its owner says
 * so, and the owner can see it while it is a draft.
 */
export async function createProfile(input: {
    ownerType: "user" | "organization";
    ownerId: string;
    displayName: string;
    slug?: string;
}): Promise<ManagedProfile> {
    const displayName = String(input.displayName ?? "").trim();
    if (!displayName) {
        throw new ProfileError(
            "invalid_display_name",
            400,
            "A name is required.",
        );
    }

    const existing = await db
        .select({ id: creatorProfiles.id })
        .from(creatorProfiles)
        .where(
            and(
                eq(creatorProfiles.ownerType, input.ownerType),
                eq(creatorProfiles.ownerId, input.ownerId),
            ),
        )
        .limit(1);
    if (existing.length) {
        throw new ProfileError(
            "profile_exists",
            409,
            "This owner already has a page.",
        );
    }

    let slug: string;
    if (input.slug !== undefined && String(input.slug).trim()) {
        slug = String(input.slug).trim().toLowerCase();
        if (!isValidProfileSlug(slug)) {
            throw new ProfileError(
                "invalid_slug",
                400,
                "An address may only use a-z, 0-9 and single dashes.",
            );
        }
        if (await slugIsTaken(slug)) {
            throw new ProfileError(
                "slug_taken",
                409,
                "That address is already in use.",
            );
        }
    } else {
        slug = await deriveFreeSlug(displayName);
    }

    try {
        const [row] = await db
            .insert(creatorProfiles)
            .values({
                ownerType: input.ownerType,
                ownerId: input.ownerId,
                slug,
                displayName,
                published: false,
            })
            .returning();
        return toManagedProfile(row);
    } catch (error) {
        if (isUniqueViolation(error)) {
            throw new ProfileError(
                "slug_taken",
                409,
                "That address is already in use.",
            );
        }
        throw error;
    }
}

/** Whether a failure was a unique index firing. */
function isUniqueViolation(error: unknown): boolean {
    const candidate = error as {
        code?: string;
        cause?: { code?: string };
        message?: string;
    };
    if (candidate?.code === "23505") return true;
    if (candidate?.cause?.code === "23505") return true;
    return typeof candidate?.message === "string"
        ? candidate.message.includes("creator_profiles_slug_uniq")
        : false;
}

/**
 * Change the fields of a page.
 *
 * Only the fields that were sent are changed, so a caller that sends one
 * field does not blank the others.
 */
export async function updateProfile(
    profileId: string,
    patch: ProfilePatch,
): Promise<ManagedProfile> {
    const changes: Record<string, unknown> = {};

    if (patch.displayName !== undefined) {
        changes.displayName = patch.displayName;
    }

    if (patch.slug !== undefined) {
        if (await slugIsTaken(patch.slug, profileId)) {
            throw new ProfileError(
                "slug_taken",
                409,
                "That address is already in use.",
            );
        }
        changes.slug = patch.slug;
    }

    for (const field of [
        "tagline",
        "bio",
        "avatarUrl",
        "bannerUrl",
        "websiteUrl",
        "locations",
    ] as const) {
        const value = patch[field];
        if (value !== undefined) changes[field] = value;
    }

    if (patch.published !== undefined) {
        changes.published = patch.published;
    }

    changes.updatedAt = new Date();

    try {
        const [row] = await db
            .update(creatorProfiles)
            .set(changes as never)
            .where(eq(creatorProfiles.id, profileId))
            .returning();
        if (!row) {
            throw new ProfileError("not_found", 404, "No such page.");
        }
        return toManagedProfile(row);
    } catch (error) {
        if (isUniqueViolation(error)) {
            throw new ProfileError(
                "slug_taken",
                409,
                "That address is already in use.",
            );
        }
        throw error;
    }
}

/** Delete a page. The accounts and products on it go with it. */
export async function deleteProfile(profileId: string): Promise<void> {
    const rows = await db
        .delete(creatorProfiles)
        .where(eq(creatorProfiles.id, profileId))
        .returning({ id: creatorProfiles.id });
    if (!rows.length) {
        throw new ProfileError("not_found", 404, "No such page.");
    }
}

/** The page with its id. */
export async function getManagedProfile(
    profileId: string,
): Promise<ManagedProfile | null> {
    const [row] = await db
        .select()
        .from(creatorProfiles)
        .where(eq(creatorProfiles.id, profileId))
        .limit(1);
    if (!row) return null;
    const profile = toManagedProfile(row);
    profile.ownerName = await getOwnerName(
        row.ownerType as "user" | "organization",
        row.ownerId,
    );
    return profile;
}

/** The pages of a given owner. */
export async function getProfilesForOwner(
    ownerType: "user" | "organization",
    ownerId: string,
): Promise<ManagedProfile[]> {
    const rows = await db
        .select()
        .from(creatorProfiles)
        .where(
            and(
                eq(creatorProfiles.ownerType, ownerType),
                eq(creatorProfiles.ownerId, ownerId),
            ),
        );
    return Promise.all(rows.map(async (row) => {
        const profile = toManagedProfile(row);
        profile.ownerName = await getOwnerName(ownerType, ownerId);
        return profile;
    }));
}

/**
 * Every page a caller may change.
 *
 * A person has at most one page of their own, and one page for each team
 * they run. The console shows them all together, because a creator who
 * runs a team thinks of their page and their team's page as the same
 * thing they look after.
 */
export async function listManageableProfiles(input: {
    userId: string;
    orgIds: string[];
}): Promise<ManagedProfile[]> {
    const profiles = await getProfilesForOwner("user", input.userId);

    for (const orgId of input.orgIds) {
        const orgProfiles = await getProfilesForOwner("organization", orgId);
        profiles.push(...orgProfiles);
    }

    return profiles;
}

/** The accounts claimed on a page. */
export async function listAccountClaims(
    profileId: string,
): Promise<ManagedAccount[]> {
    const rows = await db
        .select()
        .from(creatorSlAccounts)
        .where(eq(creatorSlAccounts.profileId, profileId))
        .orderBy(desc(creatorSlAccounts.createdAt));
    return rows.map(toManagedAccount);
}

/**
 * Claim a Second Life account.
 *
 * The claim starts unproven. The creator is given a code to put on an
 * object in-world, and the account becomes verified once the platform has
 * seen that code. A creator cannot mark their own claim as verified -
 * that is the whole point of the claim.
 */
export async function addAccountClaim(
    profileId: string,
    input: { slAccountName: string; slAccountUuid?: string | null },
): Promise<ManagedAccount> {
    const parsed = validateSlAccountName(input.slAccountName);
    if (!parsed.ok) {
        throw new ProfileError(
            "invalid_account_name",
            400,
            parsed.error.message,
        );
    }
    const name = parsed.value;

    const existing = await db
        .select({ id: creatorSlAccounts.id })
        .from(creatorSlAccounts)
        .where(
            and(
                eq(creatorSlAccounts.profileId, profileId),
                eq(creatorSlAccounts.slAccountName, name),
            ),
        )
        .limit(1);
    if (existing.length) {
        throw new ProfileError(
            "account_exists",
            409,
            "That account is already claimed on this page.",
        );
    }

    const [row] = await db
        .insert(creatorSlAccounts)
        .values({
            profileId,
            slAccountName: name,
            slAccountUuid: input.slAccountUuid?.trim() || null,
            verified: false,
            verificationMethod: "code",
            verificationCode: makeVerificationCode(),
        })
        .returning();
    return toManagedAccount(row);
}

/** Remove a claimed account. */
export async function removeAccountClaim(
    profileId: string,
    accountId: string,
): Promise<void> {
    const rows = await db
        .delete(creatorSlAccounts)
        .where(
            and(
                eq(creatorSlAccounts.id, accountId),
                eq(creatorSlAccounts.profileId, profileId),
            ),
        )
        .returning({ id: creatorSlAccounts.id });
    if (!rows.length) {
        throw new ProfileError("not_found", 404, "No such account claim.");
    }
}

/**
 * Settle whether an account claim was proven.
 *
 * Only the platform does this: a creator who could mark their own claim
 * as proven could claim any Second Life account and list its products as
 * their own.
 */
export async function setAccountVerified(
    profileId: string,
    accountId: string,
    verified: boolean,
    method?: string | null,
    reason?: string | null,
): Promise<ManagedAccount> {
    /**
     * The code is one-time: once an account is proved, the code is spent
     * and never shown again. If a claim is turned back down, a fresh code
     * is issued, so a spent code cannot be replayed to prove the same
     * account a second time.
     *
     * A refusal is kept rather than deleted, so the creator can read why
     * and the record of the decision stays.
     */
    const [row] = await db
        .update(creatorSlAccounts)
        .set({
            verified,
            verifiedAt: verified ? new Date() : null,
            verificationMethod: verified ? (method ?? "object") : null,
            verificationCode: verified ? null : makeVerificationCode(),
            rejectedAt: verified ? null : new Date(),
            rejectionReason: verified ? null : (reason?.trim() || null),
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(creatorSlAccounts.id, accountId),
                eq(creatorSlAccounts.profileId, profileId),
            ),
        )
        .returning();
    if (!row) {
        throw new ProfileError("not_found", 404, "No such account claim.");
    }
    return toManagedAccount(row);
}

/**
 * The conditions that decide whether a product may be listed.
 *
 * A product belongs to the store that sells it. A creator may list the
 * products of an account the platform has proven is theirs, or a product
 * that is already theirs in the catalogue. Nothing else - otherwise a
 * page could pass somebody else's product off as its own.
 */
async function featureableConditions(
    profile: ManagedProfile,
): Promise<ReturnType<typeof or>[] | null> {
    const accounts = await listAccountClaims(profile.id);
    const verifiedNames = accounts
        .filter((account) => account.verified)
        .map((account) => account.slAccountName);

    const conditions = [];
    if (verifiedNames.length) {
        conditions.push(inArray(mpItems.soldBy, verifiedNames));
    }
    if (profile.ownerType === "user") {
        conditions.push(eq(mpItems.ownerUserId, profile.ownerId));
    } else {
        conditions.push(eq(mpItems.orgId, profile.ownerId));
    }

    return conditions.length ? conditions : null;
}

/**
 * The products a creator may list.
 *
 * Adult products are left out: the public page has no filter of its own,
 * so a page that lists them shows them to everybody.
 */
async function listFeatureableItems(
    profile: ManagedProfile,
    query: string,
    limit: number,
): Promise<ManagedItem[]> {
    const conditions = await featureableConditions(profile);
    if (!conditions) return [];

    const filters = [sql`coalesce(${mpItems.isNsfw}, false) = false`];
    if (query) {
        const pattern = `%${query.toLowerCase()}%`;
        filters.push(
            sql`lower(${mpItems.title}) like ${pattern} or lower(coalesce(${mpItems.store}, '')) like ${pattern}`,
        );
    }

    const rows = await db
        .select({
            id: mpItems.id,
            title: mpItems.title,
            price: mpItems.price,
            images: mpItems.images,
            soldBy: mpItems.soldBy,
            store: mpItems.store,
        })
        .from(mpItems)
        .where(
            and(
                or(...conditions) as never,
                ...filters,
            ) as never,
        )
        .limit(limit);

    const chosen = await db
        .select({ itemId: creatorProfileItems.itemId })
        .from(creatorProfileItems)
        .where(eq(creatorProfileItems.profileId, profile.id));
    const chosenIds = new Set(chosen.map((row) => row.itemId));

    return rows.map((row) => ({
        id: String(row.id),
        title: row.title,
        price: row.price,
        image: (row.images as string[] | null)?.[0] ?? null,
        soldBy: row.soldBy,
        store: row.store,
        featured: chosenIds.has(String(row.id)),
    }));
}

/** The products a creator may list, with the ones already listed marked. */
export async function listFeatureableProducts(
    profile: ManagedProfile,
    query = "",
    limit = 40,
): Promise<ManagedItem[]> {
    return listFeatureableItems(profile, query, limit);
}

/**
 * Put a product on a page.
 *
 * The product has to be one the creator can account for - the same rule
 * the list is built from, so the two cannot drift apart.
 */
export async function featureItem(
    profile: ManagedProfile,
    itemId: string,
): Promise<ManagedItem> {
    const id = String(itemId ?? "").trim();
    if (!id) {
        throw new ProfileError("invalid_item", 400, "A product is required.");
    }

    const conditions = await featureableConditions(profile);
    if (!conditions) {
        throw new ProfileError(
            "item_not_allowed",
            403,
            "That product cannot be listed on this page.",
        );
    }

    // The one product, checked against the same rules the list uses.
    const rows = await db
        .select({
            id: mpItems.id,
            title: mpItems.title,
            price: mpItems.price,
            images: mpItems.images,
            soldBy: mpItems.soldBy,
            store: mpItems.store,
        })
        .from(mpItems)
        .where(
            and(
                or(...conditions) as never,
                eq(mpItems.id, id as never),
                sql`coalesce(${mpItems.isNsfw}, false) = false`,
            ) as never,
        )
        .limit(1);

    const row = rows[0];
    if (!row) {
        throw new ProfileError(
            "item_not_allowed",
            403,
            "That product cannot be listed on this page.",
        );
    }

    await db
        .insert(creatorProfileItems)
        .values({ profileId: profile.id, itemId: id, featured: true })
        .onConflictDoNothing();

    return {
        id: String(row.id),
        title: row.title,
        price: row.price,
        image: (row.images as string[] | null)?.[0] ?? null,
        soldBy: row.soldBy,
        store: row.store,
        featured: true,
    };
}

/** Take a product off a page. */
export async function unfeatureItem(
    profileId: string,
    itemId: string,
): Promise<void> {
    const rows = await db
        .delete(creatorProfileItems)
        .where(
            and(
                eq(creatorProfileItems.profileId, profileId),
                eq(creatorProfileItems.itemId, itemId),
            ),
        )
        .returning({ id: creatorProfileItems.id });
    if (!rows.length) {
        throw new ProfileError("not_found", 404, "That product is not listed.");
    }
}

/** The products currently on a page. */
export async function listFeaturedItems(
    profileId: string,
): Promise<ManagedItem[]> {
    const chosen = await db
        .select({ itemId: creatorProfileItems.itemId })
        .from(creatorProfileItems)
        .where(eq(creatorProfileItems.profileId, profileId));
    if (!chosen.length) return [];

    const itemIds = chosen.map((row) => row.itemId);
    const rows = await db
        .select({
            id: mpItems.id,
            title: mpItems.title,
            price: mpItems.price,
            images: mpItems.images,
            soldBy: mpItems.soldBy,
            store: mpItems.store,
        })
        .from(mpItems)
        .where(inArray(mpItems.id, itemIds as never));

    const order = new Map(itemIds.map((value, index) => [String(value), index]));
    return rows
        .map((row) => ({
            id: String(row.id),
            title: row.title,
            price: row.price,
            image: (row.images as string[] | null)?.[0] ?? null,
            soldBy: row.soldBy,
            store: row.store,
            featured: true,
        }))
        .sort(
            (a, b) =>
                (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
        );
}
