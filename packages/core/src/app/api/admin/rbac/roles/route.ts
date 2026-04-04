export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { requirePermission, getActiveOrgId } from "@/lib/guards";
import { rbacRoles } from "@/schemas/rbac";
import { and, asc, eq, ilike } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  const rows = await db
    .select()
    .from(rbacRoles)
    .where(q ? and(eq(rbacRoles.organizationId as any, orgId as any) as any, ilike(rbacRoles.name as any, `%${q}%`) as any) : (eq(rbacRoles.organizationId as any, orgId as any) as any))
    .orderBy(asc(rbacRoles.isSystem), asc(rbacRoles.name));

  return NextResponse.json({ roles: rows });
}

export async function POST(req: NextRequest) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;
  const body = await req.json();
  const name = String(body?.name || "").trim();
  const slug = String(body?.slug || name.toLowerCase().replace(/\s+/g, "-")).trim();
  const description = (body?.description ?? null) as string | null;
  if (!name || !slug) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const id = randomUUID();
  await db
    .insert(rbacRoles)
    .values({ id, organizationId: orgId as any, name, slug, description: description as any, isSystem: false as any })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true, id });



}
