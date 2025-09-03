import { Suspense } from "react";
import ClientExplorer from "./ClientExplorer";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MarketplacePublicPage() {
  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col">
      <div className="mb-6">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 bg-clip-text text-transparent">
              Marketplace Explorer
            </span>
          </h1>
          <p className="text-muted-foreground text-base md:text-xlg">
            Search and filter public items scraped from Second Life Marketplace. These items are suggested out of the hundreds of thousands of items available.
          </p>
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
