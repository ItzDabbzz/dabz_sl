import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requirePermission, getActiveOrgId } from "@/lib/guards";
import { rbacMemberRoles, rbacRoles } from "@/schemas/rbac";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { PermissionService } from "@/lib/permission-service";

export async function GET(_req: NextRequest, { params }: { params: { roleId: string } }) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;
  const { roleId } = params;
  const roleRows = await db.select().from(rbacRoles).where(and(eq(rbacRoles.id as any, roleId as any) as any, eq(rbacRoles.organizationId as any, orgId as any) as any) as any).limit(1);
  if (!roleRows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rows = await db.select().from(rbacMemberRoles).where(and(eq(rbacMemberRoles.roleId as any, roleId as any) as any, eq(rbacMemberRoles.organizationId as any, orgId as any) as any) as any).orderBy(asc(rbacMemberRoles.createdAt));
  return NextResponse.json({ members: rows });
}

export async function POST(req: NextRequest, { params }: { params: { roleId: string } }) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;
  const { roleId } = params;
  const roleRows = await db.select().from(rbacRoles).where(and(eq(rbacRoles.id as any, roleId as any) as any, eq(rbacRoles.organizationId as any, orgId as any) as any) as any).limit(1);
  if (!roleRows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Parse json or form
  let memberId = "";
  let _method = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({} as any));
    memberId = String(body?.memberId || "").trim();
    _method = String(body?._method || "").toUpperCase();
  } else {
    const fd = await req.formData();
    memberId = String(fd.get("memberId") || "").trim();
    _method = String(fd.get("_method") || "").toUpperCase();
  }

  if (_method === "DELETE") {
    if (!memberId) return NextResponse.json({ error: "invalid" }, { status: 400 });
    await db.delete(rbacMemberRoles).where(and(eq(rbacMemberRoles.roleId as any, roleId as any) as any, eq(rbacMemberRoles.organizationId as any, orgId as any) as any, eq(rbacMemberRoles.memberId as any, memberId as any) as any) as any);
    PermissionService.invalidate();
    return NextResponse.json({ ok: true });
  }

  if (!memberId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  await db
    .insert(rbacMemberRoles)
    .values({ id: randomUUID(), memberId: memberId as any, organizationId: orgId as any, roleId: roleId as any })
    .onConflictDoNothing();

  PermissionService.invalidate();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { roleId: string } }) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;
  const { roleId } = params;
  const roleRows = await db.select().from(rbacRoles).where(and(eq(rbacRoles.id as any, roleId as any) as any, eq(rbacRoles.organizationId as any, orgId as any) as any) as any).limit(1);
  if (!roleRows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const memberId = (new URL(req.url).searchParams.get("memberId") || "").trim();
  if (!memberId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  await db.delete(rbacMemberRoles).where(and(eq(rbacMemberRoles.roleId as any, roleId as any) as any, eq(rbacMemberRoles.organizationId as any, orgId as any) as any, eq(rbacMemberRoles.memberId as any, memberId as any) as any) as any);
  PermissionService.invalidate();
  return NextResponse.json({ ok: true });
}
