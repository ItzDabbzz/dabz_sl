export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpCategories, mpItemCategories } from "@/schemas/sl-schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { requireStaff } from "@/server/auth/guards";
import {
  normalizePath,
  pathKey,
  type CategoryPath,
} from "@/features/marketplace/shared/category-path";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(req);
    const { id } = await ctx.params;
    const body = await req.json();

    const [current] = await db
      .select()
      .from(mpCategories)
      .where(eq(mpCategories.id as any, id as any) as any)
      .limit(1);
    if (!current) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const currentPath = normalizePath(current.path as unknown as string[]);

    // The new path arrives as a `path` array. The path is the whole identity
    // of a category, so a rename replaces the path outright.
    const nextPath = Array.isArray(body?.path)
      ? normalizePath(body.path)
      : currentPath;

    if (!nextPath.length) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const samePath = pathKey(currentPath) === pathKey(nextPath);

    // The NSFW flag can be set on its own, without touching the path.
    const wantsNsfw =
      typeof body?.isNsfw === "boolean" ? body.isNsfw : null;

    if (wantsNsfw !== null && wantsNsfw !== (current.isNsfw ?? false)) {
      // The flag follows the branch: marking a parent covers everything
      // beneath it, so the rule is one thing rather than per-node.
      const branch = await db
        .select({ id: mpCategories.id, path: mpCategories.path })
        .from(mpCategories)
        .where(
          eq(mpCategories.ownerUserId as any, current.ownerUserId as any) as any,
        );
      const prefixKey = pathKey(currentPath);
      for (const row of branch) {
        const rowPath = normalizePath(row.path as unknown as string[]);
        const inBranch =
          pathKey(rowPath.slice(0, currentPath.length)) === prefixKey;
        if (!inBranch) continue;
        await db
          .update(mpCategories)
          .set({ isNsfw: wantsNsfw } as any)
          .where(eq(mpCategories.id as any, row.id as any) as any);
      }
      revalidateTag("marketplace:stats", {});
      if (samePath) {
        const [updated] = await db
          .select()
          .from(mpCategories)
          .where(eq(mpCategories.id as any, id as any) as any);
        return NextResponse.json({
          item: {
            id: updated.id,
            path: normalizePath(updated.path as unknown as string[]),
            isNsfw: updated.isNsfw ?? false,
          },
          updatedBranch: true,
        });
      }
    }

    // Renaming onto a path that already exists is a move, not a rename.
    //
    // Without this the rename would silently create a second category with
    // the same path and split the items across two rows. Merge them instead:
    // the items move to the existing category and the emptied one is removed.
    if (!samePath) {
      const [target] = await db
        .select()
        .from(mpCategories)
        .where(
          and(
            eq(mpCategories.path as any, nextPath as any) as any,
            eq(mpCategories.ownerUserId as any, current.ownerUserId as any) as any,
          ),
        )
        .limit(1);

      if (target?.id && target.id !== current.id) {
        // Move the item links onto the target, then drop the source row.
        const links = await db
          .select()
          .from(mpItemCategories)
          .where(eq(mpItemCategories.categoryId as any, current.id as any) as any);
        for (const link of links) {
          try {
            await db
              .insert(mpItemCategories)
              .values({
                itemId: link.itemId as any,
                categoryId: target.id as any,
              })
              .onConflictDoNothing();
          } catch {
            /* the link already exists */
          }
        }
        await db
          .delete(mpItemCategories as any)
          .where(eq(mpItemCategories.categoryId as any, current.id as any) as any);
        await db
          .delete(mpCategories as any)
          .where(eq(mpCategories.id as any, current.id as any) as any);

        revalidateTag("marketplace:stats", {});
        return NextResponse.json({
          item: {
            id: target.id,
            path: normalizePath(target.path as unknown as string[]),
          },
          merged: true,
          movedItems: links.length,
        });
      }
    }

    // A rename moves the whole branch: descendants are separate rows, and a
    // renamed node whose children keep the old name splits the tree.
    const descendants = await db
      .select({ id: mpCategories.id, path: mpCategories.path })
      .from(mpCategories)
      .where(
        eq(mpCategories.ownerUserId as any, current.ownerUserId as any) as any,
      );

    const prefixKey = pathKey(currentPath);
    const moved: string[] = [];

    for (const row of descendants) {
      const rowPath = normalizePath(row.path as unknown as string[]);
      // A descendant shares the renamed node's prefix.
      const isDescendant =
        rowPath.length > currentPath.length &&
        rowPath.slice(0, currentPath.length).join("\u001f") === prefixKey;
      if (!isDescendant) continue;

      const rewritten = [...nextPath, ...rowPath.slice(currentPath.length)];
      await db
        .update(mpCategories)
        .set({ path: rewritten } as any)
        .where(eq(mpCategories.id as any, row.id as any) as any);
      moved.push(row.id);
    }

    const [row] = await db
      .update(mpCategories)
      .set({ path: nextPath } as any)
      .where(eq(mpCategories.id as any, id as any) as any)
      .returning();

    revalidateTag("marketplace:stats", {});
    return NextResponse.json({
      item: {
        id: row.id,
        path: normalizePath(row.path as unknown as string[]),
        isNsfw: row.isNsfw ?? false,
      },
      movedDescendants: moved.length,
    });
  } catch (e: any) {
    if (e?.message === "forbidden" || e?.message === "unauthorized") {
      return NextResponse.json({ error: e.message }, { status: e.message === "unauthorized" ? 401 : 403 });
    }
    console.error(e);
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(req);
    const { id } = await ctx.params;
    // Remove mappings first, then delete the category
    await db.delete(mpItemCategories as any).where(eq(mpItemCategories.categoryId as any, id as any) as any);
    await db.delete(mpCategories as any).where(eq(mpCategories.id as any, id as any) as any);
    revalidateTag("marketplace:stats", {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === "forbidden" || e?.message === "unauthorized") {
      return NextResponse.json({ error: e.message }, { status: e.message === "unauthorized" ? 401 : 403 });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
