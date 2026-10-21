export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { refreshProfileCaches } from "@/features/creator/profiles/server/cache";
import {
    profileErrorResponse,
    requireManagedProfile,
} from "@/features/creator/profiles/server/access";
import {
    ProfileError,
    featureItem,
    listFeatureableProducts,
} from "@/features/creator/profiles/server/manage";

/**
 * The products a creator may list.
 *
 * These are the products of the accounts the platform has proven are
 * theirs, and the products already in their own catalogue. The ones that
 * are already listed come back marked, so the console can show them as
 * chosen rather than offering them again.
 */
export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await ctx.params;
        const { profile } = await requireManagedProfile(req, id);

        const { searchParams } = new URL(req.url);
        const query = (searchParams.get("q") || "").trim();
        const limit = Math.max(
            1,
            Math.min(100, parseInt(searchParams.get("limit") || "40", 10)),
        );

        const items = await listFeatureableProducts(
            profile,
            query,
            limit,
        );
        return Response.json({ items });
    } catch (error) {
        return profileErrorResponse(error);
    }
}

/**
 * List a product on the page.
 *
 * The product has to be one the creator can account for, so a page cannot
 * pass somebody else's product off as its own.
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

        const item = await featureItem(profile, String(body.itemId ?? ""));

        refreshProfileCaches([profile.slug]);

        return Response.json({ item }, { status: 201 });
    } catch (error) {
        return profileErrorResponse(error);
    }
}
