import { headers } from "next/headers";
import { requirePermission } from "@/lib/guards";
import Link from "next/link";

async function fetchRoles(q?: string) {
  const url = q ? `/api/admin/rbac/roles?q=${encodeURIComponent(q)}` : "/api/admin/rbac/roles";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load roles");
  return (await res.json()).roles as Array<{ id: string; name: string; slug: string; isSystem: boolean; description: string | null; }>;
}

export default async function RolesPage({ searchParams }: { searchParams: { q?: string } }) {
  try { await requirePermission("rbac.manage", await headers()); } catch { return <div className="p-6 text-sm text-red-500">You do not have access.</div>; }
  const q = searchParams?.q || "";
  const roles = await fetchRoles(q);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Roles</h1>
        <Link href="/dashboard/admin/permissions" className="text-sm underline">Back</Link>
      </div>
      <div className="space-y-2">
        <form className="flex gap-2">
          <input className="w-full rounded border bg-background px-3 py-2" name="q" defaultValue={q} placeholder="Search roles..." />
          <button className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground" type="submit">Search</button>
        </form>
      </div>

      <form action="/api/admin/rbac/roles" method="POST" className="grid gap-2 md:max-w-xl rounded border p-4">
        <div className="font-semibold">Create role</div>
        <input className="rounded border bg-background px-3 py-2" name="name" placeholder="Name" />
        <input className="rounded border bg-background px-3 py-2" name="slug" placeholder="Slug (optional)" />
        <input className="rounded border bg-background px-3 py-2" name="description" placeholder="Description (optional)" />
        <button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground" type="submit">Create</button>
      </form>

      <div className="rounded border divide-y">
        {roles.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-3">
            <div className="flex-1">
              <div className="font-medium">{r.name} {r.isSystem ? <span className="ml-2 text-[10px] rounded bg-muted px-1.5 py-0.5 align-middle">system</span> : null}</div>
              <div className="text-xs text-muted-foreground">{r.slug}</div>
              {r.description ? <div className="text-xs text-muted-foreground mt-1">{r.description}</div> : null}
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/dashboard/admin/permissions/roles/${r.id}`} className="text-sm underline">Manage</Link>
              {!r.isSystem && (
                <form action={`/api/admin/rbac/roles/${r.id}`} method="POST" suppressHydrationWarning>
                  <input type="hidden" name="_method" value="DELETE" />
                  <button formMethod="DELETE" className="text-xs underline text-red-500">Delete</button>
                </form>
              )}
            </div>
          </div>
        ))}
        {roles.length === 0 && <div className="p-6 text-sm text-muted-foreground">No roles found.</div>}
      </div>
    </div>
  );
}
