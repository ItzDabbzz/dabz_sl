import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { member } from "@/schemas/auth-schema";
import { isStaffUser } from "@/features/auth/permissions/staff";

/**
 * Who may change a creator page.
 *
 * A page belongs either to a person or to a team, and the difference
 * matters: a person's page is theirs alone, while a team's page belongs to
 * the team and is changed by the people who run the team.
 *
 * The rule is deliberately narrow for teams. Any member of an organization
 * can see the page, but only the people who administer the organization
 * can change it - otherwise one ordinary member could repoint the team's
 * public address. Staff may change any page, because staff are the people
 * who resolve the cases nobody else can.
 */

/** The user a decision is made about. */
export type ProfileUser = {
    id: string;
    role?: string | null;
};

/** The owner of a page. */
export type ProfileOwner = {
    ownerType: "user" | "organization";
    ownerId: string;
};

/**
 * The organization roles that may change the organization's page.
 *
 * These are the better-auth organization roles: owner, admin, member.
 */
const ORG_EDIT_ROLES = new Set(["owner", "admin"]);

/** The role a user holds in an organization, if any. */
export async function getOrgRole(
    userId: string,
    organizationId: string,
): Promise<string | null> {
    const [row] = await db
        .select({ role: member.role })
        .from(member)
        .where(
            and(
                eq(member.userId, userId),
                eq(member.organizationId, organizationId),
            ),
        )
        .limit(1);
    return row?.role ?? null;
}

/**
 * Whether a user may change the page of an owner.
 *
 * This is the question asked before a page is created as well as before
 * it is changed: a page is created for somebody, and that somebody has to
 * be the one asking.
 */
export async function canManageOwner(
    user: ProfileUser | null | undefined,
    owner: ProfileOwner,
): Promise<boolean> {
    if (!user) return false;
    if (isStaffUser(user)) return true;

    if (owner.ownerType === "user") {
        return owner.ownerId === user.id;
    }

    if (owner.ownerType === "organization") {
        const role = await getOrgRole(user.id, owner.ownerId);
        return !!role && ORG_EDIT_ROLES.has(role);
    }

    return false;
}

/** The parts of a profile that say who owns it. */
export type ProfileOwnership = {
    ownerType: string;
    ownerId: string;
};

/** Whether a user may change a page. */
export async function canManageProfile(
    user: ProfileUser | null | undefined,
    profile: ProfileOwnership | null | undefined,
): Promise<boolean> {
    if (!user || !profile) return false;
    if (profile.ownerType !== "user" && profile.ownerType !== "organization") {
        return false;
    }
    return canManageOwner(user, {
        ownerType: profile.ownerType,
        ownerId: profile.ownerId,
    });
}

/**
 * The organizations whose page a user may change.
 *
 * A user can have several organizations, and the console shows the page
 * of each one they administer.
 */
export async function getManagedOrgIds(
    userId: string,
): Promise<string[]> {
    const rows = await db
        .select({ organizationId: member.organizationId, role: member.role })
        .from(member)
        .where(eq(member.userId, userId));
    return rows
        .filter((row) => ORG_EDIT_ROLES.has(row.role))
        .map((row) => row.organizationId);
}
