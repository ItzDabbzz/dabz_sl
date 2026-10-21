import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { getActiveOrgId, requirePermission } from "@/server/auth/guards";
import { rbacUserPermissionOverrides } from "@/schemas/rbac";
import { and, asc, eq } from "drizzle-orm";
import { DashboardPage } from "@/features/dashboard/components/page";

async function fetchOverrides(organizationId: string, userId: string) {
  return db
    .select()
    .from(rbacUserPermissionOverrides)
    .where(
      and(
        eq(rbacUserPermissionOverrides.organizationId as any, organizationId as any) as any,
        eq(rbacUserPermissionOverrides.userId as any, userId as any) as any,
      ) as any,
    )
    .orderBy(asc(rbacUserPermissionOverrides.permissionKey));
}

export default async function OverridesPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const requestHeaders = await headers();
  try { await requirePermission("rbac.manage", requestHeaders); } catch { return <div className="p-6 text-sm text-red-500">You do not have access.</div>; }
  const organizationId = (await getActiveOrgId(requestHeaders)) || "";
  const params = await searchParams;
  const userId = params?.userId || "";
  const overrides = userId ? await fetchOverrides(organizationId, userId) : [];

  return (
    <DashboardPage
      title="User Overrides"
      crumbs={[
        { label: "Console", href: "/dashboard" },
        { label: "Admin" },
        { label: "User Overrides" },
      ]}
    >
      <form className="flex gap-2">
        <input className="w-full rounded border bg-background px-3 py-2" name="userId" defaultValue={userId} placeholder="User ID" />
        <button className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground" type="submit">Load</button>
      </form>
      {userId && (
        <div className="rounded border divide-y">
          {overrides.map((o) => (
            <div key={o.id} className="flex items-center justify-between p-3">
              <div className="text-sm">{o.permissionKey} — {o.effect}</div>
              <form action={`/api/admin/rbac/overrides?userId=${encodeURIComponent(userId)}&permissionKey=${encodeURIComponent(o.permissionKey)}`} method="POST" suppressHydrationWarning>
                <input type="hidden" name="_method" value="DELETE" />
                <button formMethod="DELETE" className="text-xs underline text-red-500">Remove</button>
              </form>
            </div>
          ))}
          {overrides.length === 0 && <div className="p-6 text-sm text-muted-foreground">No overrides.</div>}
        </div>
      )}
      <form action="/api/admin/rbac/overrides" method="POST" className="grid gap-2 md:max-w-md">
        <input type="hidden" name="userId" value={userId} />
        <input className="rounded border bg-background px-3 py-2" name="permissionKey" placeholder="permission key" />
        <select name="effect" className="rounded border bg-background px-3 py-2">
          <option value="allow">allow</option>
          <option value="deny">deny</option>
        </select>
        <button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground" type="submit">Add override</button>
      </form>
    </DashboardPage>
  );
}
