"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Store, Users, FileText, Home } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/client";
import { cn } from "@/lib/utils";

/**
 * The bar at the top of a public page.
 *
 * Every public page needs a way back: to the home page, to the
 * marketplace, to the creators and to the blog. Without it, a visitor
 * who follows a link to somebody's page has nowhere to go but back.
 *
 * The bar sits in the flow at the top of the page and sticks when the
 * page is scrolled, so it never covers what is underneath it.
 */
export function PublicHeader({ className }: { className?: string }) {
    const pathname = usePathname();
    const { data: session } = useSession();

    const links = [
        { href: "/", label: "Home", icon: Home },
        { href: "/marketplace", label: "Marketplace", icon: Store },
        { href: "/creators", label: "Creators", icon: Users },
        { href: "/blog", label: "Blog", icon: FileText },
    ];

    return (
        <header
            className={cn(
                "sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70",
                className,
            )}
        >
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
                <Link
                    href="/"
                    aria-label="Sanctum Realms - home"
                    className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    {/**
                        * The seal is a dark, weathered crest, so it needs a
                        * light plate behind it to be seen at all on a dark
                        * bar - like a stamp pressed onto paper.
                        */}
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white p-1 shadow-sm">
                        <Logo
                            width={24}
                            height={24}
                            alt=""
                            className="h-full w-full object-contain"
                        />
                    </span>
                </Link>

                <nav
                    aria-label="Site"
                    className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
                >
                    {links.map((link) => {
                        const current =
                            link.href === "/"
                                ? pathname === "/"
                                : !!pathname &&
                                  pathname.startsWith(link.href);
                        const Icon = link.icon;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                aria-current={current ? "page" : undefined}
                                className={cn(
                                    "inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-sm transition-colors sm:min-h-9 sm:px-3",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                    current
                                        ? "bg-muted font-medium text-foreground"
                                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                )}
                            >
                                <Icon
                                    className="h-4 w-4 shrink-0"
                                    aria-hidden="true"
                                />
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>

                {session?.user ? (
                    <Button
                        asChild
                        size="sm"
                        className="hidden shrink-0 sm:inline-flex"
                    >
                        <Link href="/dashboard">
                            <LayoutDashboard
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                            Console
                        </Link>
                    </Button>
                ) : null}
            </div>
        </header>
    );
}
