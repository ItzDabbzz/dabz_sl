

import { Suspense } from "react";
import { SignInButton, SignInFallback } from "@/components/sign-in-btn";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";


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
	<div className={ "relative min-h-screen w-full flex items-center justify-center overflow-hidden"}>
	  <main className="flex flex-col items-center justify-center gap-8 w-full px-4  overflow-hidden">
		<h1 className="font-extrabold text-4xl md:text-6xl text-foreground drop-shadow-lg text-center select-none tracking-tight">
		  DABZ's SL Tools
		</h1>
		<p className="text-base md:text-lg text-muted-foreground text-center max-w-xl">
		  A collection of Second Life tools by Dabz. Login or register to get started.
		</p>
		{/* Floating card for auth/session actions */}
		<div className="relative mt-6 flex flex-col items-center  overflow-hidden">
		  <div className={cn(
			"bg-card shadow-xl rounded-2xl px-8 py-6 flex flex-col items-center gap-4 backdrop-blur-md border border-border",
			"w-[90vw] max-w-md"
		  )}>
			<Suspense fallback={<SignInFallback />}>
			  {session && session.user ? (
				<>
				  <div className="flex flex-col items-center gap-2">
					<span className="text-foreground font-medium text-base">
					  Welcome, {session.user.name || session.user.email || "User"}!
					</span>
					<span className="text-xs text-muted-foreground">Active session</span>
				  </div>
				  <div className="flex gap-3 mt-2">
					<Link
					  href="/dashboard"
					  className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 font-semibold shadow-sm transition"
					>
					  Dashboard
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
	  </main>
	</div>
  );
}
