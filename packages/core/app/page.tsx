import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { SignInButton, SignInFallback } from "@/components/sign-in-btn";

// Real session fetcher (returns null if not logged in)
async function getSession() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session;
  } catch (e) {
    return null;
  }
}

export default async function Home() {
  const session = await getSession();
  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-gradient-to-b from-background via-background to-background">
      {/* Animated aurora / gradient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[40rem] w-[40rem] rounded-full bg-primary/20 blur-3xl opacity-40 animate-pulse" />
        <div className="absolute -bottom-40 right-0 h-[32rem] w-[32rem] rounded-full bg-secondary/20 blur-3xl opacity-40 animate-[pulse_10s_ease-in-out_infinite]" />
      </div>

      <main className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col items-center justify-center gap-10 px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Live demo
        </span>

        <h1 className="text-balance font-extrabold tracking-tight text-4xl sm:text-6xl md:text-7xl">
          Tools for your Second Life
        </h1>
        <p className="text-balance max-w-2xl text-base sm:text-lg text-muted-foreground">
          A sleek suite of utilities crafted by Dabz. Authenticate to explore dashboards, manage objects, webhooks, API keys, and more.
        </p>

        <div className="relative mt-2">
          <div className={cn(
            "bg-card/70 backdrop-blur-xl border border-border/60 shadow-2xl",
            "rounded-2xl px-6 py-5 sm:px-8 sm:py-6 flex flex-col items-center gap-3 w-[90vw] max-w-md"
          )}>
            <Suspense fallback={<SignInFallback />}>
              {session && (session as any).user ? (
                <>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">Signed in as</span>
                    <span className="text-lg font-semibold">
                      {(session as any).user.name || (session as any).user.email || "User"}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-3">
                    <Link
                      href="/dashboard"
                      className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground shadow hover:bg-primary/90 transition"
                    >
                      Open Dashboard
                    </Link>
                    <Link
                      href="/api-docs"
                      className="rounded-lg border border-border px-4 py-2 font-semibold hover:bg-muted/50 transition"
                    >
                      API Docs
                    </Link>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <SignInButton />
                  <span className="text-xs text-muted-foreground">Login or register to continue</span>
                </div>
              )}
            </Suspense>
          </div>
        </div>

        {/* Feature bullets */}
        <ul className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          {["Master Objects", "Instances", "API Keys"].map((t) => (
            <li key={t} className="rounded-xl border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground backdrop-blur hover:bg-muted/30 transition">
              {t}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
