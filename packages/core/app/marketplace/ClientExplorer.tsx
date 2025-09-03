"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Search,
    X,
    LayoutGrid,
    List as ListIcon,
    Loader2,
    Heart,
    Scale,
    Trash2,
    Link2,
    Home,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

type Item = {
    id: string;
    url: string;
    title: string;
    images?: string[];
    price?: string | null;
    description?: string | null;
    creator?: { name?: string; link?: string } | null;
    store?: string | null;
};

type Category = { id: string; primary: string; sub: string };

type ItemsResp = {
    items: Item[];
    total: number;
    limit: number;
    offset: number;
};

type CatsResp = { items: Category[] };

export default function ClientExplorer() {
    const [q, setQ] = useState("");
    const [sort, setSort] = useState<
        "most" | "least" | "priceAsc" | "priceDesc"
    >("most");
    const [cats, setCats] = useState<Category[]>([]);
    const [primary, setPrimary] = useState<string>("");
    const [sub, setSub] = useState<string>("");
    const [selectedCategoryId, setSelectedCategoryId] = useState<
        string | undefined
    >();

    const [items, setItems] = useState<Item[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(24);
    const [loading, setLoading] = useState(false);

    // New UI/UX state
    const [view, setView] = useState<"grid" | "list">("grid");
    const [scrollMode, setScrollMode] = useState<"pages" | "infinite">("pages");
    const [hasImageOnly, setHasImageOnly] = useState(false);
    const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
    const [compare, setCompare] = useState<Set<string>>(() => new Set());
    const [recent, setRecent] = useState<string[]>([]);
    const { toast } = useToast();
    const [compareOpen, setCompareOpen] = useState(false);
    const [descItem, setDescItem] = useState<Item | null>(null);

    const inputRef = useRef<HTMLInputElement | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Build primary -> sub list map
    const primaryOptions = useMemo(() => {
        const set = new Set(cats.map((c) => c.primary));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [cats]);
    const subOptions = useMemo(() => {
        return cats
            .filter((c) => (primary ? c.primary === primary : true))
            .map((c) => c.sub)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .sort((a, b) => a.localeCompare(b));
    }, [cats, primary]);

    // Derive selected category id
    useEffect(() => {
        if (!primary) {
            setSelectedCategoryId(undefined);
            setSub("");
            return;
        }
        const targetSub = sub || "All";
        const match = cats.find(
            (c) => c.primary === primary && c.sub === targetSub,
        );
        setSelectedCategoryId(match?.id);
    }, [primary, sub, cats]);

    // Load categories once
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/public/marketplace/categories", {
                    cache: "no-store",
                });
                const data: CatsResp = await res.json();
                setCats(data.items || []);
            } catch {}
        })();
    }, []);

    // Load persisted favorites/compare/recent
    useEffect(() => {
        try {
            const f = JSON.parse(
                localStorage.getItem("mp_favorites") || "[]",
            ) as string[];
            setFavorites(new Set(f));
        } catch {}
        try {
            const c = JSON.parse(
                localStorage.getItem("mp_compare") || "[]",
            ) as string[];
            setCompare(new Set(c));
        } catch {}
        try {
            const r = JSON.parse(
                localStorage.getItem("mp_recent_searches") || "[]",
            ) as string[];
            setRecent(Array.isArray(r) ? r.slice(0, 8) : []);
        } catch {}
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(
                "mp_favorites",
                JSON.stringify(Array.from(favorites)),
            );
        } catch {}
    }, [favorites]);
    useEffect(() => {
        try {
            localStorage.setItem(
                "mp_compare",
                JSON.stringify(Array.from(compare)),
            );
        } catch {}
    }, [compare]);

    // Save recent search when q stabilizes
    useEffect(() => {
        const t = setTimeout(() => {
            const term = q.trim();
            if (!term) return;
            setRecent((prev) => {
                const next = [term, ...prev.filter((s) => s !== term)].slice(
                    0,
                    8,
                );
                try {
                    localStorage.setItem(
                        "mp_recent_searches",
                        JSON.stringify(next),
                    );
                } catch {}
                return next;
            });
        }, 600);
        return () => clearTimeout(t);
    }, [q]);

    // URL -> state (after categories load)
    useEffect(() => {
        if (!cats.length) return;
        const qp = new URLSearchParams(searchParams.toString());
        const nq = qp.get("q") || "";
        const ns = (qp.get("sort") as any) || "most";
        const nl = parseInt(qp.get("limit") || "24", 10);
        const np = qp.get("primary") || "";
        const nsub = qp.get("sub") || "";
        setQ(nq);
        setSort(
            ["most", "least", "priceAsc", "priceDesc"].includes(ns)
                ? (ns as any)
                : "most",
        );
        if (!Number.isNaN(nl)) setLimit(nl);
        setPrimary(np);
        setSub(nsub);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cats]);

    // State -> URL
    useEffect(() => {
        const qp = new URLSearchParams();
        if (q.trim()) qp.set("q", q.trim());
        if (sort !== "most") qp.set("sort", sort);
        if (limit !== 24) qp.set("limit", String(limit));
        if (primary) qp.set("primary", primary);
        if (sub) qp.set("sub", sub);
        router.replace(`${pathname}?${qp.toString()}`, { scroll: false });
    }, [q, sort, limit, primary, sub, router, pathname]);

    // Fetch items
    async function fetchItems(options?: {
        reset?: boolean;
        pageIndex?: number;
    }) {
        const { reset = false, pageIndex } = options ?? {};
        if (loading) return;
        setLoading(true);
        try {
            const effectivePage =
                typeof pageIndex === "number" ? pageIndex : page;
            const params = new URLSearchParams();
            if (q.trim()) params.set("q", q.trim());
            if (selectedCategoryId)
                params.set("categoryId", selectedCategoryId);
            if (sort) params.set("sort", sort);
            params.set("limit", String(limit));
            params.set("offset", String(effectivePage * limit));
            const res = await fetch(
                `/api/public/marketplace/items?${params.toString()}`,
                {
                    cache: "no-store",
                },
            );
            const data: ItemsResp = await res.json();
            setTotal(data.total || 0);
            setItems((prev) =>
                reset ? data.items || [] : [...prev, ...(data.items || [])],
            );
            if (typeof pageIndex === "number") setPage(effectivePage);
        } finally {
            setLoading(false);
        }
    }

    // Trigger fetch when filters change (debounced for q)
    useEffect(() => {
        const t = setTimeout(() => {
            fetchItems({ reset: true, pageIndex: 0 });
        }, 250);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, sort, selectedCategoryId, limit]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    function goToPage(p: number) {
        const clamped = Math.max(0, Math.min(totalPages - 1, p));
        setPage(clamped);
        if (scrollMode === "pages") {
            fetchItems({ reset: true, pageIndex: clamped });
        } else {
            fetchItems({ reset: false, pageIndex: clamped });
        }
    }

    // Keyboard shortcuts
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "/") {
                e.preventDefault();
                inputRef.current?.focus();
            }
            if (e.key === "Escape") {
                setQ("");
            }
            if (e.key === "ArrowLeft" && scrollMode === "pages") {
                const next = page - 1;
                if (next >= 0) fetchItems({ reset: true, pageIndex: next });
            }
            if (e.key === "ArrowRight" && scrollMode === "pages") {
                const next = page + 1;
                if (next * limit < total)
                    fetchItems({ reset: true, pageIndex: next });
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [page, limit, total, scrollMode]);

    // Infinite scroll observer
    useEffect(() => {
        if (scrollMode !== "infinite") return;
        const el = sentinelRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && !loading) {
                    const next = page + 1;
                    if (next * limit < total)
                        fetchItems({ reset: false, pageIndex: next });
                }
            },
            { root: null, rootMargin: "200px", threshold: 0 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [scrollMode, page, limit, total, loading]);

    // Derived visible items based on client-side filters
    const visibleItems = useMemo(() => {
        let out = items;
        if (hasImageOnly)
            out = out.filter((it) => (it.images?.[0] ?? "").length > 0);
        if (view === "list") {
            // keep order
        }
        return out;
    }, [items, hasImageOnly, view]);

    // Helpers
    function copy(text: string, msg = "Link copied") {
        try {
            navigator.clipboard.writeText(text);
            toast({ description: msg });
        } catch {
            try {
                const ta = document.createElement("textarea");
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                toast({ description: msg });
            } catch {}
        }
    }
    // Build a compare share URL from current state
    function getCompareShareUrl() {
        try {
            const ids = Array.from(compare);
            const base =
                typeof window !== "undefined" ? window.location.origin : "";
            const qp = new URLSearchParams(searchParams.toString());
            if (ids.length) qp.set("compare", ids.join(","));
            return `${base}${pathname}?${qp.toString()}`;
        } catch {
            return "";
        }
    }

    return (
        <div className="grid grid-rows-[auto_1fr_auto] gap-4 h-[calc(100vh-7rem)] min-h-0">
            {/* Floating Home button (subtle, non-intrusive) */}
            <div className="fixed top-8 sm:top-8 left-4 z-40">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/")}
                    className="bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50 z-100"
                    aria-label="Go home"
                    title="Go home"
                >
                    <Home className="h-4 w-4 mr-2" />
                    Home
                </Button>
            </div>

            {/* Search / Controls */}
            <Card className="border bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40 sticky top-0 z-30">
                <CardContent className="p-3">
                    <div className="mx-auto w-full max-w-5xl">
                        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
                            <div className="relative flex-1 min-w-[260px]">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    ref={inputRef}
                                    placeholder="Search items… (press / to focus)"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    className="pl-9 pr-9"
                                    aria-label="Search items"
                                />
                                {q ? (
                                    <button
                                        type="button"
                                        onClick={() => setQ("")}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                                        aria-label="Clear search"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                ) : null}
                            </div>

                            <div className="flex items-center gap-2 justify-center">
                                <span className="text-xs text-muted-foreground">
                                    Sort
                                </span>
                                <Select
                                    value={sort}
                                    onValueChange={(v: any) => setSort(v)}
                                >
                                    <SelectTrigger className="w-44">
                                        <SelectValue placeholder="Sort" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="most">
                                            Most rated
                                        </SelectItem>
                                        <SelectItem value="least">
                                            Least rated
                                        </SelectItem>
                                        <SelectItem value="priceAsc">
                                            Price: Low → High
                                        </SelectItem>
                                        <SelectItem value="priceDesc">
                                            Price: High → Low
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2 justify-center">
                                <span className="text-xs text-muted-foreground">
                                    Per page
                                </span>
                                <Select
                                    value={String(limit)}
                                    onValueChange={(v) =>
                                        setLimit(parseInt(v, 10))
                                    }
                                >
                                    <SelectTrigger className="w-28">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[12, 24, 36, 48].map((n) => (
                                            <SelectItem
                                                key={n}
                                                value={String(n)}
                                            >
                                                {n}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2 justify-center">
                                <span className="text-xs text-muted-foreground">
                                    Has image
                                </span>
                                <Switch
                                    checked={hasImageOnly}
                                    onCheckedChange={setHasImageOnly}
                                />
                            </div>

                            <div className="flex items-center gap-2 justify-center">
                                <span className="text-xs text-muted-foreground">
                                    View
                                </span>
                                <div className="flex rounded-md border p-1">
                                    <Button
                                        variant={
                                            view === "grid"
                                                ? "secondary"
                                                : "ghost"
                                        }
                                        size="sm"
                                        onClick={() => setView("grid")}
                                    >
                                        <LayoutGrid className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant={
                                            view === "list"
                                                ? "secondary"
                                                : "ghost"
                                        }
                                        size="sm"
                                        onClick={() => setView("list")}
                                    >
                                        <ListIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 justify-center">
                                <span className="text-xs text-muted-foreground">
                                    Scroll
                                </span>
                                <Select
                                    value={scrollMode}
                                    onValueChange={(v: any) => setScrollMode(v)}
                                >
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pages">
                                            Pages
                                        </SelectItem>
                                        <SelectItem value="infinite">
                                            Infinite
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2 justify-center">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setQ("");
                                        setPrimary("");
                                        setSub("");
                                        setPage(0);
                                        setHasImageOnly(false);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-1" /> Reset
                                </Button>
                            </div>
                        </div>

                        {/* Recent searches */}
                        {recent.length > 0 && (
                            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
                                {recent.map((r) => (
                                    <Button
                                        key={r}
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2"
                                        onClick={() => setQ(r)}
                                    >
                                        {r}
                                    </Button>
                                ))}
                            </div>
                        )}

                        {/* Active filter chips */}
                        {(q || primary || sub || hasImageOnly) && (
                            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
                                {q ? (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-7 px-2"
                                        onClick={() => setQ("")}
                                    >
                                        q: {q} <X className="ml-1 h-3 w-3" />
                                    </Button>
                                ) : null}
                                {primary ? (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-7 px-2"
                                        onClick={() => {
                                            setPrimary("");
                                            setSub("");
                                        }}
                                    >
                                        primary: {primary}{" "}
                                        <X className="ml-1 h-3 w-3" />
                                    </Button>
                                ) : null}
                                {sub ? (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-7 px-2"
                                        onClick={() => setSub("")}
                                    >
                                        sub: {sub}{" "}
                                        <X className="ml-1 h-3 w-3" />
                                    </Button>
                                ) : null}
                                {hasImageOnly ? (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-7 px-2"
                                        onClick={() => setHasImageOnly(false)}
                                    >
                                        has image <X className="ml-1 h-3 w-3" />
                                    </Button>
                                ) : null}
                            </div>
                        )}

                        <div className="mt-2 text-center text-xs text-muted-foreground">
                            {total ? (
                                <span>
                                    {new Intl.NumberFormat().format(total)}{" "}
                                    results • Page {page + 1} of{" "}
                                    {Math.max(1, Math.ceil(total / limit))}
                                </span>
                            ) : (
                                <span>Type to search or use filters</span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Content area */}
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 min-h-0">
                {/* Sidebar with its own scroll (unchanged) */}
                <Card className="min-h-0">
                    <CardContent className="p-0 h-full">
                        <ScrollArea className="h-full">
                            <div className="p-3 space-y-3">
                                <div className="text-xs font-medium text-muted-foreground px-1">
                                    Categories
                                </div>
                                <Button
                                    variant={
                                        primary === "" ? "secondary" : "ghost"
                                    }
                                    className="w-full justify-start"
                                    onClick={() => {
                                        setPrimary("");
                                        setSub("");
                                    }}
                                >
                                    All categories
                                </Button>
                                {primaryOptions.map((p) => (
                                    <div key={p} className="space-y-1">
                                        <Button
                                            variant={
                                                primary === p && !sub
                                                    ? "secondary"
                                                    : "ghost"
                                            }
                                            className="w-full justify-start"
                                            onClick={() => {
                                                setPrimary(p);
                                                setSub("");
                                            }}
                                        >
                                            {p}
                                        </Button>
                                        {primary === p && (
                                            <div className="pl-2 space-y-1">
                                                {subOptions.map((s) => (
                                                    <Button
                                                        key={`${p}-${s}`}
                                                        size="sm"
                                                        variant={
                                                            primary === p &&
                                                            sub === s
                                                                ? "secondary"
                                                                : "ghost"
                                                        }
                                                        className="w-full justify-start"
                                                        onClick={() =>
                                                            setSub(s)
                                                        }
                                                    >
                                                        {s}
                                                    </Button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Results scroller */}
                <Card className="min-h-0">
                    <CardContent className="p-4 h-full">
                        <ScrollArea className="h-full">
                            {/* Loading/Empty/Results */}
                            {loading && page === 0 && items.length === 0 ? (
                                <div
                                    className={`grid ${view === "grid" ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"} gap-4 pr-2`}
                                >
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <div key={i} className="animate-pulse">
                                            <div className="aspect-video rounded bg-muted" />
                                            <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
                                            <div className="mt-1 h-3 w-1/3 rounded bg-muted" />
                                        </div>
                                    ))}
                                </div>
                            ) : visibleItems.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                                    No results. Try adjusting your search or
                                    filters.
                                </div>
                            ) : (
                                <div
                                    className={
                                        view === "grid"
                                            ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 pr-2"
                                            : "flex flex-col gap-3 pr-2"
                                    }
                                >
                                    {visibleItems.map((it) => {
                                        const creatorName =
                                            it.creator?.name?.trim();
                                        const creatorLink =
                                            it.creator?.link?.trim();
                                        const storeLink = it.store?.trim();
                                        const showStore =
                                            storeLink &&
                                            storeLink !== creatorLink;
                                        const fav = favorites.has(it.id);
                                        const cmp = compare.has(it.id);
                                        const mediaClass =
                                            view === "list"
                                                ? "h-24 w-40 sm:h-28 sm:w-44"
                                                : "aspect-video";

                                        const Media = (
                                            <div
                                                className={`overflow-hidden rounded bg-muted ${mediaClass}`}
                                            >
                                                {it.images?.[0] && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={it.images[0]}
                                                        alt={it.title}
                                                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                                                    />
                                                )}
                                            </div>
                                        );

                                        const Meta = (
                                            <div
                                                className={
                                                    view === "list"
                                                        ? "space-y-1"
                                                        : "space-y-1 mt-2"
                                                }
                                            >
                                                <div className="flex items-start justify-between gap-3 min-w-0">
                                                    <div
                                                        className="text-sm font-medium truncate"
                                                        title={
                                                            it.title ||
                                                            "Untitled"
                                                        }
                                                    >
                                                        {it.title || "Untitled"}
                                                    </div>
                                                    <div
                                                        className={`shrink-0 ${view === "list" ? "text-sm font-medium" : "text-xs"} text-muted-foreground`}
                                                    >
                                                        L$ {it.price ?? "-"}
                                                    </div>
                                                </div>
                                                {(creatorName ||
                                                    creatorLink ||
                                                    storeLink) && (
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {creatorName ? (
                                                            <>
                                                                by{" "}
                                                                {creatorLink ? (
                                                                    <a
                                                                        className="underline underline-offset-4 hover:no-underline"
                                                                        href={
                                                                            creatorLink
                                                                        }
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                    >
                                                                        {
                                                                            creatorName
                                                                        }
                                                                    </a>
                                                                ) : (
                                                                    <span>
                                                                        {
                                                                            creatorName
                                                                        }
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : null}
                                                        {showStore ? (
                                                            <>
                                                                {creatorName ? (
                                                                    <span>
                                                                        {" · "}
                                                                    </span>
                                                                ) : null}
                                                                <a
                                                                    className="underline underline-offset-4 hover:no-underline"
                                                                    href={
                                                                        storeLink!
                                                                    }
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    Store
                                                                </a>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </div>
                                        );

                                        const Actions =
                                            view === "list" ? (
                                                <div className="flex flex-col items-end gap-2 min-w-[110px]">
                                                    <div className="flex flex-col gap-2">
                                                        <Button
                                                            variant={
                                                                fav
                                                                    ? "secondary"
                                                                    : "ghost"
                                                            }
                                                            size="icon"
                                                            aria-label="Favorite"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const next =
                                                                    new Set(
                                                                        favorites,
                                                                    );
                                                                next.has(it.id)
                                                                    ? next.delete(
                                                                          it.id,
                                                                      )
                                                                    : next.add(
                                                                          it.id,
                                                                      );
                                                                setFavorites(
                                                                    next,
                                                                );
                                                            }}
                                                        >
                                                            <Heart
                                                                className={`h-4 w-4 ${fav ? "text-pink-500" : ""}`}
                                                            />
                                                        </Button>
                                                        <Button
                                                            variant={
                                                                cmp
                                                                    ? "secondary"
                                                                    : "ghost"
                                                            }
                                                            size="icon"
                                                            aria-label="Compare"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const next =
                                                                    new Set(
                                                                        compare,
                                                                    );
                                                                next.has(it.id)
                                                                    ? next.delete(
                                                                          it.id,
                                                                      )
                                                                    : next.add(
                                                                          it.id,
                                                                      );
                                                                setCompare(
                                                                    next,
                                                                );
                                                            }}
                                                        >
                                                            <Scale
                                                                className={`h-4 w-4 ${cmp ? "text-emerald-500" : ""}`}
                                                            />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label="Copy shareable link"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                copy(
                                                                    it.url,
                                                                    "Listing link copied",
                                                                );
                                                            }}
                                                        >
                                                            <Link2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="w-24"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setDescItem(it);
                                                        }}
                                                    >
                                                        Details
                                                    </Button>
                                                    <Button
                                                        asChild
                                                        size="sm"
                                                        className="w-24 mt-auto"
                                                    >
                                                        <a
                                                            href={it.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            Open
                                                        </a>
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-2 pt-2">
                                                    <Button
                                                        variant={
                                                            fav
                                                                ? "secondary"
                                                                : "ghost"
                                                        }
                                                        size="icon"
                                                        aria-label="Favorite"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            const next =
                                                                new Set(
                                                                    favorites,
                                                                );
                                                            next.has(it.id)
                                                                ? next.delete(
                                                                      it.id,
                                                                  )
                                                                : next.add(
                                                                      it.id,
                                                                  );
                                                            setFavorites(next);
                                                        }}
                                                    >
                                                        <Heart
                                                            className={`h-4 w-4 ${fav ? "text-pink-500" : ""}`}
                                                        />
                                                    </Button>
                                                    <Button
                                                        variant={
                                                            cmp
                                                                ? "secondary"
                                                                : "ghost"
                                                        }
                                                        size="icon"
                                                        aria-label="Compare"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            const next =
                                                                new Set(
                                                                    compare,
                                                                );
                                                            next.has(it.id)
                                                                ? next.delete(
                                                                      it.id,
                                                                  )
                                                                : next.add(
                                                                      it.id,
                                                                  );
                                                            setCompare(next);
                                                        }}
                                                    >
                                                        <Scale
                                                            className={`h-4 w-4 ${cmp ? "text-emerald-500" : ""}`}
                                                        />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label="Copy shareable link"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            copy(
                                                                it.url,
                                                                "Listing link copied",
                                                            );
                                                        }}
                                                    >
                                                        <Link2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setDescItem(it);
                                                        }}
                                                    >
                                                        Details
                                                    </Button>
                                                    <Button asChild size="sm">
                                                        <a
                                                            href={it.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            Open
                                                        </a>
                                                    </Button>
                                                </div>
                                            );

                                        if (view === "list") {
                                            return (
                                                <Card
                                                    key={it.id}
                                                    className="group"
                                                >
                                                    <CardContent className="p-3">
                                                        <div className="grid grid-cols-[10rem_1fr_auto] gap-4 items-center">
                                                            {Media}
                                                            <div className="min-w-0 flex items-center">
                                                                {Meta}
                                                            </div>
                                                            {Actions}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        }

                                        // Grid view: keep link on media+meta only, actions outside anchor
                                        return (
                                            <Card key={it.id} className="group">
                                                <CardContent className="p-3">
                                                    <a
                                                        href={it.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block"
                                                    >
                                                        {Media}
                                                        {Meta}
                                                    </a>
                                                    {Actions}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Infinite scroll spinner */}
                            {scrollMode === "infinite" &&
                                loading &&
                                items.length > 0 && (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                )}

                            <div ref={sentinelRef} />
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Description modal */}
            <Dialog
                open={!!descItem}
                onOpenChange={(open) => {
                    if (!open) setDescItem(null);
                }}
            >
                <DialogContent className="max-h-[85vh] w-[99vw] sm:max-w-[1400px] xl:max-w-[1600px] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {descItem?.title || "Item details"}
                        </DialogTitle>
                        <DialogDescription>
                            Listing description and details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {descItem?.images?.[0] ? (
                            <div className="h-64 sm:h-72 md:h-80 overflow-hidden rounded bg-muted max-w-[900px] mx-auto">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={descItem.images[0]}
                                    alt={descItem.title || "Image"}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        ) : null}
                        <div className="flex items-center justify-between text-sm">
                            <div className="font-medium truncate">
                                {descItem?.title || "Untitled"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                L$ {descItem?.price ?? "-"}
                            </div>
                        </div>
                        <div className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
                            {descItem?.description ||
                                "No description provided."}
                        </div>
                        <div className="pt-1">
                            {descItem?.url ? (
                                <Button asChild size="sm">
                                    <a
                                        href={descItem.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Open listing
                                    </a>
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Compare bar + modal */}
            <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
                {compare.size >= 2 && (
                    <div className="sticky bottom-0 z-20 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                        <div className="text-xs text-muted-foreground">
                            Comparing {compare.size} items
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    copy(
                                        getCompareShareUrl(),
                                        "Compare link copied",
                                    )
                                }
                            >
                                Copy link
                            </Button>
                            <DialogTrigger asChild>
                                <Button size="sm">Open compare</Button>
                            </DialogTrigger>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCompare(new Set())}
                            >
                                Clear
                            </Button>
                        </div>
                    </div>
                )}
                <DialogContent className="max-h-[85vh] w-[99vw] sm:max-w-[90vw] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Compare items</DialogTitle>
                        <DialogDescription>
                            Side-by-side overview of selected items.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {Array.from(compare).map((id) => {
                            const it = items.find((i) => i.id === id);
                            if (!it) return null;
                            const creatorName = it.creator?.name?.trim();
                            return (
                                <Card key={id} className="relative">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label="Remove"
                                        className="absolute top-2 right-2 z-20"
                                        onClick={() => {
                                            const next = new Set(compare);
                                            next.delete(id);
                                            setCompare(next);
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                    <CardContent className="p-4 space-y-3">
                                        <div className="aspect-video overflow-hidden rounded bg-muted">
                                            {it.images?.[0] && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={it.images[0]}
                                                    alt={it.title}
                                                    className="h-full w-full object-cover"
                                                />
                                            )}
                                        </div>
                                        <div className="text-sm font-medium line-clamp-2">
                                            {it.title || "Untitled"}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            L$ {it.price ?? "-"}
                                        </div>
                                        {creatorName ? (
                                            <div className="text-[11px] text-muted-foreground">
                                                by {creatorName}
                                            </div>
                                        ) : null}
                                        <div className="flex items-center gap-2 pt-1 flex-wrap w-full">
                                            <Button
                                                asChild
                                                size="sm"
                                                className="whitespace-nowrap"
                                            >
                                                <a
                                                    href={it.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    Open
                                                </a>
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="whitespace-nowrap"
                                                onClick={() =>
                                                    copy(
                                                        it.url,
                                                        "Listing link copied",
                                                    )
                                                }
                                            >
                                                Copy link
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Pagination (pages mode) */}
            {scrollMode === "pages" && (
                <div className="py-2">
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        const next = page - 1;
                                        if (next >= 0) {
                                            fetchItems({
                                                reset: true,
                                                pageIndex: next,
                                            });
                                        }
                                    }}
                                />
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationLink href="#" isActive>
                                    {page + 1} /{" "}
                                    {Math.max(1, Math.ceil(total / limit))}
                                </PaginationLink>
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationNext
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        const next = page + 1;
                                        if (next * limit < total) {
                                            fetchItems({
                                                reset: true,
                                                pageIndex: next,
                                            });
                                        }
                                    }}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            )}
        </div>
    );
}
