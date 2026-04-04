export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpItemRequests } from "@/schemas/sl-schema";
import { auth } from "@/server/auth/core";

function normalizeImages(input: string): string[] {
  return (input || "")
    .split(/\r?\n|,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const ses = await auth.api.getSession({ headers: req.headers as any }).catch(() => null);
    const body = await req.json();

    // Basic validation: required fields
    const title = (body?.title || "").trim();
    const url = (body?.url || "").trim();
    const store = (body?.store || "").trim();
    const price = (body?.price || "").trim();
    const description = (body?.description || "").trim();
    const creatorName = (body?.creator?.name || body?.creatorName || "").trim();
    const creatorLink = (body?.creator?.link || body?.creatorLink || "").trim();
    const images = Array.isArray(body?.images) ? body.images : normalizeImages(body?.imagesText || "");
    const permissions = body?.permissions || null;
    const categoryIds: string[] = Array.isArray(body?.categoryIds) ? body.categoryIds : [];

    if (!title || !url || !store || !price || !description) {
      return NextResponse.json({ error: "missing_required" }, { status: 400 });
    }
    if (!images.length) {
      return NextResponse.json({ error: "images_required" }, { status: 400 });
    }
    if (!creatorName || !creatorLink) {
      return NextResponse.json({ error: "creator_required" }, { status: 400 });
    }
    if (!permissions || !permissions.copy || !permissions.modify || !permissions.transfer) {
      return NextResponse.json({ error: "permissions_required" }, { status: 400 });
    }
    if (!categoryIds.length) {
      return NextResponse.json({ error: "categories_required" }, { status: 400 });
    }

    const [row] = await db
      .insert(mpItemRequests)
      .values({
        requestedByUserId: (ses?.user as any)?.id || null,
        requesterEmail: (ses?.user as any)?.email || (body?.email || null),
        url,
        title,
        version: body?.version || null,
        images,
        price,
        creator: { name: creatorName, link: creatorLink },
        store,
        permissions,
        description,
        features: Array.isArray(body?.features) ? body.features : [],
        contents: Array.isArray(body?.contents) ? body.contents : [],
        updatedOn: null,
        categoryIds,
        status: "pending",
      } as any)
      .onConflictDoNothing()
      .returning();

    if (!row) return NextResponse.json({ error: "duplicate_url" }, { status: 409 });
    return NextResponse.json({ request: row }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });


  }
}
