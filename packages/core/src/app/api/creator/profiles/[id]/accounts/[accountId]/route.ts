export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { refreshProfileCaches } from "@/features/creator/profiles/server/cache";
import {
    profileErrorResponse,
    requireManagedProfile,
} from "@/features/creator/profiles/server/access";
import {
    ProfileError,
    listAccountClaims,
    removeAccountClaim,
} from "@/features/creator/profiles/server/manage";
import { isUuid } from "@/features/creator/profiles/server/validation";

/** The account a claim is about. */
export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ id: string; accountId: string }> },
) {
    try {
        const { id, accountId } = await ctx.params;
        const { profile } = await requireManagedProfile(req, id);

        if (!isUuid(accountId)) {
            throw new ProfileError("not_found", 404, "No such account claim.");
        }

        const accounts = await listAccountClaims(profile.id);
        const account = accounts.find((row) => row.id === accountId);
        if (!account) {
            throw new ProfileError(
                "not_found",
                404,
                "No such account claim.",
            );
        }
        return Response.json({ account });
    } catch (error) {
        return profileErrorResponse(error);
    }
}

/**
 * Give up a claim on a Second Life account.
 *
 * The products of an account the platform has proven are the creator's
 * stop appearing on the page when the claim is dropped.
 */
export async function DELETE(
    req: NextRequest,
    ctx: { params: Promise<{ id: string; accountId: string }> },
) {
    try {
        const { id, accountId } = await ctx.params;
        const { profile } = await requireManagedProfile(req, id);

        if (!isUuid(accountId)) {
            throw new ProfileError(
                "not_found",
                404,
                "No such account claim.",
            );
        }

        await removeAccountClaim(profile.id, accountId);

        refreshProfileCaches([profile.slug]);

        return Response.json({ ok: true });
    } catch (error) {
        return profileErrorResponse(error);
    }
}
