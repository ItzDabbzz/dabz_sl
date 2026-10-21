import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/server/auth/session";
import { getActiveOrgId } from "@/server/auth/guards";
import { isStaffUser } from "@/features/auth/permissions/staff";
import { canManageOwner, canManageProfile } from "./ownership";
import { getManagedProfile, ManagedProfile, ProfileError } from "./manage";
import { isUuid } from "./validation";

/**
 * The door into the creator profile API.
 *
 * A page is the creator's own, so the API is about ownership rather than
 * about permissions: a person may change their page, and the people who
 * run a team may change the team's page. Staff may change any page.
 *
 * The checks live here so that every route answers the same way: the same
 * session, the same ownership rule, the same wording for what is
 * refused.
 */

/** A caller, as the API sees them. */
export type ProfileCaller = {
    id: string;
    name?: string | null;
    role?: string | null;
    email?: string | null;
    isStaff: boolean;
    /** The organization the caller is acting as, if any. */
    activeOrgId: string | null;
};

/** The user behind a request, or null when nobody is signed in. */
export async function getProfileCaller(
    req: NextRequest | Request,
): Promise<ProfileCaller | null> {
    const session = await getSessionFromRequest({
        headers: req.headers as Headers,
    }).catch(() => null);
    const user = (session as any)?.user;
    if (!user?.id) return null;

    const activeOrgId = await getActiveOrgId(req.headers as Headers).catch(
        () => null,
    );

    return {
        id: user.id,
        name: user.name ?? null,
        role: user.role ?? null,
        email: user.email ?? null,
        isStaff: isStaffUser(user),
        activeOrgId,
    };
}

/** The failure a route answers with. */
export function profileErrorResponse(error: unknown): Response {
    if (error instanceof ProfileError) {
        return Response.json(
            { error: error.code, message: error.message },
            { status: error.status },
        );
    }
    console.error("creator-profile-api", error);
    return Response.json(
        { error: "server_error", message: "Something went wrong." },
        { status: 500 },
    );
}

/**
 * The page a caller asked for, if they may change it.
 *
 * The page is loaded and checked together, so no route can forget the
 * check: a route that wants a page calls this and gets either the page
 * or a refusal.
 */
export async function requireManagedProfile(
    req: NextRequest | Request,
    profileId: string,
): Promise<{ caller: ProfileCaller; profile: ManagedProfile }> {
    const caller = await getProfileCaller(req);
    if (!caller) {
        throw new ProfileError("unauthorized", 401, "Sign in to continue.");
    }

    // An address that is not a uuid is not a page. It has to be answered
    // as a page that is not there, rather than handed to the database -
    // which would refuse it in a way that looks like the server is broken.
    if (!isUuid(profileId)) {
        throw new ProfileError("not_found", 404, "No such page.");
    }

    const profile = await getManagedProfile(profileId);
    if (!profile) {
        throw new ProfileError("not_found", 404, "No such page.");
    }

    const allowed = await canManageProfile(caller, profile);
    if (!allowed) {
        throw new ProfileError(
            "forbidden",
            403,
            "That page belongs to somebody else.",
        );
    }

    return { caller, profile };
}

/**
 * The owner a caller asked to make a page for, if they may.
 *
 * A person may only make a page for themselves. A team page may only be
 * made by somebody who runs the team.
 */
export async function requireManageableOwner(
    caller: ProfileCaller,
    ownerType: string,
    ownerId: string,
): Promise<{ ownerType: "user" | "organization"; ownerId: string }> {
    if (ownerType !== "user" && ownerType !== "organization") {
        throw new ProfileError(
            "invalid_owner",
            400,
            "A page belongs to a person or to a team.",
        );
    }

    const allowed = await canManageOwner(caller, {
        ownerType,
        ownerId,
    });
    if (!allowed) {
        throw new ProfileError(
            "forbidden",
            403,
            "That page belongs to somebody else.",
        );
    }

    return { ownerType, ownerId };
}
