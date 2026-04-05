import Link from "next/link";
import CategoriesEditor from "./components/CategoriesEditor";
import { getOptionalSession } from "@/server/auth/session";
import {
  isConfiguredAdminId,
  isPrivilegedMarketplaceRole,
} from "@/server/auth/roles";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const session = await getOptionalSession();
  const role = (session?.user as any)?.role as string | undefined;
  const userId = (session?.user as any)?.id as string | undefined;
  const canManageCategories =
    isPrivilegedMarketplaceRole(role) || isConfiguredAdminId(userId);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketplace Categories</h1>
        <p className="text-muted-foreground">Create and manage categories and subcategories for organizing scraped items.</p>
      </div>

      {!session?.user ? (
        <div className="rounded-lg border p-6">
          <p className="mb-3 text-sm text-muted-foreground">You need to sign in to use this tool.</p>
          <Link href="/" className="text-sm underline">Go to home to sign in</Link>
        </div>
      ) : !canManageCategories ? (
        <div className="rounded-lg border p-6">
          <p className="text-sm text-muted-foreground">You do not have permission to manage marketplace categories.</p>
        </div>
      ) : (
        <div className="rounded-lg border p-4 space-y-4">
          <CategoriesEditor />
        </div>
      )}
    </div>
  );
}
