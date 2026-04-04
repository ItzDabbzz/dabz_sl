"use client";

import Link from "next/link";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/client";

export function HomeAccountPill() {
  const { data: session, isPending } = useSession();
  const user = session?.user;

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs shadow backdrop-blur">
      {user ? (
        <>
          <span className="hidden text-muted-foreground sm:inline">Signed in as</span>
          <span className="font-medium">{user.name || user.email || "User"}</span>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <LogoutButton size="sm" variant="outline" label="Sign out" />
        </>
      ) : (
        <>
          <span className="hidden text-muted-foreground sm:inline">
            {isPending ? "Checking session" : "You are not signed in"}
          </span>
          <Button asChild size="sm" variant="outline">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </>
      )}
    </div>
  );
}

export default HomeAccountPill;
