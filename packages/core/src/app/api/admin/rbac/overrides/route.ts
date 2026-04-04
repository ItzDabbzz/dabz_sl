export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { requirePermission, getActiveOrgId } from "@/lib/guards";
import { rbacUserPermissionOverrides } from "@/schemas/rbac";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { PermissionService } from "@/lib/permission-service";

export async function GET(req: NextRequest) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;
  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  if (!userId) return NextResponse.json({ overrides: [] });

  const rows = await db
    .select()
    .from(rbacUserPermissionOverrides)
    .where(and(eq(rbacUserPermissionOverrides.organizationId as any, orgId as any) as any, eq(rbacUserPermissionOverrides.userId as any, userId as any) as any) as any)
    .orderBy(asc(rbacUserPermissionOverrides.permissionKey));

  return NextResponse.json({ overrides: rows });
}

export async function POST(req: NextRequest) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;

  let userId = "";
  let permissionKey = "";
  let effect: "allow" | "deny" = "allow";
  let _method = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({} as any));
    userId = String(body?.userId || "").trim();
    permissionKey = String(body?.permissionKey || "").trim();
    effect = (String(body?.effect || "allow").toLowerCase() as any) === "deny" ? "deny" : "allow";
    _method = String(body?._method || "").toUpperCase();
  } else {
    const fd = await req.formData();
    userId = String(fd.get("userId") || "").trim();
    permissionKey = String(fd.get("permissionKey") || "").trim();
    effect = (String(fd.get("effect") || "allow").toLowerCase() as any) === "deny" ? "deny" : "allow";
    _method = String(fd.get("_method") || "").toUpperCase();
  }

  if (_method === "DELETE") {
    if (!userId || !permissionKey) return NextResponse.json({ error: "invalid" }, { status: 400 });
    await db.delete(rbacUserPermissionOverrides).where(and(eq(rbacUserPermissionOverrides.organizationId as any, orgId as any) as any, eq(rbacUserPermissionOverrides.userId as any, userId as any) as any, eq(rbacUserPermissionOverrides.permissionKey as any, permissionKey as any) as any) as any);
    PermissionService.invalidate();
    return NextResponse.json({ ok: true });
  }

  if (!userId || !permissionKey || !["allow", "deny"].includes(effect)) return NextResponse.json({ error: "invalid" }, { status: 400 });

  await db
    .insert(rbacUserPermissionOverrides)
    .values({ id: randomUUID(), userId: userId as any, organizationId: orgId as any, permissionKey: permissionKey as any, effect })
    .onConflictDoNothing();

  PermissionService.invalidate();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;
  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  const permissionKey = (searchParams.get("permissionKey") || "").trim();
  if (!userId || !permissionKey) return NextResponse.json({ error: "invalid" }, { status: 400 });

  await db.delete(rbacUserPermissionOverrides).where(and(eq(rbacUserPermissionOverrides.organizationId as any, orgId as any) as any, eq(rbacUserPermissionOverrides.userId as any, userId as any) as any, eq(rbacUserPermissionOverrides.permissionKey as any, permissionKey as any) as any) as any);
  PermissionService.invalidate();
  return NextResponse.json({ ok: true });



}
