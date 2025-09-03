"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSession } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayoutDashboard, Boxes, Server, FileDiff, BadgeCheck, KeyRound, Webhook, Settings, PanelLeftClose, PanelLeftOpen, ChevronDown, ShoppingBag } from "lucide-react";
import { Logo } from "@/components/logo";

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

// Sidebar groups with items
const navSections = [
  {
    id: "overview",
    title: "Overview",
    items: [{ href: "/dashboard", title: "Overview", icon: LayoutDashboard }],
  },
  {
    id: "sl-db",
    title: "Second Life Database",
    items: [
      { href: "/dashboard/objects", title: "Master Objects", icon: Boxes },
      { href: "/dashboard/instances", title: "Instances", icon: Server },
      { href: "/dashboard/configs", title: "Configs", icon: FileDiff },
      { href: "/dashboard/entitlements", title: "Entitlements", icon: BadgeCheck },
    ],
  },
  {
    id: "sl-tools",
    title: "Second Life Tools",
    items: [
      { href: "/dashboard/tools/marketplace", title: "Marketplace", icon: ShoppingBag },
      { href: "/dashboard/tools/marketplace-scrape", title: "Scrape & Import", icon: Server },
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    items: [
      { href: "/dashboard/apikeys", title: "API Keys", icon: KeyRound },
      { href: "/dashboard/webhooks", title: "Webhooks", icon: Webhook },
      { href: "/api-docs", title: "API Docs", icon: FileDiff },
    ],
  },
] as const;

type Section = (typeof navSections)[number];

function CollapsibleSection({ section, collapsed, pathname }: { section: Section; collapsed: boolean; pathname: string | null; }) {
  const [open, setOpen] = useLocalStorageBoolean(`sidebar:group:${section.id}`, true);
  // When the whole sidebar is collapsed, just don't render the section header; items are shown in flattened view outside.
  if (collapsed) return null;
  return (
    <div className="px-2">
      <button
        className="w-full flex items-center justify-between gap-2 px-2 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`group-${section.id}`}
      >
        <span className="font-medium">{section.title}</span>
        <ChevronDown className={"h-4 w-4 transition-transform " + (open ? "rotate-180" : "rotate-0")} />
      </button>
      {open && (
        <ul id={`group-${section.id}`} className="mb-2 space-y-1">
          {section.items.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors " +
                    (active ? "bg-muted font-medium" : "hover:bg-muted/50")
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useLocalStorageBoolean("sidebar:collapsed", false);
  const initials = useMemo(() => {
    const n = (session as any)?.user?.name || (session as any)?.user?.email || "U";
    return String(n).trim().slice(0, 1).toUpperCase();
  }, [session]);
  const contentRef = useRef<HTMLDivElement>(null);

  // Flattened items for collapsed sidebar
  const flatItems = useMemo(() => navSections.flatMap((s) => s.items), []);

  return (
    <div className="h-dvh flex bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={
          (collapsed ? "w-16" : "w-64") +
          " h-dvh sticky top-0 shrink-0 border-r border-border flex flex-col transition-[width] duration-200 overflow-hidden"
        }
      >
        <div className="h-14 flex items-center gap-2 px-3 border-b border-border">
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          {!collapsed && (
            <Link href="/dashboard" className="inline-flex items-center gap-2">
              <Logo className="h-5 w-5" />
              <span className="text-sm font-semibold">Creator Console</span>
            </Link>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {/* Expanded: grouped & collapsible */}
          {!collapsed && (
            <div className="space-y-2">
              {navSections.map((section) => (
                <CollapsibleSection key={section.id} section={section} collapsed={collapsed} pathname={pathname} />
              ))}
            </div>
          )}
          {/* Collapsed: flattened icon-only nav */}
          {collapsed && (
            <ul className="px-2 space-y-1">
              {flatItems.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={
                        "flex items-center justify-center rounded-md p-2 text-sm transition-colors " +
                        (active ? "bg-muted font-medium" : "hover:bg-muted/50")
                      }
                      title={item.title}
                    >
                      <Icon className="h-4 w-4" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
        {/* Footer */}
        <div className="mt-auto border-t border-border/60 px-2 py-2">
          <div className="flex items-center gap-2">
            <Link
              href="/userprofile"
              className="group inline-flex items-center gap-2 rounded-full p-1 hover:bg-muted/60 transition-colors"
              title="Account"
            >
              <Avatar className="h-8 w-8 ring-1 ring-border group-hover:ring-foreground/20 transition-shadow">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <span className="max-w-[9rem] truncate text-sm font-medium">
                  {(session as any)?.user?.name || (session as any)?.user?.email || "User"}
                </span>
              )}
            </Link>
            <div className="ml-auto flex items-center gap-1.5">
              <Link
                href="/userprofile"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>
              <div className="rounded-full">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <ScrollArea ref={contentRef as any} className="h-dvh">
          <div className="p-6">{children}</div>
        </ScrollArea>
      </main>
    </div>
  );
}
