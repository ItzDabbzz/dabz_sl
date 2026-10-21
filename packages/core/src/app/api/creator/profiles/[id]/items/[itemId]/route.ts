export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { refreshProfileCaches } from "@/features/creator/profiles/server/cache";
import {
    profileErrorResponse,
    requireManagedProfile,
} from "@/features/creator/profiles/server/access";
import {
    ProfileError,
    unfeatureItem,
} from "@/features/creator/profiles/server/manage";
import { isUuid } from "@/features/creator/profiles/server/validation";

/**
 * Take a product off the page.
 *
 * The product goes back to being simply a product in the marketplace.
 */
export async function DELETE(
    req: NextRequest,
    ctx: { params: Promise<{ id: string; itemId: string }> },
) {
    try {
        const { id, itemId } = await ctx.params;
        const { profile } = await requireManagedProfile(req, id);

        if (!isUuid(itemId)) {
            throw new ProfileError("not_found", 404, "That product is not listed.");
        }

        await unfeatureItem(profile.id, itemId);

        refreshProfileCaches([profile.slug]);

        return Response.json({ ok: true });
    } catch (error) {
        return profileErrorResponse(error);
    }
}
