"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

type Item = {
  id: string;
  url: string;
  title: string;
  version?: string | null;
  price?: string;
  creator?: { name: string; link: string } | null;
  store?: string | null;
  images?: string[] | null;
  description?: string | null;
  permissions?: { copy?: string; modify?: string; transfer?: string } | null;
  features?: string[] | null;
  contents?: string[] | null;
  updatedOn?: string | null;
  // New rating fields
  ratingAvg?: number | string | null;
  ratingCount?: number | null;
};

type Category = { id: string; primary: string; sub: string };

type Page = { limit: number; offset: number; total: number };

export default function Explorer() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState<Page>({ limit: 25, offset: 0, total: 0 });
  const [editing, setEditing] = useState<{ id: string; categoryIds: string[] } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<{ open: boolean; images: string[]; index: number; title: string }>(
    { open: false, images: [], index: 0, title: "" }
  );
  const [catOpen, setCatOpen] = useState(false);
  const [sort, setSort] = useState<"most" | "least">("most");
  const [isAdmin, setIsAdmin] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<Partial<Item> & { id?: string }>({});
  const commandRef = useRef<HTMLDivElement | null>(null);
  // Keyboard shortcut: Cmd/Ctrl+K to open category combobox and focus input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCatOpen(true);
        setTimeout(() => {
          commandRef.current?.querySelector<HTMLInputElement>("[cmdk-input]")?.focus();
        }, 50);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const primaries = useMemo(() => Array.from(new Set(categories.map((c) => c.primary))).sort(), [categories]);
  const subsFor = (p: string) => categories.filter((c) => c.primary === p).map((c) => ({ id: c.id, sub: c.sub }));
  const selectedCategoryLabel = useMemo(() => {
    if (!categoryId) return "All Categories";
    const cat = categories.find((c) => c.id === categoryId);
    return cat ? `${cat.primary} › ${cat.sub}` : "All Categories";
  }, [categoryId, categories]);

  const loadCategories = async () => {
    const res = await fetch("/api/tools/marketplace/categories", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setCategories(data.items || []);
    }
  };

  const loadItems = async (opts?: { categoryId?: string; q?: string; limit?: number; offset?: number; sort?: "most" | "least" }) => {
    setLoading(true);
    const sp = new URLSearchParams();
    const limit = opts?.limit ?? page.limit;
    const offset = opts?.offset ?? page.offset;
    if (opts?.categoryId ?? categoryId) sp.set("categoryId", (opts?.categoryId ?? categoryId)!);
    if (opts?.q ?? q) sp.set("q", (opts?.q ?? q)!);
    sp.set("limit", String(limit));
    sp.set("offset", String(offset));
    sp.set("sort", (opts?.sort ?? sort) as string);
    const res = await fetch(`/api/tools/marketplace/items?${sp.toString()}`, { credentials: "include" });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      const itemsData: Item[] = data.items || [];
      setItems(itemsData);
      setPage({ limit: data.limit || limit, offset: data.offset || offset, total: data.total || 0 });
      const hasFilter = Boolean((opts?.q ?? q) || (opts?.categoryId ?? categoryId));
      setDetailsOpen(hasFilter ? Object.fromEntries(itemsData.map((i) => [i.id, true])) : {});
    }
  };

  useEffect(() => {
    loadCategories();
    loadItems({ offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
     const onImported = () => loadItems({ offset: 0 });
     const onCats = () => loadCategories();
     if (typeof window !== "undefined") {
       window.addEventListener("mp:itemsImported", onImported);
       window.addEventListener("mp:categoriesChanged", onCats);
     }
     return () => {
       if (typeof window !== "undefined") {
         window.removeEventListener("mp:itemsImported", onImported);
         window.removeEventListener("mp:categoriesChanged", onCats);
       }
     };
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [page.limit]);

  // Live search: debounce on q/categoryId/sort changes
  const searchDebounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => {
      loadItems({ q, categoryId, offset: 0, sort });
    }, 300);
    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, categoryId, page.limit, sort]);

  const exportXlsx = () => {
    const rows = items.map((it) => ({
      Title: it.title,
      Version: it.version || "",
      Price: it.price || "",
      Creator: it.creator?.name || "",
      CreatorLink: it.creator?.link || "",
      Store: it.store || "",
      URL: it.url,
      Description: it.description || "",
      Images: (it.images || []).join(" | "),
      UpdatedOn: it.updatedOn || "",
      PermCopy: it.permissions?.copy || "",
      PermModify: it.permissions?.modify || "",
      PermTransfer: it.permissions?.transfer || "",
      Features: (it.features || []).join(" | "),
      Contents: (it.contents || []).join(" | "),
      Rating: typeof it.ratingCount === "number" && it.ratingCount > 0 ? `★ ${(() => {
        const avg = typeof it.ratingAvg === "string" ? parseFloat(it.ratingAvg) : (it.ratingAvg || 0);
        return avg.toFixed(1);
      })()} (${it.ratingCount})` : "-",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Items");
    XLSX.writeFile(wb, "marketplace-items.xlsx");
  };

   const onPrev = () => page.offset > 0 && loadItems({ offset: Math.max(0, page.offset - page.limit) });
   const onNext = () => page.offset + page.limit < page.total && loadItems({ offset: page.offset + page.limit });

  const toggleEditCategory = (id: string) => setEditing({ id, categoryIds: [] });
  const saveEditCategory = async () => {
    if (!editing) return;
    await fetch(`/api/tools/marketplace/items/${editing.id}/categories`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ categoryIds: editing.categoryIds }),
    });
    setEditing(null);
    loadItems();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
  };

  const openPreview = (images?: string[] | null, title?: string) => {
    const imgs = (images || []).filter(Boolean);
    if (!imgs.length) return;
    setPreview({ open: true, images: imgs, index: 0, title: title || "Images" });
  };

  const nextImg = () => setPreview((p) => ({ ...p, index: (p.index + 1) % p.images.length }));
  const prevImg = () => setPreview((p) => ({ ...p, index: (p.index - 1 + p.images.length) % p.images.length }));

  useEffect(() => {
    // check admin
    fetch("/api/tools/marketplace/admin", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  const startEdit = (it: Item) => {
    setEditDraft({ id: it.id, title: it.title, price: it.price, version: it.version ?? undefined, description: it.description ?? undefined });
    setEditOpen(true);
  };
  const saveEdit = async () => {
    if (!editDraft.id) return;
    await fetch(`/api/tools/marketplace/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: editDraft.id, updates: {
        title: editDraft.title,
        price: editDraft.price,
        version: editDraft.version ?? null,
        description: editDraft.description ?? null,
      } }),
    });
    setEditOpen(false);
    setEditDraft({});
    loadItems();
  };
  const removeItem = async (id: string) => {
    if (!confirm("Remove this item?")) return;
    await fetch(`/api/tools/marketplace/items?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    loadItems();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Explore</CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Popover open={catOpen} onOpenChange={setCatOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={catOpen}
                    className="w-[260px] justify-between"
                    title="Open categories (Ctrl/Cmd + K)"
                  >
                    <span className="truncate">{selectedCategoryLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command ref={commandRef}>
                    <CommandInput
                      placeholder="Search categories..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const first = commandRef.current?.querySelector<HTMLElement>("[cmdk-item]");
                          first?.click();
                        }
                      }}
                    />
                    <CommandList>
                      <CommandEmpty>No category found.</CommandEmpty>
                      <CommandGroup heading="General">
                        <CommandItem
                          value="__all__"
                          onSelect={() => {
                            setCategoryId("");
                            setCatOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", categoryId === "" ? "opacity-100" : "opacity-0")} />
                          All Categories
                        </CommandItem>
                      </CommandGroup>
                      {primaries.map((p) => (
                        <CommandGroup key={p} heading={p}>
                          {subsFor(p).map((s) => (
                            <CommandItem
                              key={s.id}
                              value={`${p} ${s.sub}`}
                              onSelect={() => {
                                setCategoryId(s.id);
                                setCatOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", categoryId === s.id ? "opacity-100" : "opacity-0")} />
                              {s.sub}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <div className="relative flex-1 min-w-[200px]">
                <Input className="h-9 pr-8" placeholder="Search title or description" value={q} onChange={(e) => setQ(e.target.value)} />
                {q && (
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      loadItems({ q: "", categoryId, offset: 0 });
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Sort dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9">
                    Sort: {sort === "most" ? "Most rated" : "Least rated"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setSort("most");
                      loadItems({ offset: 0, sort: "most" });
                    }}
                  >
                    Most rated
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSort("least");
                      loadItems({ offset: 0, sort: "least" });
                    }}
                  >
                    Least rated
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {loading && <Badge variant="secondary">Loading…</Badge>}
              <Button variant="outline" onClick={exportXlsx} disabled={!items.length}>Export XLSX</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Version</th>
                  <th className="px-3 py-2 text-left">Price</th>
                  <th className="px-3 py-2 text-left">Rating</th>
                  <th className="px-3 py-2 text-left">Creator</th>
                  <th className="px-3 py-2 text-left">URL</th>
                  <th className="px-3 py-2 text-left">Images</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <Fragment key={it.id}>
                    <tr className="border-t align-top">
                      <td className="px-3 py-2 max-w-[28rem]">
                        <div className="font-medium line-clamp-1">{it.title}</div>
                        <div className="mt-1">
                          <Button variant="ghost" size="sm" className="px-2 h-7"
                            onClick={() => setDetailsOpen((o) => ({ ...o, [it.id]: !o[it.id] }))
                            }>{detailsOpen[it.id] ? "Hide details" : "Details"}</Button>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{it.version || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{it.price ? `L$ ${it.price}` : ""}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {typeof it.ratingCount === "number" && it.ratingCount > 0 ? (
                          <span>
                            ★ {(() => {
                              const avg = typeof it.ratingAvg === "string" ? parseFloat(it.ratingAvg) : (it.ratingAvg || 0);
                              return avg.toFixed(1);
                            })()} ({it.ratingCount})
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {it.creator?.name ? (
                          <a
                            href={it.store || it.creator?.link || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            {it.creator.name}
                          </a>
                        ) : ""}
                      </td>
                      <td className="px-3 py-2"><a href={it.url} target="_blank" rel="noreferrer" className="underline">Open</a></td>
                      <td className="px-3 py-2">
                        {it.images?.length ? (
                          <div className="flex items-center gap-1">
                            {it.images.slice(0, 3).map((src, idx) => (
                              <button key={idx} className="h-8 w-8 overflow-hidden rounded border" onClick={() => openPreview(it.images || [], it.title)}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={src} alt={it.title} className="h-full w-full object-cover" />
                              </button>
                            ))}
                            {it.images.length > 3 && (
                              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openPreview(it.images || [], it.title)}>+{it.images.length - 3}</Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                        <Button variant="outline" size="sm" onClick={() => setDetailsOpen((o) => ({ ...o, [it.id]: !o[it.id] }))}>{detailsOpen[it.id] ? "Collapse" : "Details"}</Button>
                        <Button variant="outline" size="sm" onClick={() => toggleEditCategory(it.id)}>Categorize</Button>
                        {isAdmin && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => startEdit(it)}>Edit</Button>
                            <Button variant="destructive" size="sm" onClick={() => removeItem(it.id)}>Remove</Button>
                          </>
                        )}
                      </td>
                    </tr>
                    {detailsOpen[it.id] && (
                      <tr className="border-t">
                        <td colSpan={8} className="px-3 py-3 bg-muted/20">
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="md:col-span-2">
                              <div className="text-xs uppercase text-muted-foreground mb-1">Description</div>
                              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                                {it.description || "No description"}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs uppercase text-muted-foreground">Images</div>
                              {it.images?.length ? (
                                <div className="flex flex-wrap gap-2">
                                  {it.images.slice(0, 4).map((src, idx) => (
                                    <button key={idx} className="h-16 w-16 overflow-hidden rounded border" onClick={() => openPreview(it.images || [], it.title)}>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={src} alt={it.title} className="h-full w-full object-cover" />
                                    </button>
                                  ))}
                                  {it.images.length > 4 && (
                                    <Button variant="outline" size="sm" onClick={() => openPreview(it.images || [], it.title)}>+{it.images.length - 4} more</Button>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">No images</div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No items</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="text-muted-foreground">{page.offset + 1}-{Math.min(page.offset + page.limit, page.total)} of {page.total}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-8" disabled={page.offset === 0} onClick={onPrev}>Previous</Button>
              <Button variant="outline" className="h-8" disabled={page.offset + page.limit >= page.total} onClick={onNext}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={preview.open} onOpenChange={(o) => setPreview((p) => ({ ...p, open: o }))}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-full aspect-video overflow-hidden rounded border bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.images[preview.index]} alt={preview.title} className="h-full w-full object-contain" />
            </div>
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" onClick={prevImg}>Prev</Button>
              <div className="text-sm text-muted-foreground">{preview.index + 1} / {preview.images.length}</div>
              <Button variant="outline" onClick={nextImg}>Next</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Categories</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-hidden rounded-md border">
            <Command>
              <CommandInput placeholder="Search categories..." />
              <CommandList>
                {primaries.map((p) => (
                  <CommandGroup key={p} heading={p}>
                    {subsFor(p).map((s) => {
                      const checked = editing?.categoryIds.includes(s.id) ?? false;
                      return (
                        <CommandItem
                          key={s.id}
                          value={`${p} ${s.sub}`}
                          onSelect={() => {
                            setEditing((old) => {
                              if (!old) return old;
                              const set = new Set(old.categoryIds);
                              if (set.has(s.id)) set.delete(s.id); else set.add(s.id);
                              return { ...old, categoryIds: Array.from(set) };
                            });
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                          {s.sub}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEditCategory}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <div className="text-xs mb-1">Title</div>
              <Input value={editDraft.title ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs mb-1">Price</div>
                <Input value={editDraft.price ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs mb-1">Version</div>
                <Input value={editDraft.version ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, version: e.target.value }))} />
              </div>
            </div>
            <div>
              <div className="text-xs mb-1">Description</div>
              <Textarea value={editDraft.description ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
