import Link from "next/link";
import CategoriesEditor from "./components/CategoriesEditor";
import { getOptionalSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const session = await getOptionalSession();
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
      ) : (
        <div className="rounded-lg border p-4 space-y-4">
          <CategoriesEditor />
        </div>
      )}
    </div>
  );
}
