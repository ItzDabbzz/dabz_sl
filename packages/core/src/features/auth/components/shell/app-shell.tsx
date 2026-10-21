"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useSession } from "@/features/auth/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import {
    LayoutDashboard,
    Boxes,
    Webhook,
    PanelLeftClose,
    PanelLeftOpen,
    ChevronDown,
    ShoppingBag,
    ShieldCheck,
    FileText,
    User,
    Home,
    ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import WebBG from "@/components/web-bg";
import { useCan } from "@/features/auth/permissions/client";
import { isStaffUser } from "@/features/auth/permissions/staff";
import { cn } from "@/lib/utils";

/**
 * The GitHub mark.
 *
 * lucide dropped brand icons in v1, so the one brand icon the console
 * needs is inlined rather than swapped for something that means something
 * else.
 */
function GithubMark({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className={className}
        >
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
    );
}

function useLocalStorageBoolean(key: string, initial: boolean) {
    const [value, setValue] = useState(initial);
    useEffect(() => {
        try {
            const raw = localStorage.getItem(key);
            if (raw != null) setValue(raw === "1");
        } catch {}
    }, [key]);
    useEffect(() => {
        try {
            localStorage.setItem(key, value ? "1" : "0");
        } catch {}
    }, [key, value]);
    return [value, setValue] as const;
}

/** A destination inside a group. */
export type NavItem = { href: string; title: string };

/**
 * A group of destinations.
 *
 * The console used to list every destination flat under six stacked
 * sections - nineteen links with no shape. A group carries an icon and its
 * own children, so the navigation reads as six places rather than nineteen.
 */
export type NavGroup = {
    id: string;
    title: string;
    icon: LucideIcon;
    items: ReadonlyArray<NavItem>;
};

const navGroups: ReadonlyArray<NavGroup> = [
    {
        id: "overview",
        title: "Overview",
        icon: LayoutDashboard,
        items: [{ href: "/dashboard", title: "Dashboard" }],
    },
    {
        id: "sl-db",
        title: "SL Data",
        icon: Boxes,
        items: [
            { href: "/dashboard/database/objects", title: "Master Objects" },
            { href: "/dashboard/database/instances", title: "Instances" },
            { href: "/dashboard/database/configs", title: "Configs" },
            { href: "/dashboard/database/entitlements", title: "Entitlements" },
        ],
    },
    {
        id: "sl-tools",
        title: "Marketplace",
        icon: ShoppingBag,
        items: [
            { href: "/dashboard/tools/marketplace/explorer", title: "Explorer" },
            { href: "/dashboard/tools/marketplace/new", title: "New Item" },
            { href: "/dashboard/tools/marketplace/requests", title: "Requests" },
            { href: "/dashboard/tools/marketplace/categories", title: "Categories" },
            { href: "/dashboard/tools/marketplace-scrape", title: "Scrape & Import" },
        ],
    },
    {
        id: "content",
        title: "Content",
        icon: FileText,
        items: [
            { href: "/dashboard/profile", title: "Public Page" },
            { href: "/dashboard/blog", title: "Blog Overview" },
            { href: "/dashboard/blog/manage", title: "Blog Posts" },
            { href: "/dashboard/blog/new", title: "New Post" },
            { href: "/dashboard/blog/categories", title: "Categories" },
            { href: "/dashboard/blog/settings", title: "Blog Settings" },
        ],
    },
    {
        id: "integrations",
        title: "Integrations",
        icon: Webhook,
        items: [
            { href: "/dashboard/apikeys", title: "API Keys" },
            { href: "/dashboard/webhooks", title: "Webhooks" },
            { href: "/api-docs", title: "API Docs" },
        ],
    },
];

/** Is a path the current location of an item? */
function isActivePath(pathname: string | null, href: string) {
    if (!pathname) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [collapsed, setCollapsed] = useLocalStorageBoolean(
        "sidebar:collapsed",
        false,
    );
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const initials = useMemo(() => {
        const n =
            (session as any)?.user?.name ||
            (session as any)?.user?.email ||
            "U";
        return String(n).trim().slice(0, 1).toUpperCase();
    }, [session]);
    const contentRef = useRef<HTMLDivElement>(null);

    const role = (session as any)?.user?.role ?? "user";
    const blogSettingsAllowed = useCan("blog.settings.update");
    // One definition of staff, shared with the API guards - if the page
    // and the API disagree about who is staff, the page can hide what the
    // API still allows.
    const isStaff = useMemo(
        () => isStaffUser((session as any)?.user),
        [session],
    );
    const isSuperAdmin = isStaff;
    const isMarketplacePrivileged = isStaff;
    /**
     * The admin screens are for the roles that can actually manage
     * permissions. Being staff for the marketplace is not the same thing
     * - a moderator may run the catalogue without reaching the admin
     * area, where they would only be turned away.
     */
    const isAdmin = useMemo(
        () =>
            isStaff &&
            new Set(["owner", "developer", "admin"]).has(
                (session as any)?.user?.role ?? "",
            ),
        [isStaff, session],
    );

    // The groups the current user may actually see.
    const groups: NavGroup[] = useMemo(() => {
        const base: NavGroup[] = navGroups.map((group) => ({ ...group }));
        if (isAdmin) {
            base.push({
                id: "staff",
                title: "Staff",
                icon: ShieldCheck,
                items: [
                    { href: "/dashboard/admin", title: "Admin" },
                    { href: "/dashboard/admin/permissions", title: "Permissions" },
                    { href: "/dashboard/admin/claims", title: "Creator claims" },
                ],
            });
        }
        // Hide Blog Settings unless allowed
        const contentIdx = base.findIndex((g) => g.id === "content");
        if (contentIdx >= 0) {
            const g = base[contentIdx];
            base[contentIdx] = {
                ...g,
                items: g.items.filter(
                    (i) =>
                        i.href !== "/dashboard/blog/settings" || blogSettingsAllowed,
                ),
            };
        }
        const toolsIdx = base.findIndex((g) => g.id === "sl-tools");
        if (toolsIdx >= 0 && !isMarketplacePrivileged) {
            // The whole marketplace toolset is staff work, so a creator
            // sees none of it rather than half of it.
            base[toolsIdx] = {
                ...base[toolsIdx],
                items: base[toolsIdx].items.filter(
                    (i) => !i.href.startsWith("/dashboard/tools/marketplace"),
                ),
            };
        }
        return base;
    }, [isAdmin, isStaff, isSuperAdmin, isMarketplacePrivileged, blogSettingsAllowed]);

    /**
     * A group is open unless the shopper folded it away.
     *
     * The console used to show every destination at once, and that is what
     * made it feel cluttered - but hiding all of them behind five rows is
     * worse. The groups stay open; what changed is that the destinations are
     * now nested under a named place instead of floating in a flat list.
     */
    const isGroupOpen = (
        group: NavGroup,
        overrides: Record<string, boolean> = openGroups,
    ) => {
        if (overrides[group.id] !== undefined) return overrides[group.id];
        return true;
    };

    const toggleGroup = (group: NavGroup) =>
        setOpenGroups((prev) => ({
            ...prev,
            [group.id]: !isGroupOpen(group, prev),
        }));

    return (
        <div className="relative h-dvh flex bg-background text-foreground">
            <WebBG className="absolute inset-0 z-1" opacity={0.28} />
            {/* Sidebar */}
            <aside
                className={cn(
                    "z-20 h-dvh sticky top-0 shrink-0 border-r border-border flex flex-col transition-[width] duration-200 overflow-hidden bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70",
                    collapsed ? "w-14" : "w-64",
                )}
            >
                <div className="flex h-14 items-center gap-2 border-b border-border px-3">
                    <button
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
                        onClick={() => setCollapsed((v) => !v)}
                        aria-label={
                            collapsed ? "Expand sidebar" : "Collapse sidebar"
                        }
                    >
                        {collapsed ? (
                            <PanelLeftOpen className="h-4 w-4" />
                        ) : (
                            <PanelLeftClose className="h-4 w-4" />
                        )}
                    </button>
                    {!collapsed && (
                        <Link
                            href="/dashboard"
                            className="inline-flex min-w-0 items-center gap-2"
                        >
                            <Logo className="h-5 w-5 shrink-0" />
                            <span className="truncate text-sm font-semibold">
                                Creator Console
                            </span>
                        </Link>
                    )}
                    {!collapsed && (
                        <Link
                            href="/"
                            className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Back to site"
                            aria-label="Back to site"
                        >
                            <Home className="h-4 w-4" />
                        </Link>
                    )}
                </div>
                <nav className="flex-1 overflow-y-auto px-2 py-3">
                    {!collapsed ? (
                        <ul className="space-y-1">
                            {groups.map((group) => {
                                const open = isGroupOpen(group);
                                const Icon = group.icon;
                                const groupActive = group.items.some((item) =>
                                    isActivePath(pathname, item.href),
                                );
                                return (
                                    <li key={group.id}>
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(group)}
                                            aria-expanded={open}
                                            aria-controls={`nav-${group.id}`}
                                            className={cn(
                                                "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                                                groupActive
                                                    ? "text-foreground"
                                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                            )}
                                        >
                                            <Icon className="h-4 w-4 shrink-0" />
                                            <span className="font-medium">
                                                {group.title}
                                            </span>
                                            <ChevronDown
                                                className={cn(
                                                    "ml-auto h-3.5 w-3.5 transition-transform",
                                                    open ? "rotate-180" : "",
                                                )}
                                                aria-hidden="true"
                                            />
                                        </button>
                                        {open && (
                                            <ul
                                                id={`nav-${group.id}`}
                                                className="ml-4 mt-0.5 space-y-0.5 border-l border-border/70 pl-2"
                                            >
                                                {group.items.map((item) => {
                                                    const active = isActivePath(
                                                        pathname,
                                                        item.href,
                                                    );
                                                    return (
                                                        <li key={item.href}>
                                                            <Link
                                                                href={item.href}
                                                                aria-current={
                                                                    active
                                                                        ? "page"
                                                                        : undefined
                                                                }
                                                                className={cn(
                                                                    "block rounded-md px-2 py-1.5 text-sm transition-colors",
                                                                    active
                                                                        ? // The theme's primary is a deep red - too dark
                                                                          // for text on a dark background, so the
                                                                          // current page is marked with an accent
                                                                          // bar and a tinted row instead.
                                                                          "bg-primary/15 font-medium text-foreground shadow-[inset_2px_0_0_0_var(--primary)]"
                                                                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                                                )}
                                                            >
                                                                <span className="truncate">
                                                                    {item.title}
                                                                </span>
                                                            </Link>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        // Collapsed: one icon per group, opening the group.
                        <ul className="space-y-1">
                            {groups.map((group) => {
                                const Icon = group.icon;
                                const groupActive = group.items.some((item) =>
                                    isActivePath(pathname, item.href),
                                );
                                return (
                                    <li key={group.id}>
                                        <button
                                            type="button"
                                            title={group.title}
                                            aria-label={group.title}
                                            onClick={() => {
                                                setCollapsed(false);
                                                setOpenGroups((prev) => ({
                                                    ...prev,
                                                    [group.id]: true,
                                                }));
                                            }}
                                            className={cn(
                                                "flex h-9 w-full items-center justify-center rounded-md transition-colors",
                                                groupActive
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </nav>
                {/* Footer */}
                <div className="border-t border-border/60 px-2 py-2">
                    <div className="flex items-center gap-1.5">
                        <Link
                            href="/dashboard/userprofile"
                            className="group flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 hover:bg-muted/60 transition-colors"
                            title="Account"
                        >
                            <Avatar className="h-7 w-7 shrink-0 ring-1 ring-border group-hover:ring-foreground/20 transition-shadow">
                                <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            {!collapsed && (
                                <span className="min-w-0 truncate text-sm">
                                    {(session as any)?.user?.name ||
                                        (session as any)?.user?.email ||
                                        "User"}
                                </span>
                            )}
                        </Link>
                        {!collapsed && (
                            <a
                                href="https://itzdabbzz.me"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="itzdabbzz.me"
                                aria-label="itzdabbzz.me"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        )}
                        {!collapsed && (
                            <a
                                href="https://github.com/itzdabbzz/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="GitHub"
                                aria-label="GitHub"
                            >
                                <GithubMark className="h-3.5 w-3.5" />
                            </a>
                        )}
                        <div className="ml-auto shrink-0 rounded-md">
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="relative z-10 flex-1 min-w-0">
                <ScrollArea ref={contentRef as any} className="h-dvh">
                    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
                        {children}
                    </div>
                </ScrollArea>
            </main>
            <Analytics />
            <SpeedInsights />
        </div>
    );
}
