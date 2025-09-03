"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type TocItem = { id: string; text: string; level: number };

function scrollToId(targetId: string) {
    const id = decodeURIComponent(targetId.replace(/^#/, ""));
    const offset = 112; // ~scroll-mt-28 (7rem)
    const start = performance.now();
    const timeoutMs = 1500;
    const tick = () => {
        const el = document.getElementById(id);
        if (el) {
            const y = el.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top: y, behavior: "smooth" });
            const url = new URL(window.location.href);
            url.hash = `#${id}`;
            history.replaceState(null, "", url.toString());
            return;
        }
        if (performance.now() - start < timeoutMs) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

export function TableOfContents({ items }: { items: TocItem[] }) {
    const [active, setActive] = useState<string | null>(null);

    const ids = useMemo(() => items.map((i) => i.id), [items]);

    useEffect(() => {
        if (!ids.length) return;
        const observer = new IntersectionObserver(
            (entries) => {
                // pick the entry nearest to the top
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort(
                        (a, b) =>
                            a.boundingClientRect.top - b.boundingClientRect.top,
                    );
                if (visible.length) setActive(visible[0].target.id);
            },
            { rootMargin: "-20% 0px -70% 0px", threshold: [0, 1] },
        );
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [ids]);

    // Handle initial hash navigation after headings render
    useEffect(() => {
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        if (hash) {
            // attempt to scroll once content is available
            scrollToId(hash);
        }
    }, [ids]);

    if (!items.length) return null;

    return (
        <nav aria-label="Table of contents">
            <div className="mb-2 text-sm font-medium text-muted-foreground">
                On this page
            </div>
            <ul className="space-y-1 text-sm">
                {items.map((it) => (
                    <li
                        key={it.id}
                        className={cn(
                            it.level === 2
                                ? "ml-0"
                                : it.level === 3
                                  ? "ml-3"
                                  : "ml-6",
                        )}
                    >
                        <a
                            href={`#${it.id}`}
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToId(it.id);
                            }}
                            className={cn(
                                "line-clamp-2 transition-colors hover:text-foreground",
                                active === it.id
                                    ? "text-foreground"
                                    : "text-muted-foreground",
                            )}
                        >
                            {it.text}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
