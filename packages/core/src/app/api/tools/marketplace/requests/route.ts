export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mpItemCategories, mpItemRequests, mpItems } from "@/schemas/sl-schema";
import { auth } from "@/lib/auth";
import { desc, eq, ilike, or, and } from "drizzle-orm";
import { revalidateTag } from "next/cache";

function isPrivilegedRole(role: string | undefined | null) {
  return !!role && ["owner", "developer", "admin", "mod"].includes(role);
}
function isAdminId(id: string | undefined | null) {
  const admins = (process.env.BETTER_AUTH_ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return !!id && admins.includes(id);
}

async function getUser(req: NextRequest) {
  const ses = await auth.api.getSession({ headers: req.headers as any });
  if (!ses?.user) throw new Error("unauthorized");
  return ses.user as any;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!isPrivilegedRole(user.role) && !isAdminId(user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "pending").toLowerCase();
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));
    const includeCounts = searchParams.get("include")?.split(",").includes("counts");

    // Build filter
    const filters: any[] = [eq(mpItemRequests.status as any, status as any)];
    if (q) {
      const pattern = `%${q}%`;
      filters.push(
        or(
          ilike(mpItemRequests.title as any, pattern as any),
          ilike(mpItemRequests.url as any, pattern as any),
          ilike(mpItemRequests.store as any, pattern as any)
        ) as any
      );
    }

    const rows = await db
      .select()
      .from(mpItemRequests)
      .where(and(...filters) as any)
      .orderBy(desc(mpItemRequests.createdAt as any))
      .limit(limit as any)
      .offset(offset as any);

    let counts: Record<string, number> | undefined;
    if (includeCounts) {
      const raw = await db.execute<any>(`select status, count(*)::int as c from sl_mp_item_requests group by 1` as any);
      counts = {};
      const arr: any[] = (raw as any).rows || raw || [];
      for (const r of arr) {
        if (r && typeof r.status === "string") counts[r.status] = parseInt(r.c as any, 10) || 0;
      }
      for (const k of ["pending", "approved", "rejected"]) if (!(k in counts)) counts[k] = 0;
    }

    return NextResponse.json({ items: rows, limit, offset, q, status, counts });
  } catch (e: any) {
    if (e?.message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!isPrivilegedRole(user.role) && !isAdminId(user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = await req.json();
    const singleId = body?.id as string | undefined;
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: any) => typeof x === "string") : [];
    const targetIds = (singleId ? [singleId] : []).concat(ids).filter(Boolean);
    const action = (body?.action || "").toLowerCase(); // approve | reject
    const rejectReason = (body?.rejectReason || "").trim() || null;

    if (!targetIds.length || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const updatedRequests: any[] = [];
    const createdItems: any[] = [];

    for (const id of targetIds) {
      const [reqRow] = await db.select().from(mpItemRequests).where(eq(mpItemRequests.id as any, id as any) as any);
      if (!reqRow) continue;

      if (action === "reject") {
        const [updated] = await db
          .update(mpItemRequests)
          .set({ status: "rejected", rejectedByUserId: user.id as any, rejectReason, reviewedAt: new Date() as any })
          .where(eq(mpItemRequests.id as any, id as any) as any)
          .returning();
        if (updated) updatedRequests.push(updated);
        continue;
      }

      // Approve: create mpItems, map categories, then mark as approved
      const values = {
        ownerUserId: user.id as any,
        url: (reqRow as any).url,
        title: (reqRow as any).title,
        version: (reqRow as any).version || null,
        images: (reqRow as any).images || [],
        price: (reqRow as any).price || null,
        creator: (reqRow as any).creator || null,
        store: (reqRow as any).store || null,
        permissions: (reqRow as any).permissions || null,
        description: (reqRow as any).description || null,
        features: (reqRow as any).features || [],
        contents: (reqRow as any).contents || [],
        updatedOn: (reqRow as any).updatedOn || null,
      } as any;

      let itemRow: any;
      try {
        [itemRow] = await db.insert(mpItems).values(values).returning();
      } catch {
        const [existing] = await db
          .select({ id: mpItems.id })
          .from(mpItems)
          .where(eq(mpItems.url as any, (reqRow as any).url as any) as any);
        if (existing) itemRow = existing;
      }

      if (itemRow) {
        createdItems.push(itemRow);
        const catIds: string[] = Array.isArray((reqRow as any).categoryIds) ? (reqRow as any).categoryIds : [];
        for (const cid of catIds) {
          try {
            await db
              .insert(mpItemCategories)
              .values({ itemId: itemRow.id as any, categoryId: cid as any })
              .onConflictDoNothing();
          } catch {}
        }
      }

      const [updated] = await db
        .update(mpItemRequests)
        .set({ status: "approved", approvedByUserId: user.id as any, reviewedAt: new Date() as any })
        .where(eq(mpItemRequests.id as any, id as any) as any)
        .returning();
      if (updated) updatedRequests.push(updated);
    }

    revalidateTag("marketplace:stats");
    return NextResponse.json({ updated: updatedRequests, items: createdItems });
  } catch (e: any) {
    if (e?.message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });



  }
}
