import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mpItemCategories, mpItemRequests, mpItems } from "@/schemas/sl-schema";
import { auth } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
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
    if (!isPrivilegedRole(user.adminRole) && !isAdminId(user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "pending").toLowerCase();

    const rows = await db
      .select()
      .from(mpItemRequests)
      .where(eq(mpItemRequests.status as any, status as any) as any)
      .orderBy(desc(mpItemRequests.createdAt as any));

    return NextResponse.json({ items: rows });
  } catch (e: any) {
    if (e?.message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!isPrivilegedRole(user.adminRole) && !isAdminId(user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = await req.json();
    const id = body?.id as string | undefined;
    const action = (body?.action || "").toLowerCase(); // approve | reject
    const rejectReason = (body?.rejectReason || "").trim() || null;

    if (!id || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const [reqRow] = await db.select().from(mpItemRequests).where(eq(mpItemRequests.id as any, id as any) as any);
    if (!reqRow) return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (action === "reject") {
      const [updated] = await db
        .update(mpItemRequests)
        .set({ status: "rejected", rejectedByUserId: user.id as any, rejectReason, reviewedAt: new Date() as any })
        .where(eq(mpItemRequests.id as any, id as any) as any)
        .returning();
      return NextResponse.json({ request: updated });
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
      const [existing] = await db.select().from(mpItems).where(eq(mpItems.url as any, (reqRow as any).url as any) as any);
      if (existing) itemRow = existing;
    }

    const catIds: string[] = Array.isArray((reqRow as any).categoryIds) ? (reqRow as any).categoryIds : [];
    for (const cid of catIds) {
      try {
        await db
          .insert(mpItemCategories)
          .values({ itemId: itemRow.id as any, categoryId: cid as any })
          .onConflictDoNothing();
      } catch {}
    }

    const [updated] = await db
      .update(mpItemRequests)
      .set({ status: "approved", approvedByUserId: user.id as any, reviewedAt: new Date() as any })
      .where(eq(mpItemRequests.id as any, id as any) as any)
      .returning();

    revalidateTag("marketplace:stats");

    return NextResponse.json({ request: updated, item: itemRow });
  } catch (e: any) {
    if (e?.message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
