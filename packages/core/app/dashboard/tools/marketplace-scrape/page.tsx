import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import Link from "next/link";
import Importer from "../marketplace/Importer";
import Scraper from "../marketplace/Scraper";

export const dynamic = "force-dynamic";

async function getSession() {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch {
    return null;
  }
}

export default async function MarketplaceScrapePage() {
  const session = await getSession();
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
        <Link href="/dashboard/tools/marketplace" className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted">
          Back to Marketplace
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
