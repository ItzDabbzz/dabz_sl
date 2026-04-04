export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { requirePermission, getActiveOrgId } from "@/lib/guards";
import { rbacRolePermissions, rbacRoles } from "@/schemas/rbac";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { PermissionService } from "@/lib/permission-service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  await requirePermission("rbac.manage", await headers());
  // Ensure role belongs to active org
  const orgId = (await getActiveOrgId(await headers()))!;
  const { roleId } = await params;
  const roleRows = await db.select().from(rbacRoles).where(and(eq(rbacRoles.id as any, roleId as any) as any, eq(rbacRoles.organizationId as any, orgId as any) as any) as any).limit(1);
  if (!roleRows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rows = await db.select().from(rbacRolePermissions).where(eq(rbacRolePermissions.roleId as any, roleId as any) as any).orderBy(asc(rbacRolePermissions.permissionKey));
  return NextResponse.json({ permissions: rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;
  const { roleId } = await params;
  const roleRows = await db.select().from(rbacRoles).where(and(eq(rbacRoles.id as any, roleId as any) as any, eq(rbacRoles.organizationId as any, orgId as any) as any) as any).limit(1);
  if (!roleRows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Parse either JSON or FormData
  let permissionKey = "";
  let effect: "allow" | "deny" = "allow";
  let _method = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({} as any));
    permissionKey = String(body?.permissionKey || "").trim();
    effect = (String(body?.effect || "allow").toLowerCase() as any) === "deny" ? "deny" : "allow";
    _method = String(body?._method || "").toUpperCase();
  } else {
    const fd = await req.formData();
    permissionKey = String(fd.get("permissionKey") || "").trim();
    effect = (String(fd.get("effect") || "allow").toLowerCase() as any) === "deny" ? "deny" : "allow";
    _method = String(fd.get("_method") || "").toUpperCase();
  }

  if (_method === "DELETE") {
    if (!permissionKey) return NextResponse.json({ error: "invalid" }, { status: 400 });
    await db.delete(rbacRolePermissions).where(and(eq(rbacRolePermissions.roleId as any, roleId as any) as any, eq(rbacRolePermissions.permissionKey as any, permissionKey as any) as any) as any);
    PermissionService.invalidate();
    return NextResponse.json({ ok: true });
  }

  if (!permissionKey || !["allow", "deny"].includes(effect)) return NextResponse.json({ error: "invalid" }, { status: 400 });

  await db
    .insert(rbacRolePermissions)
    .values({ id: randomUUID(), roleId: roleId as any, permissionKey: permissionKey as any, effect })
    .onConflictDoNothing();

  PermissionService.invalidate();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;
  const { roleId } = await params;
  const roleRows = await db.select().from(rbacRoles).where(and(eq(rbacRoles.id as any, roleId as any) as any, eq(rbacRoles.organizationId as any, orgId as any) as any) as any).limit(1);
  if (!roleRows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const permissionKey = (new URL(_req.url).searchParams.get("permissionKey") || "").trim();
  if (!permissionKey) return NextResponse.json({ error: "invalid" }, { status: 400 });

  await db.delete(rbacRolePermissions).where(and(eq(rbacRolePermissions.roleId as any, roleId as any) as any, eq(rbacRolePermissions.permissionKey as any, permissionKey as any) as any) as any);
  PermissionService.invalidate();
  return NextResponse.json({ ok: true });



}
