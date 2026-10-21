"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
} from "@/components/ui/pagination";
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
    ChevronLeft,
    ChevronRight,
    PlusCircle,
    SlidersHorizontal,
    SearchX,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { Virtuoso, VirtuosoGrid } from "react-virtuoso";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Item = {
    id: string;
    url: string;
    title: string;
    images?: string[];
    price?: string | null;
    description?: string | null;
    creator?: { name?: string; link?: string } | null;
    store?: string | null;
    isNsfw?: boolean | null;
};

type Category = { id: string; path: string[]; count?: number; isNsfw?: boolean };
type ItemsResp = { items: Item[]; total: number; limit: number; offset: number };
type CatsResp = { items: Category[] };
interface AuthorEntry { name: string; link?: string | null; itemCount: number }

/** A node in the category tree. */
interface CatNode {
    name: string;
    path: string[];
    id?: string;
    count: number;
    /** Whether this branch holds adult material. */
    isNsfw: boolean;
    children: Map<string, CatNode>;
}

/**
 * An icon-only control on a card, with a short tooltip saying what it does.
 *
 * The label stays on the button for screen readers; the tooltip is the
 * visible explanation for everyone else.
 */
function CardIconButton({
    tooltip,
    label,
    children,
    ...props
}: React.ComponentProps<typeof Button> & { tooltip: string; label: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button aria-label={label} {...props}>
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="px-2 py-1">
                {tooltip}
            </TooltipContent>
        </Tooltip>
    );
}

/**
 * Whether a branch is open.
 *
 * A branch is open by default when it holds the current selection, so the
 * selection is never hidden. An explicit choice from the shopper wins over
 * that default - a selected branch can still be folded away.
 */
function branchIsOpen(
    branchState: Record<string, boolean>,
    path: string[],
    selected: string[],
): boolean {
    const override = branchState[path.join("|")];
    if (override !== undefined) return override;
    const isSelected =
        selected.length === path.length && selected.join("") === path.join("");
    const holdsSelection =
        selected.length > path.length &&
        path.join("") === selected.slice(0, path.length).join("");
    return isSelected || holdsSelection;
}

/**
 * The category tree, rendered recursively.
 *
 * The tree is deeper than three levels, so this walks the node structure
 * rather than hard-coding primary/sub/sub2. A branch can be opened without
 * picking it - opening is browsing, picking is filtering.
 */
function CategoryTree({
    node,
    selected,
    branchState,
    onSelect,
    onToggle,
    depth = 0,
}: {
    node: CatNode;
    selected: string[];
    branchState: Record<string, boolean>;
    onSelect: (path: string[]) => void;
    onToggle: (path: string[]) => void;
    depth?: number;
}) {
    const children = Array.from(node.children.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
    );
    if (!children.length) return null;

    return (
        <div className="space-y-0.5 min-w-0">
            {children.map((child) => {
                const isSelected =
                    selected.length === child.path.length &&
                    selected.join("") === child.path.join("");
                // A node is open when the shopper opened it, when it is
                // selected itself, or when the selection sits deeper inside
                // it - selecting a root has to reveal its children.
                const isOpen = branchIsOpen(branchState, child.path, selected);
                const hasChildren = child.children.size > 0;
                return (
                    <div key={child.path.join("|")}>
                        <div className="flex items-center gap-0.5 min-w-0">
                            {hasChildren ? (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 rounded-sm text-muted-foreground"
                                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${child.name}`}
                                    aria-expanded={isOpen}
                                    onClick={() => onToggle(child.path)}
                                >
                                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                                </Button>
                            ) : (
                                <span className="h-6 w-6 shrink-0" aria-hidden="true" />
                            )}
                            <Button
                                size="sm"
                                variant={isSelected ? "secondary" : "ghost"}
                                className={`h-8 min-w-0 flex-1 justify-start gap-2 overflow-hidden ${
                                    depth === 0 ? "font-medium" : "font-normal text-muted-foreground hover:text-foreground"
                                }`}
                                onClick={() => onSelect(child.path)}
                            >
                                <span className="truncate">{child.name}</span>
                                {child.isNsfw && (
                                    <Badge variant="destructive" className="shrink-0 px-1.5">
                                        NSFW
                                    </Badge>
                                )}
                                {child.count > 0 && (
                                    <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                                        {child.count}
                                    </span>
                                )}
                            </Button>
                        </div>
                        {isOpen && hasChildren && (
                            <div className="ml-2.5 border-l border-border/70 pl-1.5 space-y-0.5 min-w-0">
                                <CategoryTree
                                    node={child}
                                    selected={selected}
                                    branchState={branchState}
                                    onSelect={onSelect}
                                    onToggle={onToggle}
                                    depth={depth + 1}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/** Page numbers to render in the pager, 0-based, with -1 marking an ellipsis gap. */
function pageWindow(current: number, count: number): number[] {
    if (count <= 7) return Array.from({ length: count }, (_, i) => i);
    const pages = new Set<number>([0, count - 1, current - 1, current, current + 1]);
    const sorted = [...pages].filter((p) => p >= 0 && p < count).sort((a, b) => a - b);
    const out: number[] = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) out.push(-1);
        out.push(p);
    });
    return out;
}

export default function ClientExplorer() {
    const [q, setQ] = useState("");
    const [sort, setSort] = useState<"most" | "least" | "priceAsc" | "priceDesc">("most");
    const [cats, setCats] = useState<Category[]>([]);
    /**
     * Per-branch open/closed overrides, keyed by the joined path.
     *
     * Opening is browsing, picking is filtering - a branch can be expanded
     * to look through it without selecting it. An explicit fold wins over
     * the default, so even a selected branch can be hidden.
     */
    const [branchState, setBranchState] = useState<Record<string, boolean>>({});
    /**
     * The selected category path.
     *
     * The tree is deeper than three levels, so the selection is a path rather
     * than a primary/sub/sub2 triple.
     */
    const [catPath, setCatPath] = useState<string[]>([]);
    const [author, setAuthor] = useState("");
    const [activeTab, setActiveTab] = useState<"categories" | "authors">("categories");
    /**
     * The category panel, shown over the results on a narrow screen.
     *
     * The page is a fixed-height shell, so a stacked sidebar would squeeze
     * the results to nothing. Below the breakpoint the panel floats over
     * them instead.
     */
    const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();
    const [authors, setAuthors] = useState<AuthorEntry[]>([]);
    const [authorsLoading, setAuthorsLoading] = useState(false);

    const [items, setItems] = useState<Item[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(24);
    const [loading, setLoading] = useState(false);
    /** True while a reset/refetch (filter change) is in flight, as opposed to an append. */
    const [replacing, setReplacing] = useState(false);

    const [view, setView] = useState<"grid" | "list">("grid");
    const [scrollMode, setScrollMode] = useState<"pages" | "infinite">("pages");
    const [hasImageOnly, setHasImageOnly] = useState(false);
    const [showNsfw, setShowNsfw] = useState(false);
    /**
     * True once the URL has been read into the state.
     *
     * The URL is rewritten from the state, so a link that arrives with
     * parameters has to be read before anything writes over it - otherwise
     * a shared link loses its query on arrival.
     */
    const hydrated = useRef(false);
    const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
    const [compare, setCompare] = useState<Set<string>>(() => new Set());
    /** Items fetched by id for a shared compare selection that is not on this page. */
    const [comparedItems, setComparedItems] = useState<Item[]>([]);
    const [recent, setRecent] = useState<string[]>([]);
    const [compareOpen, setCompareOpen] = useState(false);
    const [descItem, setDescItem] = useState<Item | null>(null);

    const inputRef = useRef<HTMLInputElement | null>(null);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    /**
     * The category tree, built from the flat list of paths.
     *
     * Built generically over depth, so the tree renders however deep the
     * data actually goes.
     */
    const catTree = useMemo(() => {
        type Node = {
            name: string;
            path: string[];
            id?: string;
            count: number;
            isNsfw: boolean;
            children: Map<string, Node>;
        };
        const root: Node = { name: "", path: [], count: 0, isNsfw: false, children: new Map() };
        for (const c of cats) {
            const path = c.path ?? [];
            if (!path.length) continue;
            let node = root;
            path.forEach((segment, index) => {
                let child = node.children.get(segment);
                if (!child) {
                    child = {
                        name: segment,
                        path: [...node.path, segment],
                        count: 0,
                        isNsfw: false,
                        children: new Map(),
                    };
                    node.children.set(segment, child);
                }
                if (index === path.length - 1) {
                    child.id = c.id;
                    child.count = c.count ?? 0;
                    child.isNsfw = c.isNsfw ?? false;
                }
                node = child;
            });
        }
        // A branch marked as adult covers everything beneath it.
        const inherit = (node: Node, parentNsfw: boolean) => {
            for (const child of node.children.values()) {
                child.isNsfw = child.isNsfw || parentNsfw;
                inherit(child, child.isNsfw);
            }
        };
        inherit(root, root.isNsfw);
        return root;
    }, [cats]);

    useEffect(() => {
        if (!catPath.length) {
            setSelectedCategoryId(undefined);
            return;
        }
        const match = cats.find(
            (c) => (c.path ?? []).join("") === catPath.join(""),
        );
        setSelectedCategoryId(match?.id);
    }, [catPath, cats]);

    useEffect(() => {
        // The tree follows the NSFW filter: a category marked as adult is
        // not in the tree until the visitor asks for it.
        (async () => {
            try {
                const params = new URLSearchParams();
                if (showNsfw) params.set("showNsfw", "true");
                const r = await fetch(
                    `/api/public/marketplace/categories?${params.toString()}`,
                );
                const d: CatsResp = await r.json();
                setCats(d.items || []);
            } catch {}
        })();
    }, [showNsfw]);
    useEffect(() => { try { setFavorites(new Set(JSON.parse(localStorage.getItem("mp_favorites") || "[]"))); } catch {} try { setCompare(new Set(JSON.parse(localStorage.getItem("mp_compare") || "[]"))); } catch {} try { const r = JSON.parse(localStorage.getItem("mp_recent_searches") || "[]"); setRecent(Array.isArray(r) ? r.slice(0, 8) : []); } catch {}; }, []);
    useEffect(() => { try { localStorage.setItem("mp_favorites", JSON.stringify(Array.from(favorites))); } catch {}; }, [favorites]);
    useEffect(() => { try { localStorage.setItem("mp_compare", JSON.stringify(Array.from(compare))); } catch {}; }, [compare]);

    useEffect(() => { const t = setTimeout(() => { const term = q.trim(); if (!term) return; setRecent(prev => { const next = [term, ...prev.filter(s => s !== term)].slice(0, 8); try { localStorage.setItem("mp_recent_searches", JSON.stringify(next)); } catch {}; return next; }); }, 600); return () => clearTimeout(t); }, [q]);

    useEffect(() => {
        if (!cats.length) return;
        const qp = new URLSearchParams(searchParams.toString());
        const nq = qp.get("q") || "";
        const ns = (qp.get("sort") as any) || "most";
        const nl = parseInt(qp.get("limit") || "24", 10);
        const np = qp.get("cat") || "";
        const nauthor = qp.get("author") || "";
        const nShowNsfw = qp.get("showNsfw") === "true";
        setQ(nq);
        setSort(["most", "least", "priceAsc", "priceDesc"].includes(ns) ? (ns as any) : "most");
        if (!Number.isNaN(nl)) setLimit(nl);
        setCatPath(np ? np.split("|").filter(Boolean) : []);
        setAuthor(nauthor);
        setShowNsfw(nShowNsfw);
        // Restore a shared compare selection from the URL (?compare=id1,id2).
        // Returning `prev` when the ids already match keeps the URL-write
        // effect below from looping with this one.
        const cmpIds = (qp.get("compare") || "").split(",").filter(Boolean);
        if (cmpIds.length) {
            setCompare((prev) => {
                const prevSorted = Array.from(prev).sort();
                const nextSorted = [...cmpIds].sort();
                return prevSorted.length === nextSorted.length &&
                    prevSorted.every((v, i) => v === nextSorted[i])
                    ? prev
                    : new Set(nextSorted);
            });
        }
        // The URL has now been read, so it is safe to write it back.
        hydrated.current = true;
    }, [cats, searchParams]);

    useEffect(() => {
        // Wait until the URL has been read - writing it before that would
        // drop the parameters a shared link arrived with.
        if (!hydrated.current) return;
        const qp = new URLSearchParams();
        if (q.trim()) qp.set("q", q.trim());
        if (sort !== "most") qp.set("sort", sort);
        if (limit !== 24) qp.set("limit", String(limit));
        if (catPath.length) qp.set("cat", catPath.join("|"));
        if (author) qp.set("author", author);
        if (showNsfw) qp.set("showNsfw", "true");
        if (compare.size) qp.set("compare", Array.from(compare).sort().join(","));
        router.replace(`${pathname}?${qp.toString()}` as any, { scroll: false });
    }, [q, sort, limit, catPath, author, showNsfw, compare, router, pathname]);

    // Fetch authors (distinct creators) when authors tab active or author search changes (debounced)
    useEffect(() => {
        if (activeTab !== "authors") return;
        const handle = setTimeout(async () => {
            setAuthorsLoading(true);
            try {
                const usp = new URLSearchParams();
                if (author.trim()) usp.set("q", author.trim());
                if (showNsfw) usp.set("showNsfw", "true");
                const res = await fetch(`/api/public/marketplace/authors?${usp.toString()}`, { cache: "no-store" });
                const data = await res.json();
                setAuthors(Array.isArray(data.items) ? data.items : []);
            } catch {
                setAuthors([]);
            } finally {
                setAuthorsLoading(false);
            }
        }, 250);
        return () => clearTimeout(handle);
    }, [activeTab, author, showNsfw]);

    const fetchItems = useCallback(async (options: { reset?: boolean; pageIndex: number }) => {
        const { reset = false, pageIndex } = options;
        if (reset) setReplacing(true);
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (q.trim()) params.set("q", q.trim());
            if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
            if (author.trim()) params.set("author", author.trim());
            if (sort) params.set("sort", sort);
            if (showNsfw) params.set("showNsfw", "true");
            params.set("limit", String(limit));
            params.set("offset", String(pageIndex * limit));
            const res = await fetch(`/api/public/marketplace/items?${params.toString()}`, { cache: "no-store" });
            const data: ItemsResp = await res.json();
            setTotal(data.total || 0);
            setItems(prev => (reset ? data.items || [] : [...prev, ...(data.items || [])]));
            setPage(pageIndex);
        } finally {
            setLoading(false);
            setReplacing(false);
        }
    }, [q, sort, selectedCategoryId, limit, author, showNsfw]);
    useEffect(() => {
        const t = setTimeout(() => {
            fetchItems({ reset: true, pageIndex: 0 });
        }, 250);
        return () => clearTimeout(t);
    }, [q, sort, selectedCategoryId, limit, author, showNsfw, fetchItems]);

    // A shared compare selection can reference items that are not on the
    // current page of results - fetch those by id so the dialog has content.
    useEffect(() => {
        const ids = Array.from(compare);
        if (!ids.length) {
            setComparedItems([]);
            return;
        }
        const missing = ids.filter((id) => !items.some((it) => it.id === id));
        if (!missing.length) {
            setComparedItems([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const params = new URLSearchParams();
                params.set("ids", missing.join(","));
                params.set("limit", String(Math.min(100, missing.length)));
                if (showNsfw) params.set("showNsfw", "true");
                const res = await fetch(`/api/public/marketplace/items?${params.toString()}`, { cache: "no-store" });
                const data: ItemsResp = await res.json();
                if (!cancelled) setComparedItems(data.items || []);
            } catch {
                if (!cancelled) setComparedItems([]);
            }
        })();
        return () => { cancelled = true; };
    }, [compare, items, showNsfw]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const target = e.target as HTMLElement | null;
            const tag = target?.tagName;
            const isTyping =
                tag === "INPUT" ||
                tag === "TEXTAREA" ||
                tag === "SELECT" ||
                target?.isContentEditable;
            // A dialog owns Escape while it is open - the shortcut must not
            // also clear the search behind it.
            const dialogOpen = !!document.querySelector("[role='dialog']");
            if (e.key === "/") {
                // "/" is a shortcut to the search box, so it cannot be typed
                // into another field.
                if (isTyping || dialogOpen) return;
                e.preventDefault();
                inputRef.current?.focus();
            }
            if (e.key === "Escape" && !dialogOpen) {
                if (tag === "INPUT" || tag === "TEXTAREA") {
                    (target as HTMLInputElement).blur();
                }
                setQ("");
            }
            if (e.key === "ArrowLeft" && scrollMode === "pages" && !isTyping) {
                const next = page - 1;
                if (next >= 0) fetchItems({ reset: true, pageIndex: next });
            }
            if (e.key === "ArrowRight" && scrollMode === "pages" && !isTyping) {
                const next = page + 1;
                if (next * limit < total) fetchItems({ reset: true, pageIndex: next });
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [page, limit, total, scrollMode, fetchItems]);

    const visibleItems = useMemo(() => { let out = items; if (hasImageOnly) out = out.filter(it => (it.images?.[0] ?? "").length > 0); return out; }, [items, hasImageOnly]);

    function copy(text: string, msg = "Link copied") { try { navigator.clipboard.writeText(text); toast(msg); } catch { try { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); toast(msg); } catch {} } }

    /** Fold or unfold a branch without changing the filter. */
    const toggleBranch = useCallback((path: string[]) => {
        const key = path.join("|");
        setBranchState((prev) => ({
            ...prev,
            [key]: !branchIsOpen(prev, path, catPath),
        }));
    }, [catPath]);
    function getCompareShareUrl() { try { const ids = Array.from(compare); const base = typeof window !== "undefined" ? window.location.origin : ""; const qp = new URLSearchParams(searchParams.toString()); if (ids.length) qp.set("compare", ids.join(",")); return `${base}${pathname}?${qp.toString()}`; } catch { return ""; } }

    return (
        <div className="grid grid-rows-[auto_1fr] gap-4 h-full min-h-0">
            <Card className="border bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40 sticky top-0 z-30">
                <CardContent className="p-3">
                    <div className="w-full">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setMobilePanelOpen(true)}>
                                    <SlidersHorizontal className="h-4 w-4 mr-2" /> Browse
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => router.push("/")}> <Home className="h-4 w-4 mr-2" /> Home </Button>
                            </div>
                            <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[220px]">
                                <Label htmlFor="mp-search" className="sr-only">Search items</Label>
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input id="mp-search" ref={inputRef} placeholder="Search items… (press / to focus)" value={q} onChange={e => setQ(e.target.value)} className="pl-9 pr-9" />
                                {q && <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="hidden text-xs text-muted-foreground sm:inline">Sort</span>
                                <Select value={sort} onValueChange={(v: any) => setSort(v)}>
                                    <SelectTrigger className="w-36 sm:w-44" aria-label="Sort results"><SelectValue placeholder="Sort" /></SelectTrigger>
                                    <SelectContent><SelectItem value="most">Most rated</SelectItem><SelectItem value="least">Least rated</SelectItem><SelectItem value="priceAsc">Price: Low → High</SelectItem><SelectItem value="priceDesc">Price: High → Low</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="hidden text-xs text-muted-foreground sm:inline">View</span>
                                <div className="flex rounded-md border p-1">
                                    <Button variant={view === "grid" ? "secondary" : "ghost"} size="sm" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}> <LayoutGrid className="h-4 w-4" /> </Button>
                                    <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}> <ListIcon className="h-4 w-4" /> </Button>
                                </div>
                            </div>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <SlidersHorizontal className="h-4 w-4 mr-2" /> Filters
                                        {(hasImageOnly || showNsfw) && <span className="ml-1 rounded-full bg-primary px-1.5 text-xs font-semibold leading-5 text-primary-foreground">{Number(hasImageOnly) + Number(showNsfw)}</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-72 space-y-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mp-per-page">Per page</Label>
                                        <Select value={String(limit)} onValueChange={v => setLimit(parseInt(v, 10))}>
                                            <SelectTrigger id="mp-per-page" className="w-full"><SelectValue /></SelectTrigger>
                                            <SelectContent>{[12, 24, 36, 48].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mp-scroll">Scrolling</Label>
                                        <Select value={scrollMode} onValueChange={(v: any) => setScrollMode(v)}>
                                            <SelectTrigger id="mp-scroll" className="w-full"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="pages">Pages</SelectItem><SelectItem value="infinite">Infinite</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="mp-has-image">Has image</Label>
                                        <Switch id="mp-has-image" checked={hasImageOnly} onCheckedChange={setHasImageOnly} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="mp-nsfw">Show NSFW</Label>
                                        <Switch id="mp-nsfw" checked={showNsfw} onCheckedChange={setShowNsfw} />
                                    </div>
                                    <Button variant="outline" size="sm" className="w-full" onClick={() => { setQ(""); setCatPath([]); setAuthor(""); setHasImageOnly(false); setShowNsfw(false); }}>
                                        <Trash2 className="h-4 w-4 mr-1" /> Reset filters
                                    </Button>
                                </PopoverContent>
                            </Popover>
                            <div className="flex items-center">
                                <Button variant="outline" size="sm" onClick={() => router.push("/marketplace/request")}> <PlusCircle className="h-4 w-4 mr-1" /> Request item </Button>
                            </div>
                        </div>
                        {recent.length > 0 && <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs"><span className="text-muted-foreground">Recent:</span>{recent.map(r => <Button key={r} size="sm" variant="ghost" className="h-7 px-2" onClick={() => setQ(r)}>{r}</Button>)}</div>}
                        {(q || catPath.length || author || hasImageOnly || showNsfw) && <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs">{q && <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => setQ("")}>q: {q} <X className="ml-1 h-3 w-3" /></Button>}{catPath.length > 0 && <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => { setCatPath([]); setAuthor(""); }}>cat: {catPath.join(" › ")} <X className="ml-1 h-3 w-3" /></Button>}{author && <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => setAuthor("")}>author: {author} <X className="ml-1 h-3 w-3" /></Button>}{hasImageOnly && <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => setHasImageOnly(false)}>has image <X className="ml-1 h-3 w-3" /></Button>}{showNsfw && <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => setShowNsfw(false)}>show nsfw <X className="ml-1 h-3 w-3" /></Button>}</div>}
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {total ? (
                                scrollMode === "pages" ? (
                                    <>
                                        <span>{new Intl.NumberFormat().format(total)} results · Page {page + 1} of {Math.max(1, Math.ceil(total / limit))}</span>
                                        <Pagination className="mx-0 w-auto">
                                            <PaginationContent>
                                                <PaginationItem>
                                                    <PaginationLink
                                                        href="#"
                                                        aria-label="Previous page"
                                                        size="icon"
                                                        className={page <= 0 ? "pointer-events-none opacity-50" : ""}
                                                        onClick={(e) => { e.preventDefault(); const next = page - 1; if (next >= 0) fetchItems({ reset: true, pageIndex: next }); }}
                                                    >
                                                        <ChevronLeft className="h-4 w-4" />
                                                    </PaginationLink>
                                                </PaginationItem>
                                                {pageWindow(page, Math.max(1, Math.ceil(total / limit))).map((p, i) =>
                                                    p === -1 ? (
                                                        <PaginationItem key={`gap-${i}`}><PaginationEllipsis /></PaginationItem>
                                                    ) : (
                                                        <PaginationItem key={p}>
                                                            <PaginationLink
                                                                href="#"
                                                                isActive={p === page}
                                                                onClick={(e) => { e.preventDefault(); if (p !== page) fetchItems({ reset: true, pageIndex: p }); }}
                                                            >
                                                                {p + 1}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    ),
                                                )}
                                                <PaginationItem>
                                                    <PaginationLink
                                                        href="#"
                                                        aria-label="Next page"
                                                        size="icon"
                                                        className={(page + 1) * limit >= total ? "pointer-events-none opacity-50" : ""}
                                                        onClick={(e) => { e.preventDefault(); const next = page + 1; if (next * limit < total) fetchItems({ reset: true, pageIndex: next }); }}
                                                    >
                                                        <ChevronRight className="h-4 w-4" />
                                                    </PaginationLink>
                                                </PaginationItem>
                                            </PaginationContent>
                                        </Pagination>
                                        <span className="hidden sm:inline items-center gap-1">
                                            <kbd className="rounded border bg-muted px-1 font-mono">/</kbd> search
                                            · <kbd className="rounded border bg-muted px-1 font-mono">←</kbd><kbd className="rounded border bg-muted px-1 font-mono">→</kbd> pages
                                        </span>
                                    </>
                                ) : (
                                    <span>{new Intl.NumberFormat().format(total)} results</span>
                                )
                            ) : (
                                <span>Type to search or use filters</span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 min-h-0 relative">
                {/* Backdrop for the overlaid category panel on a narrow screen. */}
                {mobilePanelOpen && (
                    <button
                        type="button"
                        aria-label="Close categories"
                        className="absolute inset-0 z-20 bg-background/70 backdrop-blur-sm lg:hidden"
                        onClick={() => setMobilePanelOpen(false)}
                    />
                )}
                <Card className={`absolute inset-y-0 left-0 w-[min(320px,88vw)] min-h-0 h-full z-30 lg:static lg:w-auto lg:z-auto ${mobilePanelOpen ? "" : "hidden lg:flex"} lg:flex-col`}>
                    <CardContent className="p-0 h-full flex flex-col min-h-0">
                        <div className="flex items-center justify-between gap-2 border-b px-3 py-2 lg:hidden">
                            <span className="text-sm font-medium">Browse</span>
                            <Button variant="ghost" size="icon" aria-label="Close categories" onClick={() => setMobilePanelOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <ScrollArea className="h-full flex-1 min-h-0" viewportClassName="[&>div]:!block">
                            <div className="p-3 space-y-3 min-w-0">
                                <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
                                    <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="categories">Categories</TabsTrigger><TabsTrigger value="authors">Authors</TabsTrigger></TabsList>
                                    <TabsContent value="categories" className="mt-3 min-w-0">
                                        <Button variant={catPath.length === 0 ? "secondary" : "ghost"} className="w-full justify-start mb-2" onClick={() => setCatPath([])}>All categories</Button>
                                        <CategoryTree
                                            node={catTree}
                                            selected={catPath}
                                            branchState={branchState}
                                            onSelect={(path) => {
                                                setCatPath(path);
                                                // On a narrow screen the panel floats over
                                                // the results - picking a category should
                                                // take the shopper back to them.
                                                setMobilePanelOpen(false);
                                            }}
                                            onToggle={toggleBranch}
                                        />
                                    </TabsContent>
                                    <TabsContent value="authors" className="mt-3 space-y-2 min-w-0">
                                        <Input placeholder="Search author…" value={author} onChange={e => setAuthor(e.target.value)} />
                                        <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1 themed-scrollbar">
                                            {authorsLoading && <div className="text-xs text-muted-foreground py-1">Loading authors…</div>}
                                            {!authorsLoading && authors.length === 0 && <div className="text-xs text-muted-foreground py-1">No authors found</div>}
                                            {authors.map(a => (
                                                <Button
                                                    key={a.name + (a.link || '')}
                                                    size="sm"
                                                    variant={author.toLowerCase() === a.name.toLowerCase() ? "secondary" : "ghost"}
                                                    className="w-full justify-between"
                                                    onClick={() => {
                                                        setAuthor(a.name);
                                                    }}
                                                >
                                                    <span className="truncate text-left" title={a.name}>{a.name}</span>
                                                    <span className="ml-2 text-xs text-muted-foreground tabular-nums">{a.itemCount}</span>
                                                </Button>
                                            ))}
                                        </div>
                                        {(author || authors.length > 0) && <div className="flex items-center gap-2 pt-1">
                                            {author && <Button size="sm" variant="outline" className="flex-1" onClick={() => setAuthor("")}>Clear filter</Button>}
                                            <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setAuthor(""); setAuthors([]); }}>Reset</Button>
                                        </div>}
                                        <p className="text-xs text-muted-foreground">Click an author to filter items. Counts show number of listings.</p>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
                <Card className="min-h-0 h-full">
                    <CardContent className="p-4 h-full">
                        <div className="relative h-full">
                            {replacing && items.length > 0 && (
                                <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-background/40 pt-6 backdrop-blur-[1px]" role="status" aria-live="polite">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    <span className="sr-only">Updating results…</span>
                                </div>
                            )}
                            {loading && page === 0 && items.length === 0 ? (
                                <div className={`grid ${view === "grid" ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7" : "grid-cols-1"} gap-4`}>
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <div key={i} className="animate-pulse">
                                            <div className="aspect-video rounded bg-muted" />
                                            <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
                                            <div className="mt-1 h-3 w-1/3 rounded bg-muted" />
                                        </div>
                                    ))}
                                </div>
                            ) : visibleItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                                    <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                                    <div>
                                        <div className="text-sm font-medium">No results found</div>
                                        <div className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filters.</div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => { setQ(""); setCatPath([]); setAuthor(""); setHasImageOnly(false); setShowNsfw(false); }}
                                    >
                                        Clear all filters
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    {view === "list" ? (
                                        <Virtuoso
                                            className="h-full pr-2 themed-scrollbar"
                                            overscan={200}
                                            data={visibleItems}
                                            endReached={() => { if (scrollMode !== "infinite" || loading) return; const next = page + 1; if (next * limit < total) { fetchItems({ reset: false, pageIndex: next }); } }}
                                            itemContent={(index, it) => {
                                                const creatorName = it.creator?.name?.trim();
                                                const creatorLink = it.creator?.link?.trim();
                                                const storeLink = it.store?.trim();
                                                const showStore = storeLink && storeLink !== creatorLink;
                                                const fav = favorites.has(it.id);
                                                const cmp = compare.has(it.id);
                                                return (
                                                    <Card key={it.id} className="group mb-3">
                                                        <CardContent className="p-3">
                                                            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[10rem_1fr_auto] sm:items-center sm:gap-4">
                                                                <div className="overflow-hidden rounded bg-muted h-40 w-full sm:h-28 sm:w-44">
                                                                    {it.images?.[0] ? (
                                                                        <button type="button" className="relative block h-full w-full cursor-pointer" aria-label={`View details for ${it.title || "Untitled"}`} onClick={() => setDescItem(it)}>
                                                                            <Image src={it.images[0]} alt={it.title || "Untitled"} className="h-full w-full object-cover transition group-hover:scale-[1.02]" width={176} height={112} sizes="176px" />
                                                                        </button>
                                                                    ) : (
                                                                        <div className="flex h-full w-full items-center justify-center text-muted-foreground"><SearchX className="h-6 w-6" aria-hidden="true" /></div>
                                                                    )}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-start justify-between gap-3 min-w-0">
                                                                            <button type="button" className="flex-1 cursor-pointer text-left text-sm font-medium leading-snug line-clamp-2 whitespace-normal hover:underline" title={it.title || "Untitled"} onClick={() => setDescItem(it)}>{it.title || "Untitled"}</button>
                                                                            <div className={`shrink-0 text-sm font-semibold tabular-nums ${it.price ? "text-foreground" : "text-muted-foreground"}`}>{it.price ? `L$ ${it.price}` : "—"}</div>
                                                                        </div>
                                                                        {(creatorName || creatorLink || storeLink) && (
                                                                            <div className="text-xs text-muted-foreground">
                                                                                {creatorName && <>by {creatorLink ? <a className="underline underline-offset-4 hover:no-underline" href={creatorLink} target="_blank" rel="noopener noreferrer">{creatorName}</a> : <span>{creatorName}</span>}</>}
                                                                                {showStore && <>{creatorName ? <span>{" · "}</span> : null}<a className="underline underline-offset-4 hover:no-underline" href={storeLink!} target="_blank" rel="noopener noreferrer">Store</a></>}
                                                                            </div>
                                                                        )}
                                                                        {it.isNsfw && showNsfw && <Badge variant="destructive" className="w-fit">NSFW</Badge>}
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-center sm:justify-end gap-2">
                                                                    <div className="flex flex-row sm:flex-col gap-1">
                                                                        <CardIconButton
                                                                            variant={fav ? "secondary" : "ghost"}
                                                                            size="icon"
                                                                            label="Favorite"
                                                                            tooltip={fav ? "Remove from favorites" : "Add to favorites"}
                                                                            aria-pressed={fav}
                                                                            onClick={e => { e.preventDefault(); const next = new Set(favorites); next.has(it.id) ? next.delete(it.id) : next.add(it.id); setFavorites(next); }}
                                                                        >
                                                                            <Heart className={`h-4 w-4 ${fav ? "text-pink-500" : ""}`} />
                                                                        </CardIconButton>
                                                                        <CardIconButton
                                                                            variant={cmp ? "secondary" : "ghost"}
                                                                            size="icon"
                                                                            label="Compare"
                                                                            tooltip={cmp ? "Remove from comparison" : "Add to comparison"}
                                                                            aria-pressed={cmp}
                                                                            onClick={e => { e.preventDefault(); const next = new Set(compare); next.has(it.id) ? next.delete(it.id) : next.add(it.id); setCompare(next); }}
                                                                        >
                                                                            <Scale className={`h-4 w-4 ${cmp ? "text-emerald-500" : ""}`} />
                                                                        </CardIconButton>
                                                                        <CardIconButton
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            label="Copy shareable link"
                                                                            tooltip="Copy listing link"
                                                                            onClick={e => { e.preventDefault(); copy(it.url, "Listing link copied"); }}
                                                                        >
                                                                            <Link2 className="h-4 w-4" />
                                                                        </CardIconButton>
                                                                    </div>
                                                                    <Button asChild size="sm"><a href={it.url} target="_blank" rel="noopener noreferrer">Open</a></Button>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            }}
                                            components={{ Footer: () => (scrollMode === "infinite" && loading ? <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : null) }}
                                        />
                                    ) : (
                                        <VirtuosoGrid
                                            className="h-full themed-scrollbar"
                                            listClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4"
                                            overscan={200}
                                            data={visibleItems}
                                            endReached={() => { if (scrollMode !== "infinite" || loading) return; const next = page + 1; if (next * limit < total) { fetchItems({ reset: false, pageIndex: next }); } }}
                                            itemContent={(index, it) => {
                                                const fav = favorites.has(it.id); const cmp = compare.has(it.id);
                                                return (
                                                    <Card key={it.id} className="group">
                                                        <CardContent className="p-3">
                                                            <div className="overflow-hidden rounded bg-muted aspect-video relative">
                                                                {it.images?.[0] ? (
                                                                    <button type="button" aria-label={`View details for ${it.title || "Untitled"}`} className="relative block h-full w-full cursor-pointer" onClick={() => setDescItem(it)}>
                                                                        <Image src={it.images[0]} alt={it.title || "Untitled"} className="object-cover transition group-hover:scale-[1.02]" fill sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw" />
                                                                    </button>
                                                                ) : (
                                                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground"><SearchX className="h-6 w-6" aria-hidden="true" /></div>
                                                                )}
                                                            </div>
                                                            <div className="space-y-1 mt-2">
                                                                <div className="flex items-start justify-between gap-3 min-w-0">
                                                                    <button type="button" className="flex-1 cursor-pointer text-left text-sm font-medium leading-snug line-clamp-2 whitespace-normal hover:underline" title={it.title || "Untitled"} onClick={() => setDescItem(it)}>{it.title || "Untitled"}</button>
                                                                    <div className={`shrink-0 text-sm font-semibold tabular-nums ${it.price ? "text-foreground" : "text-muted-foreground"}`}>{it.price ? `L$ ${it.price}` : "—"}</div>
                                                                </div>
                                                                {(it.creator?.name?.trim() || it.creator?.link?.trim() || it.store?.trim()) && (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {it.creator?.name?.trim() && <>by {it.creator?.link?.trim() ? <a className="underline underline-offset-4 hover:no-underline" href={it.creator!.link!} target="_blank" rel="noopener noreferrer">{it.creator!.name!}</a> : <span>{it.creator!.name!}</span>}</>}
                                                                        {it.store?.trim() && it.store?.trim() !== it.creator?.link?.trim() && <> {it.creator?.name ? <span>{" · "}</span> : null}<a className="underline underline-offset-4 hover:no-underline" href={it.store!} target="_blank" rel="noopener noreferrer">Store</a></>}
                                                                    </div>
                                                                )}
                                                                {it.isNsfw && showNsfw && <Badge variant="destructive" className="w-fit">NSFW</Badge>}
                                                            </div>
                                                            <div className="flex items-center gap-1 pt-2">
                                                                <CardIconButton
                                                                    variant={fav ? "secondary" : "ghost"}
                                                                    size="icon"
                                                                    label="Favorite"
                                                                    tooltip={fav ? "Remove from favorites" : "Add to favorites"}
                                                                    aria-pressed={fav}
                                                                    onClick={e => { e.preventDefault(); const next = new Set(favorites); next.has(it.id) ? next.delete(it.id) : next.add(it.id); setFavorites(next); }}
                                                                >
                                                                    <Heart className={`h-4 w-4 ${fav ? "text-pink-500" : ""}`} />
                                                                </CardIconButton>
                                                                <CardIconButton
                                                                    variant={cmp ? "secondary" : "ghost"}
                                                                    size="icon"
                                                                    label="Compare"
                                                                    tooltip={cmp ? "Remove from comparison" : "Add to comparison"}
                                                                    aria-pressed={cmp}
                                                                    onClick={e => { e.preventDefault(); const next = new Set(compare); next.has(it.id) ? next.delete(it.id) : next.add(it.id); setCompare(next); }}
                                                                >
                                                                    <Scale className={`h-4 w-4 ${cmp ? "text-emerald-500" : ""}`} />
                                                                </CardIconButton>
                                                                <CardIconButton
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    label="Copy shareable link"
                                                                    tooltip="Copy listing link"
                                                                    onClick={e => { e.preventDefault(); copy(it.url, "Listing link copied"); }}
                                                                >
                                                                    <Link2 className="h-4 w-4" />
                                                                </CardIconButton>
                                                                <Button asChild size="sm" className="ml-auto w-auto"><a href={it.url} target="_blank" rel="noopener noreferrer">Open</a></Button>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            }}
                                            components={{ Footer: () => (scrollMode === "infinite" && loading ? <div className="col-span-full flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : null) }}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <Dialog open={!!descItem} onOpenChange={open => { if (!open) setDescItem(null); }}>
                <DialogContent className="max-h-[85vh] w-[99vw] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader><DialogTitle>{descItem?.title || "Item details"}</DialogTitle><DialogDescription>Listing description and details.</DialogDescription></DialogHeader>
                    <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
                        <div className="relative h-64 w-full overflow-hidden rounded bg-muted sm:h-80 lg:h-auto lg:aspect-square">
                            {descItem?.images?.[0] ? (
                                <Image src={descItem.images[0]} alt={descItem.title || "Listing image"} className="object-cover" fill sizes="(max-width: 1024px) 100vw, 500px" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-muted-foreground"><SearchX className="h-8 w-8" aria-hidden="true" /></div>
                            )}
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3 text-sm">
                                <div className="min-w-0 space-y-1">
                                    <div className="font-medium truncate" title={descItem?.title || "Untitled"}>{descItem?.title || "Untitled"}</div>
                                    {descItem?.isNsfw && showNsfw && <Badge variant="destructive" className="w-fit">NSFW</Badge>}
                                </div>
                                <div className={`shrink-0 text-sm font-semibold tabular-nums ${descItem?.price ? "text-foreground" : "text-muted-foreground"}`}>{descItem?.price ? `L$ ${descItem.price}` : "—"}</div>
                            </div>
                            <div className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">{descItem?.description || "No description provided."}</div>
                            <div className="pt-1 flex flex-wrap gap-2">
                                {descItem?.url && <Button asChild size="sm"><a href={descItem.url} target="_blank" rel="noopener noreferrer">Open listing</a></Button>}
                                {descItem?.url && <Button size="sm" variant="outline" onClick={() => copy(descItem.url, "Listing link copied")}>Copy link</Button>}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            {compare.size >= 2 && (
                <div className="sticky bottom-0 z-20 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="text-xs text-muted-foreground">Comparing {compare.size} items</div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => copy(getCompareShareUrl(), "Compare link copied")}>Copy link</Button>
                        <Button size="sm" onClick={() => setCompareOpen(true)}>Open compare</Button>
                        <Button variant="ghost" size="sm" onClick={() => setCompare(new Set())}>Clear</Button>
                    </div>
                </div>
            )}
            <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
                <DialogContent className="max-h-[85vh] w-[99vw] sm:max-w-[90vw] overflow-y-auto">
                    <DialogHeader><DialogTitle>Compare items</DialogTitle><DialogDescription>Side-by-side overview of selected items.</DialogDescription></DialogHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {Array.from(compare).map(id => { const it = items.find(i => i.id === id) ?? comparedItems.find(i => i.id === id); if (!it) return null; const creatorName = it.creator?.name?.trim(); return (
                            <Card key={id} className="relative">
                                <Button size="icon" variant="ghost" aria-label="Remove" className="absolute top-2 right-2 z-20" onClick={() => { const next = new Set(compare); next.delete(id); setCompare(next); }}><X className="h-4 w-4" /></Button>
                                <CardContent className="p-4 space-y-3">
                                    <div className="aspect-video overflow-hidden rounded bg-muted relative">{it.images?.[0] && <Image src={it.images[0]} alt={it.title} className="object-cover" fill sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" />}</div>
                                    <div className="text-sm font-medium line-clamp-2">{it.title || "Untitled"}</div>
                                    {it.isNsfw && showNsfw && <Badge variant="destructive" className="w-fit">NSFW</Badge>}
                                    <div className="text-sm text-muted-foreground">L$ {it.price ?? "-"}</div>
                                    {creatorName && <div className="text-xs text-muted-foreground">by {creatorName}</div>}
                                    <div className="flex items-center gap-2 pt-1 flex-wrap w-full">
                                        <Button asChild size="sm" className="whitespace-nowrap"><a href={it.url} target="_blank" rel="noopener noreferrer">Open</a></Button>
                                        <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={() => copy(it.url, "Listing link copied")}>Copy link</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ); })}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
