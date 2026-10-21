import Link from "next/link";
import Importer from "./components/Importer";
import Scraper from "./components/Scraper";
import { DashboardPage } from "@/features/dashboard/components/page";
import { StaffOnly } from "@/features/dashboard/components/staff-only";

export const dynamic = "force-dynamic";

export default async function MarketplaceScrapePage() {
  return (
    <DashboardPage
      title="Scrape & Import"
      description="Run scrapes and import JSON data for your marketplace items."
      actions={
        <Link href="/dashboard/tools/marketplace/explorer" className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted">
          Back to Explorer
        </Link>
      }
      crumbs={[
        { label: "Console", href: "/dashboard" },
        { label: "Marketplace" },
        { label: "Scrape & Import" },
      ]}
    >
      <StaffOnly
        deniedDescription="Scraping and importing the catalogue is for staff."
      >
        <Importer />
        <div className="rounded-lg border p-4 space-y-4">
          <h2 className="font-semibold">Scrape</h2>
          <Scraper />
        </div>
      </StaffOnly>
    </DashboardPage>
  );
}
