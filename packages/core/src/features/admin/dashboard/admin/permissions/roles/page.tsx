import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { getActiveOrgId, requirePermission } from "@/server/auth/guards";
import Link from "next/link";
import { rbacRoles } from "@/schemas/rbac";
import { and, asc, eq, ilike, isNull } from "drizzle-orm";
import { DashboardPage } from "@/features/dashboard/components/page";

/**
 * The roles of one scope.
 *
 * A platform role belongs to the site; an organization role belongs to a
 * creator team. They are listed apart, because they mean different things.
 */
async function fetchRoles(
    scope: "platform" | "organization",
    organizationId: string,
    q?: string,
) {
    const scopeFilter =
        scope === "platform"
            ? isNull(rbacRoles.organizationId as any)
            : eq(rbacRoles.organizationId as any, organizationId as any);
    return db
        .select()
        .from(rbacRoles)
        .where(
            q
                ? and(scopeFilter, ilike(rbacRoles.name as any, `%${q}%`) as any)
                : scopeFilter,
        )
        .orderBy(asc(rbacRoles.isSystem), asc(rbacRoles.name));
}

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ q?: string; scope?: string }> }) {
  const requestHeaders = await headers();
  try { await requirePermission("rbac.manage", requestHeaders); } catch { return <div className="p-6 text-sm text-red-500">You do not have access.</div>; }
  const organizationId = (await getActiveOrgId(requestHeaders)) || "";
  const sp = await searchParams;
  const q = sp?.q || "";
  const scope = sp?.scope === "platform" ? "platform" : "organization";
  const roles = await fetchRoles(scope, organizationId, q);

  return (
    <DashboardPage
      title={scope === "platform" ? "Staff roles" : "Organization roles"}
      description={
        scope === "platform"
          ? "Roles that belong to the site. Whoever holds one can do it across every organization."
          : `Roles that belong to the organization you are acting as.`
      }
      crumbs={[
        { label: "Console", href: "/dashboard" },
        { label: "Admin" },
        { label: "Permissions" },
        { label: "Roles" },
      ]}
      actions={
        <Link href="/dashboard/admin/permissions" className="text-sm underline">Back</Link>
      }
    >
      <div className="flex gap-2 text-sm">
        <Link
          href="/dashboard/admin/permissions/roles"
          className={scope === "organization" ? "font-medium underline" : "underline-offset-4 hover:underline"}
        >
          Organization roles
        </Link>
        <span aria-hidden className="text-muted-foreground">/</span>
        <Link
          href="/dashboard/admin/permissions/roles?scope=platform"
          className={scope === "platform" ? "font-medium underline" : "underline-offset-4 hover:underline"}
        >
          Staff roles
        </Link>
      </div>

      <div className="space-y-2">
        <form className="flex gap-2">
          <input type="hidden" name="scope" value={scope} />
          <input className="w-full rounded border bg-background px-3 py-2" name="q" defaultValue={q} placeholder="Search roles..." />
          <button className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground" type="submit">Search</button>
        </form>
      </div>

      <form action={`/api/admin/rbac/roles?scope=${scope}`} method="POST" className="grid gap-2 md:max-w-xl rounded border p-4">
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
    </DashboardPage>
  );
}
