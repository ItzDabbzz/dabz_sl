import { headers } from "next/headers";
import { requirePermission } from "@/lib/guards";

async function fetchOverrides(userId: string) {
  const url = `/api/admin/rbac/overrides?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load overrides");
  return (await res.json()).overrides as Array<{ id: string; permissionKey: string; effect: string }>;
}

export default async function OverridesPage({ searchParams }: { searchParams: { userId?: string } }) {
  try { await requirePermission("rbac.manage", await headers()); } catch { return <div className="p-6 text-sm text-red-500">You do not have access.</div>; }
  const userId = searchParams?.userId || "";
  const overrides = userId ? await fetchOverrides(userId) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Overrides</h1>
      </div>
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
    </div>
  );
}
