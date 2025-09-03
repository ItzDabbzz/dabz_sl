import { Suspense } from "react";
import ClientExplorer from "./ClientExplorer";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MarketplacePublicPage() {
  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50"
        aria-label="Go to home"
      >
        <Link href="/">← Home</Link>
      </Button>

      <div className="px-4">
        <div className="max-w-5xl mx-auto py-4">
          <div className="flex flex-col items-center gap-2 text-center md:flex-row md:justify-center md:text-left md:gap-3">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Marketplace Explorer
            </h1>
            <span className="hidden md:inline-block h-4 w-px bg-border" />
            <p className="text-sm text-muted-foreground max-w-[70ch]">
              Search and filter public items scraped from Second Life Marketplace.
              Suggested picks from hundreds of thousands of items.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <Suspense>
          <ClientExplorer />
        </Suspense>
      </div>
    </div>
  );
}
