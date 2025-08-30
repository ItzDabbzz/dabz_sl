"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./logo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function Wrapper(props: { children: React.ReactNode }) {
	return (
    <div
      className={cn(
        "min-h-screen w-full flex justify-center relative",
        "bg-background",
        "bg-grid-small-white/[0.2]"
      )}
    >
      {/* Header */}
<header
  className={cn(
    "absolute top-0 z-50 w-full lg:w-10/12",
    "bg-sidebar border-b border-border rounded-2xl"
  )}
>
  <div className="flex items-center justify-between px-6 md:px-4 py-2">
    <Link href="/" className="flex items-center gap-2">
      <p className="text-black dark:text-white font-medium">
        DABZ&apos;s SL Tools
      </p>
    </Link>
    <ThemeToggle />
  </div>
</header>

      {/* Main content */}
      <main className="mt-20 w-full lg:w-7/12">{props.children}</main>
    </div>
	);
}

const queryClient = new QueryClient();

export function WrapperWithQuery(props: { children: React.ReactNode | any }) {
	return (
		<QueryClientProvider client={queryClient}>
			{props.children}
		</QueryClientProvider>
	);
}
