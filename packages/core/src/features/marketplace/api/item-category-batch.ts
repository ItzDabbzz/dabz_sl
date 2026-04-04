export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpItemCategories, mpItems } from "@/schemas/sl-schema";
import { and, eq, inArray } from "drizzle-orm";
import { requirePermission } from "@/lib/guards";
import { requireUserFromRequest } from "@/server/auth/session";

// POST: { itemIds: string[] } -> { mappings: Array<{ itemId: string, categoryId: string }> }
export async function POST(req: NextRequest) {
  try {
    await requireUserFromRequest(req);
    const body = await req.json();
    const ids: string[] = Array.isArray(body?.itemIds) ? body.itemIds : [];
    if (!ids.length) return NextResponse.json({ mappings: [] });

    const rows = await db
      .select({ itemId: mpItemCategories.itemId, categoryId: mpItemCategories.categoryId })
      .from(mpItemCategories)
      .where(
        and(
          inArray(mpItemCategories.itemId as any, ids as any) as any
          // Ownership is implicit via items table, but we don't join here for performance.
          // The client limits ids to those returned for the current user.
        ) as any
      );

    return NextResponse.json({ mappings: rows });
  } catch (e: any) {
    if (e?.message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// PATCH: { itemIds: string[], categoryIds: string[], mode?: "add" | "remove" | "replace" }
export async function PATCH(req: NextRequest) {
  try {
    await requirePermission("marketplace.moderate", req.headers as any);
    const user = await requireUserFromRequest(req);
    const body = await req.json();

    const itemIds = Array.isArray(body?.itemIds)
      ? (body.itemIds as unknown[])
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
    const categoryIds = Array.isArray(body?.categoryIds)
      ? (body.categoryIds as unknown[])
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
    const modeRaw = typeof body?.mode === "string" ? body.mode.toLowerCase() : "add";
    const mode = modeRaw === "remove" || modeRaw === "replace" ? modeRaw : "add";

    if (!itemIds.length) {
      return NextResponse.json({ updated: 0 });
    }

    const ownedRows = await db
      .select({ id: mpItems.id })
      .from(mpItems)
      .where(
        and(
          inArray(mpItems.id as any, itemIds as any) as any,
          eq(mpItems.ownerUserId as any, user.id as any) as any,
        ) as any,
      );
    const ownedIds = ownedRows.map((row: any) => row.id);
    if (!ownedIds.length) {
      return NextResponse.json({ updated: 0 });
    }

    if (mode === "replace") {
      await db
        .delete(mpItemCategories)
        .where(inArray(mpItemCategories.itemId as any, ownedIds as any) as any);

      for (const itemId of ownedIds) {
        for (const categoryId of categoryIds) {
          await db
            .insert(mpItemCategories)
            .values({ itemId: itemId as any, categoryId: categoryId as any })
            .onConflictDoNothing();
        }
      }

      return NextResponse.json({ updated: ownedIds.length });
    }

    if (!categoryIds.length) {
      return NextResponse.json({ updated: ownedIds.length });
    }

    if (mode === "remove") {
      await db
        .delete(mpItemCategories)
        .where(
          and(
            inArray(mpItemCategories.itemId as any, ownedIds as any) as any,
            inArray(mpItemCategories.categoryId as any, categoryIds as any) as any,
          ) as any,
        );
      return NextResponse.json({ updated: ownedIds.length });
    }

    for (const itemId of ownedIds) {
      for (const categoryId of categoryIds) {
        await db
          .insert(mpItemCategories)
          .values({ itemId: itemId as any, categoryId: categoryId as any })
          .onConflictDoNothing();
      }
    }

    return NextResponse.json({ updated: ownedIds.length });
  } catch (e: any) {
    if (e?.message === "unauthorized") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (e?.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
