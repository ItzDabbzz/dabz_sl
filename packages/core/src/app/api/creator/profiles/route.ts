export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { refreshProfileCaches } from "@/features/creator/profiles/server/cache";
import {
    getProfileCaller,
    profileErrorResponse,
    requireManageableOwner,
} from "@/features/creator/profiles/server/access";
import {
    createProfile,
    listManageableProfiles,
} from "@/features/creator/profiles/server/manage";
import { getManagedOrgIds } from "@/features/creator/profiles/server/ownership";
import { ProfileError } from "@/features/creator/profiles/server/manage";
import { validateProfilePatch } from "@/features/creator/profiles/server/validation";

/**
 * The pages a caller may change.
 *
 * A creator can have a page of their own and a page for each team they
 * run. This lists them all, and it is the list the console shows.
 */
export async function GET(req: NextRequest) {
    try {
        const caller = await getProfileCaller(req);
        if (!caller) {
            throw new ProfileError(
                "unauthorized",
                401,
                "Sign in to continue.",
            );
        }

        const orgIds = await getManagedOrgIds(caller.id);
        const profiles = await listManageableProfiles({
            userId: caller.id,
            orgIds,
        });

        return Response.json({ profiles });
    } catch (error) {
        return profileErrorResponse(error);
    }
}

/**
 * Create a page.
 *
 * A page belongs to a person or to a team, and the caller has to be that
 * person or somebody who runs that team. The new page starts as a draft:
 * it is not public until its owner publishes it.
 */
export async function POST(req: NextRequest) {
    try {
        const caller = await getProfileCaller(req);
        if (!caller) {
            throw new ProfileError(
                "unauthorized",
                401,
                "Sign in to continue.",
            );
        }

        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            throw new ProfileError(
                "invalid_body",
                400,
                "A body is required.",
            );
        }

        const ownerType = body.ownerType === "organization"
            ? "organization"
            : "user";
        // A person may only make a page for themselves.
        const ownerId = ownerType === "user"
            ? caller.id
            : String(body.ownerId ?? caller.activeOrgId ?? "").trim();

        if (!ownerId) {
            throw new ProfileError(
                "invalid_owner",
                400,
                "A team must be named.",
            );
        }

        const owner = await requireManageableOwner(
            caller,
            ownerType,
            ownerId,
        );

        const patch = validateProfilePatch(body);
        if (!patch.ok) {
            throw new ProfileError(
                "invalid_field",
                400,
                patch.error.message,
            );
        }
        if (!patch.value.displayName) {
            throw new ProfileError(
                "invalid_display_name",
                400,
                "A name is required.",
            );
        }

        const profile = await createProfile({
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            displayName: patch.value.displayName,
            slug: patch.value.slug,
        });

        refreshProfileCaches([]);
        return Response.json({ profile }, { status: 201 });
    } catch (error) {
        return profileErrorResponse(error);
    }
}
