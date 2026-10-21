export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { refreshProfileCaches } from "@/features/creator/profiles/server/cache";
import { requireStaff } from "@/server/auth/guards";
import {
    profileErrorResponse,
    requireManagedProfile,
} from "@/features/creator/profiles/server/access";
import {
    ProfileError,
    setAccountVerified,
} from "@/features/creator/profiles/server/manage";
import { isUuid } from "@/features/creator/profiles/server/validation";

/**
 * Settle whether a claim on a Second Life account was proven.
 *
 * This is the platform's job, not the creator's. A creator who could
 * mark their own claim as proven could claim any account in Second Life
 * and list its products as their own, so only staff may do this.
 *
 * The proof itself arrives from the world: an object the account owns
 * carries the code, and the platform has seen it. Staff record what they
 * saw.
 */
export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ id: string; accountId: string }> },
) {
    try {
        const staff = await requireStaff(req);

        const { id, accountId } = await ctx.params;
        const { profile } = await requireManagedProfile(req, id);

        if (!isUuid(accountId)) {
            throw new ProfileError(
                "not_found",
                404,
                "No such account claim.",
            );
        }

        const body = await req.json().catch(() => ({}));
        const verified = body?.verified !== false;
        const method = body?.verificationMethod
            ? String(body.verificationMethod)
            : "staff";
        /**
         * A refusal carries its reason. The creator reads it, and the
         * record of why the claim was refused is kept.
         */
        const reason =
            body?.reason != null ? String(body.reason).slice(0, 500) : null;

        const account = await setAccountVerified(
            profile.id,
            accountId,
            verified,
            method,
            reason,
        );

        refreshProfileCaches([profile.slug]);

        return Response.json({ account, verifiedBy: staff.id });
    } catch (error) {
        return profileErrorResponse(error);
    }
}
