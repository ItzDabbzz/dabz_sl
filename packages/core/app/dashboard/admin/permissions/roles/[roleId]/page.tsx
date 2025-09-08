import { headers } from "next/headers";
import { requirePermission } from "@/lib/guards";
import Link from "next/link";

async function fetchRole(roleId: string) {
  const res = await fetch(`/api/admin/rbac/roles?q=${encodeURIComponent(roleId)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load role");
  const data = await res.json();
  const found = (data.roles as any[]).find((r) => r.id === roleId);
  if (!found) throw new Error("not_found");
  return found as { id: string; name: string; slug: string; isSystem: boolean; description: string | null };
}

async function fetchRolePerms(roleId: string) {
  const res = await fetch(`/api/admin/rbac/roles/${roleId}/permissions`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load role perms");
  return (await res.json()).permissions as Array<{ permissionKey: string; effect: string }>;
}

async function fetchAllPerms() {
  const res = await fetch(`/api/admin/rbac/permissions`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load perms");
  return (await res.json()).permissions as Array<{ key: string; label: string | null; area: string | null }>;
}

async function fetchMembers(roleId: string) {
  const res = await fetch(`/api/admin/rbac/roles/${roleId}/members`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load members");
  return (await res.json()).members as Array<{ memberId: string; organizationId: string; roleId: string }>;
}

export default async function RoleDetailsPage({ params }: { params: { roleId: string } }) {
  try { await requirePermission("rbac.manage", await headers()); } catch { return <div className="p-6 text-sm text-red-500">You do not have access.</div>; }
  const { roleId } = params;
  const [role, perms, allPerms, members] = await Promise.all([
    fetchRole(roleId),
    fetchRolePerms(roleId),
    fetchAllPerms(),
    fetchMembers(roleId),
  ]);

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
