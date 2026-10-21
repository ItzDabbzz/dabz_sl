import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { creatorProfiles, creatorSlAccounts } from "@/schemas/creator";
import { getOwnerName } from "./profile";

/**
 * The claims staff work through.
 *
 * A creator claims a Second Life account and the page carries a one-time
 * code. Someone has to look at the object in-world and decide whether the
 * code is really on it - that is staff work, and this is the list they
 * work from.
 *
 * A claim is in one of three states: waiting for a decision, approved, or
 * turned down. A refusal is kept rather than deleted, so the creator can
 * read why and the record of the decision stays.
 */

/** Where a claim stands. */
export type ClaimState = "pending" | "approved" | "turned-down";

/** A claim, as staff see it. */
export type ClaimRow = {
    /** The claim id. */
    id: string;
    /** The page the claim was made on. */
    profileId: string;
    /** The page's address, e.g. "dabz". */
    profileSlug: string;
    /** The page's name. */
    profileName: string;
    /** The person or team behind the page. */
    ownerName: string;
    /** The Second Life account being claimed. */
    slAccountName: string;
    /** The avatar UUID, when the creator supplied one. */
    slAccountUuid: string | null;
    /** The one-time code the creator put on an object. */
    verificationCode: string | null;
    /** Where the claim stands. */
    state: ClaimState;
    /** Why the claim was turned down, when it was. */
    rejectionReason: string | null;
    /** When the claim was turned down, when it was. */
    rejectedAt: Date | null;
    /** When the account was proved, when it was. */
    verifiedAt: Date | null;
    /** When the claim was made. */
    createdAt: Date;
};

/**
 * Every claim, with the waiting ones first.
 *
 * The waiting ones are what staff act on, so they come first; the
 * approved and refused ones follow as a record of what was decided.
 */
export async function listClaims(): Promise<ClaimRow[]> {
    const rows = await db
        .select({
            id: creatorSlAccounts.id,
            profileId: creatorSlAccounts.profileId,
            slAccountName: creatorSlAccounts.slAccountName,
            slAccountUuid: creatorSlAccounts.slAccountUuid,
            verificationCode: creatorSlAccounts.verificationCode,
            verified: creatorSlAccounts.verified,
            verifiedAt: creatorSlAccounts.verifiedAt,
            rejectedAt: creatorSlAccounts.rejectedAt,
            rejectionReason: creatorSlAccounts.rejectionReason,
            createdAt: creatorSlAccounts.createdAt,
            profileSlug: creatorProfiles.slug,
            profileName: creatorProfiles.displayName,
            ownerType: creatorProfiles.ownerType,
            ownerId: creatorProfiles.ownerId,
        })
        .from(creatorSlAccounts)
        .innerJoin(
            creatorProfiles,
            eq(creatorSlAccounts.profileId, creatorProfiles.id),
        )
        .orderBy(asc(creatorSlAccounts.createdAt));

    // The owner's name is one lookup per distinct owner, not per claim.
    const names = new Map<string, string>();
    for (const row of rows) {
        if (names.has(row.ownerId)) continue;
        const ownerType =
            row.ownerType === "organization" ? "organization" : "user";
        names.set(
            row.ownerId,
            (await getOwnerName(ownerType, row.ownerId)) ?? "Unknown",
        );
    }

    const claims: ClaimRow[] = rows.map((row) => ({
        id: row.id,
        profileId: row.profileId,
        profileSlug: row.profileSlug,
        profileName: row.profileName,
        ownerName: names.get(row.ownerId) ?? "Unknown",
        slAccountName: row.slAccountName,
        slAccountUuid: row.slAccountUuid,
        verificationCode: row.verificationCode,
        state: row.verified
            ? "approved"
            : row.rejectedAt
              ? "turned-down"
              : "pending",
        rejectionReason: row.rejectionReason,
        rejectedAt: row.rejectedAt,
        verifiedAt: row.verifiedAt,
        createdAt: row.createdAt,
    }));

    // Waiting first, then turned down, then approved - each group oldest
    // first, so the oldest claim is always the one to deal with next.
    const order: Record<ClaimState, number> = {
        pending: 0,
        "turned-down": 1,
        approved: 2,
    };
    return claims.sort(
        (a, b) =>
            order[a.state] - order[b.state] ||
            a.createdAt.getTime() - b.createdAt.getTime(),
    );
}
