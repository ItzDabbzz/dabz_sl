export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { refreshProfileCaches } from "@/features/creator/profiles/server/cache";
import {
    profileErrorResponse,
    requireManagedProfile,
} from "@/features/creator/profiles/server/access";
import {
    ProfileError,
    deleteProfile,
    listAccountClaims,
    listFeaturedItems,
    updateProfile,
} from "@/features/creator/profiles/server/manage";
import { validateProfilePatch } from "@/features/creator/profiles/server/validation";

/**
 * One page, as its owner sees it.
 *
 * The response carries the page itself, the accounts it has claimed and
 * the products it lists, because those three are what a creator changes
 * - and the console changes them together.
 */
export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await ctx.params;
        const { profile } = await requireManagedProfile(req, id);

        const [accounts, items] = await Promise.all([
            listAccountClaims(profile.id),
            listFeaturedItems(profile.id),
        ]);

        return Response.json({ profile, accounts, items });
    } catch (error) {
        return profileErrorResponse(error);
    }
}

/**
 * Change a page.
 *
 * Only the fields that were sent are changed, so the console can save
 * one part of the page without blanking the rest.
 */
export async function PATCH(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await ctx.params;
        const { profile } = await requireManagedProfile(req, id);

        const body = await req.json().catch(() => null);
        const patch = validateProfilePatch(body);
        if (!patch.ok) {
            throw new ProfileError(
                "invalid_field",
                400,
                patch.error.message,
            );
        }

        const updated = await updateProfile(profile.id, patch.value);

        // The public page is cached, so it has to be told that the page
        // behind it has changed. The old address is cleared too, because
        // the address may have been what changed.
        refreshProfileCaches([updated.slug, profile.slug]);

        return Response.json({ profile: updated });
    } catch (error) {
        return profileErrorResponse(error);
    }
}

/**
 * Delete a page.
 *
 * The accounts and products on it go with it. This is the creator's own
 * page, so they are the one who decides.
 */
export async function DELETE(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await ctx.params;
        const { profile } = await requireManagedProfile(req, id);

        await deleteProfile(profile.id);

        refreshProfileCaches([profile.slug]);

        return Response.json({ ok: true });
    } catch (error) {
        return profileErrorResponse(error);
    }
}
