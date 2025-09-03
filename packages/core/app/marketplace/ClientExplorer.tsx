"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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

type ItemsResp = { items: Item[]; total: number; limit: number; offset: number };

type CatsResp = { items: Category[] };

export default function ClientExplorer() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"most" | "least">("most");
  const [cats, setCats] = useState<Category[]>([]);
  const [primary, setPrimary] = useState<string>("");
  const [sub, setSub] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();

  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(24);
  const [loading, setLoading] = useState(false);

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
    const match = cats.find((c) => c.primary === primary && c.sub === targetSub);
    setSelectedCategoryId(match?.id);
  }, [primary, sub, cats]);

  // Load categories once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public/marketplace/categories", { cache: "no-store" });
        const data: CatsResp = await res.json();
        setCats(data.items || []);
      } catch {}
    })();
  }, []);

  // Fetch items
  async function fetchItems(options?: { reset?: boolean; pageIndex?: number }) {
    const { reset = false, pageIndex } = options ?? {};
    if (loading) return;
    setLoading(true);
    try {
      const effectivePage = typeof pageIndex === "number" ? pageIndex : page;
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
      if (sort) params.set("sort", sort);
      params.set("limit", String(limit));
      params.set("offset", String(effectivePage * limit));
      const res = await fetch(`/api/public/marketplace/items?${params.toString()}`, {
        cache: "no-store",
      });
      const data: ItemsResp = await res.json();
      setTotal(data.total || 0);
      setItems((prev) => (reset ? data.items || [] : [...prev, ...(data.items || [])]));
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
    // on page change, fetch next page chunk and append (no reset)
    fetchItems({ reset: false, pageIndex: clamped });
  }

  return (
    <div className="grid grid-rows-[auto_1fr_auto] gap-4 h-[calc(100vh-7rem)] min-h-0">
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-xl">
          <Input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort</span>
          <Select value={sort} onValueChange={(v: any) => setSort(v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="most">Most rated</SelectItem>
              <SelectItem value="least">Least rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Per page</span>
          <Select value={String(limit)} onValueChange={(v) => setLimit(parseInt(v, 10))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[12, 24, 36, 48].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 min-h-0">
        {/* Sidebar with its own scroll */}
        <Card className="min-h-0">
          <CardContent className="p-0 h-full">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-3">
                <div className="text-xs font-medium text-muted-foreground px-1">Categories</div>
                <Button
                  variant={primary === "" ? "secondary" : "ghost"}
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
                      variant={primary === p && !sub ? "secondary" : "ghost"}
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
                            variant={primary === p && sub === s ? "secondary" : "ghost"}
                            className="w-full justify-start"
                            onClick={() => setSub(s)}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 pr-2">
                {items.map((it) => {
                  const creatorName = it.creator?.name?.trim();
                  const creatorLink = it.creator?.link?.trim();
                  const storeLink = it.store?.trim();
                  const showStore = storeLink && storeLink !== creatorLink;
                  return (
                    <Card key={it.id} className="group">
                      <CardContent className="p-3 space-y-2">
                        <a href={it.url} target="_blank" rel="noopener noreferrer" className="block">
                          <div className="aspect-video overflow-hidden rounded bg-muted">
                            {it.images?.[0] && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={it.images[0]}
                                alt={it.title}
                                className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                              />
                            )}
                          </div>
                          <div className="space-y-1 mt-2">
                            <div className="line-clamp-2 text-sm font-medium">{it.title || "Untitled"}</div>
                            <div className="text-xs text-muted-foreground">L$ {it.price ?? "-"}</div>
                          </div>
                        </a>
                        {(creatorName || creatorLink || storeLink) && (
                          <div className="text-[11px] text-muted-foreground">
                            {creatorName ? (
                              <>
                                by{" "}
                                {creatorLink ? (
                                  <a
                                    className="underline underline-offset-4 hover:no-underline"
                                    href={creatorLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {creatorName}
                                  </a>
                                ) : (
                                  <span>{creatorName}</span>
                                )}
                              </>
                            ) : null}
                            {showStore ? (
                              <>
                                {creatorName ? <span>{" · "}</span> : null}
                                <a
                                  className="underline underline-offset-4 hover:no-underline"
                                  href={storeLink!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Store
                                </a>
                              </>
                            ) : null}
                          </div>
                        )}
                        {it.description && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">View description</Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[80vh] w-[92vw] sm:w-[600px] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="text-base">{it.title || "Description"}</DialogTitle>
                                <DialogDescription>Listing description</DialogDescription>
                              </DialogHeader>
                              <div className="whitespace-pre-line break-words text-sm text-muted-foreground">
                                {it.description}
                              </div>
                              <DialogFooter>
                                <Button asChild>
                                  <a href={it.url} target="_blank" rel="noopener noreferrer">Open listing</a>
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="py-2">
        <Pagination>
          <PaginationContent ref={{ current: null } as any}>
            <PaginationItem ref={{ current: null } as any}>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  const next = page - 1;
                  if (next >= 0) {
                    fetchItems({ reset: true, pageIndex: next });
                  }
                }}
              />
            </PaginationItem>
            <PaginationItem ref={{ current: null } as any}>
              <PaginationLink href="#" isActive>
                {page + 1} / {Math.max(1, Math.ceil(total / limit))}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem ref={{ current: null } as any}>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  const next = page + 1;
                  if (next * limit < total) {
                    fetchItems({ reset: true, pageIndex: next });
                  }
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
