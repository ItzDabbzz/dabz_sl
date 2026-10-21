import { headers } from "next/headers";
import { requirePermission } from "@/server/auth/guards";
import Link from "next/link";
import { DashboardPage } from "@/features/dashboard/components/page";
import SeedRbacCard from "./SeedRbacCard";

export default async function PermissionsHomePage() {
  try {
    await requirePermission("rbac.manage", await headers());
  } catch {
    return <div className="p-6 text-sm text-red-500">You do not have access.</div>;
  }
  return (
    <DashboardPage
      title="Permissions"
      description="Two separate things: the powers staff hold over the site, and the powers a creator team holds over itself."
      crumbs={[
        { label: "Console", href: "/dashboard" },
        { label: "Admin" },
        { label: "Permissions" },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/dashboard/admin/permissions/roles?scope=platform"
          className="rounded border p-4 hover:bg-muted/40 transition-colors"
        >
          <div className="font-semibold">Staff roles</div>
          <div className="text-sm text-muted-foreground">
            The powers of the people who run the site. A staff role belongs to
            the platform, not to a team.
          </div>
        </Link>
        <Link
          href="/dashboard/admin/permissions/roles"
          className="rounded border p-4 hover:bg-muted/40 transition-colors"
        >
          <div className="font-semibold">Organization roles</div>
          <div className="text-sm text-muted-foreground">
            The powers a creator team holds over its own members, for the
            organization you are acting as.
          </div>
        </Link>
        <Link
          href="/dashboard/admin/permissions/overrides"
          className="rounded border p-4 hover:bg-muted/40 transition-colors"
        >
          <div className="font-semibold">User Overrides</div>
          <div className="text-sm text-muted-foreground">
            Allow or deny specific permissions for one user.
          </div>
        </Link>
      </div>

      <div>
        <SeedRbacCard />
      </div>
    </DashboardPage>
  );
}
