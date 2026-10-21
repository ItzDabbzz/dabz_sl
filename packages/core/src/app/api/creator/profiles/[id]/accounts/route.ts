export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { refreshProfileCaches } from "@/features/creator/profiles/server/cache";
import {
    profileErrorResponse,
    requireManagedProfile,
} from "@/features/creator/profiles/server/access";
import {
    ProfileError,
    addAccountClaim,
    listAccountClaims,
} from "@/features/creator/profiles/server/manage";

/**
 * The accounts a page has claimed.
 *
 * A claim is a statement that the account is the creator's. It starts
 * unproven, and the creator is given a code to put on an object in-world
 * so the platform can check it.
 */
export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await ctx.params;
        const { profile } = await requireManagedProfile(req, id);
        const accounts = await listAccountClaims(profile.id);
        return Response.json({ accounts });
    } catch (error) {
        return profileErrorResponse(error);
    }
}

/**
 * Claim a Second Life account.
 *
 * The claim is not proof: the account stays unverified until the platform
 * has seen the code in-world. A creator cannot mark their own claim as
 * proven, because then a claim would be worth nothing.
 */
export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await ctx.params;
        const { profile } = await requireManagedProfile(req, id);

        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            throw new ProfileError(
                "invalid_body",
                400,
                "A body is required.",
            );
        }

        const account = await addAccountClaim(profile.id, {
            slAccountName: String(body.slAccountName ?? ""),
            slAccountUuid: body.slAccountUuid
                ? String(body.slAccountUuid)
                : null,
        });

        refreshProfileCaches([profile.slug]);

        return Response.json({ account }, { status: 201 });
    } catch (error) {
        return profileErrorResponse(error);
    }
}
