import { Suspense } from "react";
import ClientExplorer from "./ClientExplorer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getSession() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session;
  } catch (e) {
    return null;
  }
}

export default async function MarketplacePublicPage() {
  const session = await getSession();
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

      {/* Floating minimal user header */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs shadow backdrop-blur">
          {session && (session as any).user ? (
            <>
              <span className="hidden sm:inline text-muted-foreground">
                Signed in as
              </span>
              <span className="font-medium">
                {(session as any).user.name ||
                  (session as any).user.email ||
                  "User"}
              </span>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <LogoutButton size="sm" variant="outline" label="Logout" />
            </>
          ) : (
            <>
              <span className="hidden sm:inline text-muted-foreground">
                You are not signed in
              </span>
              <Button asChild size="sm" variant="outline">
                <Link href="/sign-in?callbackUrl=%2Fmarketplace">Sign in</Link>
              </Button>
              <LogoutButton size="sm" variant="outline" label="Logout" />
            </>
          )}
        </div>
      </div>

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
