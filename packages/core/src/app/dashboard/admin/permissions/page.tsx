import { headers } from "next/headers";
import { requirePermission } from "@/lib/guards";
import Link from "next/link";
import SeedRbacCard from "./SeedRbacCard";

export default async function PermissionsHomePage() {
  try {
    await requirePermission("rbac.manage", await headers());
  } catch {
    return <div className="p-6 text-sm text-red-500">You do not have access.</div>;
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Permissions</h1>
      <p className="text-sm text-muted-foreground">Manage roles, grants, and user overrides for this organization.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/admin/permissions/roles" className="rounded border p-4 hover:bg-muted/40 transition-colors">
          <div className="font-semibold">Roles</div>
          <div className="text-sm text-muted-foreground">Create roles, grant permissions, and assign members.</div>
        </Link>
        <Link href="/dashboard/admin/permissions/overrides" className="rounded border p-4 hover:bg-muted/40 transition-colors">
          <div className="font-semibold">User Overrides</div>
          <div className="text-sm text-muted-foreground">Allow or deny specific permissions for a user.</div>
        </Link>
      </div>

      <div>
        <SeedRbacCard />
      </div>
    </div>
  );
}
