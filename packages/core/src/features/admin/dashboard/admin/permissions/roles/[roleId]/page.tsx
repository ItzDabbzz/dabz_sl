import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { getActiveOrgId, requirePermission } from "@/server/auth/guards";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  rbacMemberRoles,
  rbacPermissions,
  rbacRolePermissions,
  rbacRoles,
} from "@/schemas/rbac";
import { and, asc, eq } from "drizzle-orm";

async function fetchRole(organizationId: string, roleId: string) {
  const [role] = await db
    .select()
    .from(rbacRoles)
    .where(
      and(
        eq(rbacRoles.id as any, roleId as any) as any,
        eq(rbacRoles.organizationId as any, organizationId as any) as any,
      ) as any,
    )
    .limit(1);

  return role;
}

async function fetchRolePerms(roleId: string) {
  return db
    .select()
    .from(rbacRolePermissions)
    .where(eq(rbacRolePermissions.roleId as any, roleId as any) as any)
    .orderBy(asc(rbacRolePermissions.permissionKey));
}

async function fetchAllPerms() {
  return db
    .select()
    .from(rbacPermissions)
    .orderBy(asc(rbacPermissions.area), asc(rbacPermissions.key));
}

async function fetchMembers(organizationId: string, roleId: string) {
  return db
    .select()
    .from(rbacMemberRoles)
    .where(
      and(
        eq(rbacMemberRoles.organizationId as any, organizationId as any) as any,
        eq(rbacMemberRoles.roleId as any, roleId as any) as any,
      ) as any,
    )
    .orderBy(asc(rbacMemberRoles.createdAt));
}

export default async function RoleDetailsPage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const requestHeaders = await headers();
  try { await requirePermission("rbac.manage", requestHeaders); } catch { return <div className="p-6 text-sm text-red-500">You do not have access.</div>; }
  const organizationId = (await getActiveOrgId(requestHeaders)) || "";
  const { roleId } = await params;
  const [role, perms, allPerms, members] = await Promise.all([
    fetchRole(organizationId, roleId),
    fetchRolePerms(roleId),
    fetchAllPerms(),
    fetchMembers(organizationId, roleId),
  ]);
  if (!role) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{role.name}</h1>
        <Link href="/dashboard/admin/permissions/roles" className="text-sm underline">Back to Roles</Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded border p-4 space-y-3">
          <div className="font-semibold">Role</div>
          <form action={`/api/admin/rbac/roles/${role.id}`} method="POST" className="grid gap-2">
            <input className="rounded border bg-background px-3 py-2" name="name" defaultValue={role.name} placeholder="Name" />
            <input className="rounded border bg-background px-3 py-2" name="description" defaultValue={role.description ?? ""} placeholder="Description" />
            <button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground" type="submit">Save</button>
          </form>

          <div className="font-semibold mt-4">Grants</div>
          <div className="text-xs text-muted-foreground">Allow or deny permissions for this role.</div>
          <div className="space-y-2">
            {perms.map((p) => (
              <div key={p.permissionKey} className="flex items-center justify-between rounded border px-3 py-2">
                <div className="text-sm">{p.permissionKey}</div>
                <form action={`/api/admin/rbac/roles/${roleId}/permissions`} method="POST" className="flex items-center gap-2" suppressHydrationWarning>
                  <input type="hidden" name="_method" value="DELETE" />
                  <input type="hidden" name="permissionKey" value={p.permissionKey} />
                  <button formMethod="DELETE" className="text-xs underline text-red-500">Remove</button>
                </form>
              </div>
            ))}
            {perms.length === 0 && <div className="text-sm text-muted-foreground">No grants yet.</div>}
          </div>
          <form action={`/api/admin/rbac/roles/${roleId}/permissions`} method="POST" className="mt-3 grid gap-2">
            <select name="permissionKey" className="rounded border bg-background px-3 py-2">
              <option value="">Add permission…</option>
              {allPerms.map((ap) => (
                <option key={ap.key} value={ap.key}>{ap.key}{ap.label ? ` — ${ap.label}` : ""}</option>
              ))}
            </select>
            <select name="effect" className="rounded border bg-background px-3 py-2">
              <option value="allow">allow</option>
              <option value="deny">deny</option>
            </select>
            <button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground" type="submit">Add</button>
          </form>
        </div>

        <div className="rounded border p-4 space-y-3">
          <div className="font-semibold">Members</div>
          <div className="text-xs text-muted-foreground">Members assigned to this role.</div>
          <form action={`/api/admin/rbac/roles/${roleId}/members`} method="POST" className="grid gap-2 md:max-w-md">
            <input className="rounded border bg-background px-3 py-2" name="memberId" placeholder="Member ID" />
            <button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground" type="submit">Add member</button>
          </form>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.memberId} className="flex items-center justify-between rounded border px-3 py-2">
                <div className="text-sm">{m.memberId}</div>
                <form action={`/api/admin/rbac/roles/${roleId}/members`} method="POST" className="flex items-center gap-2" suppressHydrationWarning>
                  <input type="hidden" name="_method" value="DELETE" />
                  <input type="hidden" name="memberId" value={m.memberId} />
                  <button formMethod="DELETE" className="text-xs underline text-red-500">Remove</button>
                </form>
              </div>
            ))}
            {members.length === 0 && <div className="text-sm text-muted-foreground">No members yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
