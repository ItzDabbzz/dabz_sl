import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requirePermission, getActiveOrgId } from "@/lib/guards";
import { rbacRoles } from "@/schemas/rbac";
import { and, eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;
  const { roleId } = await params;
  const body = await req.json();
  const name = body?.name as string | undefined;
  const description = (body?.description ?? undefined) as string | undefined;

  await db.update(rbacRoles)
    .set({ ...(name ? { name } : {}), ...(description !== undefined ? { description: description as any } : {}) })
    .where(and(eq(rbacRoles.id as any, roleId as any) as any, eq(rbacRoles.organizationId as any, orgId as any) as any) as any);

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;
  const { roleId } = await params;

  const ct = req.headers.get("content-type") || "";
  let _method = "";
  let name: string | undefined = undefined;
  let description: string | undefined = undefined;
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({} as any));
    _method = String(body?._method || "").toUpperCase();
    name = body?.name as string | undefined;
    description = (body?.description ?? undefined) as string | undefined;
  } else {
    const fd = await req.formData();
    _method = String(fd.get("_method") || "").toUpperCase();
    name = (fd.get("name") as string) || undefined;
    description = (fd.get("description") as string) || undefined;
  }

  if (_method === "DELETE") {
    await db.delete(rbacRoles).where(and(eq(rbacRoles.id as any, roleId as any) as any, eq(rbacRoles.organizationId as any, orgId as any) as any) as any);
    return NextResponse.json({ ok: true });
  }

  // Treat as PATCH
  if (!name && description === undefined) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await db.update(rbacRoles)
    .set({ ...(name ? { name } : {}), ...(description !== undefined ? { description: description as any } : {}) })
    .where(and(eq(rbacRoles.id as any, roleId as any) as any, eq(rbacRoles.organizationId as any, orgId as any) as any) as any);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;
  const { roleId } = await params;

  await db.delete(rbacRoles).where(and(eq(rbacRoles.id as any, roleId as any) as any, eq(rbacRoles.organizationId as any, orgId as any) as any) as any);
  return NextResponse.json({ ok: true });
}
