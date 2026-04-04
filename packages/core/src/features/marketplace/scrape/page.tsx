import Link from "next/link";
import Importer from "./components/Importer";
import Scraper from "./components/Scraper";
import { getOptionalSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function MarketplaceScrapePage() {
  const session = await getOptionalSession();
  if (!session?.user) {
    return (
      <div className="space-y-8">
        <div className="rounded-lg border p-6">
          <p className="mb-3 text-sm text-muted-foreground">You need to sign in to use this page.</p>
          <Link href="/" className="text-sm underline">Go to home to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scrape & Import</h1>
          <p className="text-muted-foreground">Run scrapes and import JSON data for your marketplace items.</p>
        </div>
        <Link href="/dashboard/tools/marketplace/explorer" className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted">
          Back to Explorer
        </Link>
      </div>

      <Importer />
      <div className="rounded-lg border p-4 space-y-4">
        <h2 className="font-semibold">Scrape</h2>
        <Scraper />
      </div>
    </div>
  );
}
