"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";

type Item = {
    id: string;
    url: string;
    title: string;
    isNsfw?: boolean | null;
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
    const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
    const [preview, setPreview] = useState<{
        open: boolean;
        images: string[];
        index: number;
        title: string;
    }>({ open: false, images: [], index: 0, title: "" });
    const [catOpen, setCatOpen] = useState(false);
    const [sort, setSort] = useState<"most" | "least">("most");
    const [isAdmin, setIsAdmin] = useState(false);
    const [bulkNsfwSaving, setBulkNsfwSaving] = useState(false);
    const [bulkTagSaving, setBulkTagSaving] = useState(false);
    const [bulkDeleteSaving, setBulkDeleteSaving] = useState(false);
    const [selectFilteredLoading, setSelectFilteredLoading] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
    const [bulkTagOpen, setBulkTagOpen] = useState(false);
    const [bulkTagMode, setBulkTagMode] = useState<"add" | "remove">("add");
    const [editOpen, setEditOpen] = useState(false);
    type EditDraft = Partial<Item> & {
        id?: string;
        // extra editable fields for full control
        creatorName?: string;
        creatorLink?: string;
        imagesText?: string;
        featuresText?: string;
        contentsText?: string;
        permCopy?: string;
        permModify?: string;
        permTransfer?: string;
        url?: string;
        store?: string | null;
    };
    const [editDraft, setEditDraft] = useState<EditDraft>({});
    const commandRef = useRef<HTMLDivElement | null>(null);

    // NEW filters
    const [lastImportedIds, setLastImportedIds] = useState<string[]>([]);
    const [justImported, setJustImported] = useState(false);
    const [onlyUncategorized, setOnlyUncategorized] = useState(false);
    const [sinceMinutes, setSinceMinutes] = useState<number | null>(null);

    // NEW: track when categories finished loading
    const [catsLoaded, setCatsLoaded] = useState(false);

    // NEW: cache of selected category IDs per itemId for quick display/save
    const [itemCats, setItemCats] = useState<Record<string, string[]>>({});

    // Map category id -> category for labels
    const catById = useMemo(() => {
        const map: Record<string, Category> = {};
        for (const c of categories) map[c.id] = c;
        return map;
    }, [categories]);

    // Helper to fetch an item's current categories (lazy)
    const fetchItemCats = async (id: string) => {
        try {
            const res = await fetch(
                `/api/tools/marketplace/items/${id}/categories`,
                { credentials: "include" },
            );
            if (!res.ok) return;
            const data = await res.json();
            const ids: string[] = Array.isArray(data?.items)
                ? data.items.map((r: any) => r.id)
                : [];
            setItemCats((m) => ({ ...m, [id]: ids }));
        } catch {}
    };

    const loadCategories = async () => {
        // use lighter endpoint optimized for the picker
        const res = await fetch("/api/tools/marketplace/items/categories", {
            credentials: "include",
        });
        if (res.ok) {
            const data = await res.json();
            setCategories(data.items || []);
            setCatsLoaded(true);
        } else {
            setCatsLoaded(true);
        }
    };

    // Abort/cancel in-flight item requests to avoid race conditions while typing/toggling filters
    const itemsReqSeq = useRef(0);
    const itemsAbortRef = useRef<AbortController | null>(null);
    const loadItems = async (opts?: {
        categoryId?: string;
        q?: string;
        limit?: number;
        offset?: number;
        sort?: "most" | "least";
        preserveDetails?: boolean;
        ids?: string[];
        uncategorized?: boolean;
        sinceMinutes?: number | null;
    }) => {
        // cancel previous
        itemsAbortRef.current?.abort();
        const seq = ++itemsReqSeq.current;
        const ctrl = new AbortController();
        itemsAbortRef.current = ctrl;

        setLoading(true);
        const sp = new URLSearchParams();
        const limit = opts?.limit ?? page.limit;
        const offset = opts?.offset ?? page.offset;
        if (opts?.categoryId ?? categoryId)
            sp.set("categoryId", (opts?.categoryId ?? categoryId)!);
        if (opts?.q ?? q) sp.set("q", (opts?.q ?? q)!);
        sp.set("limit", String(limit));
        sp.set("offset", String(offset));
        sp.set("sort", (opts?.sort ?? sort) as string);
        const idsArg = opts?.ids ?? (justImported ? lastImportedIds : []);
        if (idsArg && idsArg.length) sp.set("ids", idsArg.join(","));
        const unc = opts?.uncategorized ?? onlyUncategorized;
        if (unc) sp.set("uncategorized", "true");
        const sm = opts?.sinceMinutes ?? sinceMinutes;
        if (typeof sm === "number" && sm > 0)
            sp.set("sinceMinutes", String(sm));

        try {
            const res = await fetch(
                `/api/tools/marketplace/items?${sp.toString()}`,
                { credentials: "include", signal: ctrl.signal },
            );
            if (seq !== itemsReqSeq.current) return; // stale
            setLoading(false);
            if (res.ok) {
                const data = await res.json();
                const itemsData: Item[] = data.items || [];
                setItems(itemsData);
                setPage({
                    limit: data.limit || limit,
                    offset: data.offset || offset,
                    total: data.total || 0,
                });
                if (!opts?.preserveDetails) setDetailsOpen({});
            }
        } catch (e: any) {
            if (e?.name === "AbortError") return; // ignore
            if (seq !== itemsReqSeq.current) return;
            setLoading(false);
        }
    };

    // Load last imported ids from session and subscribe to future imports
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem("mp:lastImportedIds");
            const ids = raw ? (JSON.parse(raw) as string[]) : [];
            if (Array.isArray(ids)) setLastImportedIds(ids);
        } catch {}
        const onImported = (e: any) => {
            const ids: string[] = e?.detail?.ids || [];
            if (Array.isArray(ids) && ids.length) {
                setLastImportedIds(ids);
                setJustImported(true);
                // Auto-refresh to show the batch
                loadItems({ offset: 0, ids, preserveDetails: false });
            }
        };
        window.addEventListener("mp:itemsImported" as any, onImported);
        return () =>
            window.removeEventListener("mp:itemsImported" as any, onImported);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Prefetch current categories for the first few visible items to avoid initial delay when opening picker
    useEffect(() => {
        const ids = items.slice(0, 8).map((i) => i.id);
        ids.forEach((id) => {
            if (itemCats[id] === undefined) fetchItemCats(id);
        });
    }, [items, itemCats]);

    // Keyboard shortcut: Cmd/Ctrl+K to open category combobox and focus input
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setCatOpen(true);
                setTimeout(() => {
                    commandRef.current
                        ?.querySelector<HTMLInputElement>("[cmdk-input]")
                        ?.focus();
                }, 50);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const primaries = useMemo(
        () => Array.from(new Set(categories.map((c) => c.primary))).sort(),
        [categories],
    );
    const subsFor = (p: string) =>
        categories
            .filter((c) => c.primary === p)
            .map((c) => ({ id: c.id, sub: c.sub }));
    const selectedCategoryLabel = useMemo(() => {
        if (!categoryId) return "All Categories";
        const cat = categories.find((c) => c.id === categoryId);
        return cat ? `${cat.primary} › ${cat.sub}` : "All Categories";
    }, [categoryId, categories]);

    // Load admin status once to gate edit/remove UI
    useEffect(() => {
        (async () => {
            try {
                const r = await fetch("/api/tools/marketplace/admin", {
                    credentials: "include",
                });
                const d = await r.json();
                setIsAdmin(!!d?.isAdmin);
            } catch {}
        })();
    }, []);

    // Load categories and first page on mount
    useEffect(() => {
        loadCategories();
        loadItems({ offset: 0 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // After items load, batch fetch their category ids once
    useEffect(() => {
        const need = items
            .filter((i) => itemCats[i.id] === undefined)
            .map((i) => i.id);
        if (!need.length) return;
        (async () => {
            try {
                const res = await fetch(
                    `/api/tools/marketplace/items/categories/batch`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ itemIds: need }),
                    },
                );
                if (!res.ok) return;
                const data = await res.json();
                const grouped: Record<string, string[]> = {};
                for (const m of (data?.mappings || []) as Array<{
                    itemId: string;
                    categoryId: string;
                }>) {
                    if (!grouped[m.itemId]) grouped[m.itemId] = [];
                    grouped[m.itemId].push(m.categoryId);
                }
                setItemCats((old) => ({ ...old, ...grouped }));
            } catch {}
        })();
    }, [items, itemCats]);

    // Live search: debounce on filter changes too
    const searchDebounceRef = useRef<number | null>(null);
    useEffect(() => {
        if (searchDebounceRef.current)
            window.clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = window.setTimeout(() => {
            loadItems({
                q,
                categoryId,
                offset: 0,
                sort,
                ids: justImported ? lastImportedIds : [],
                uncategorized: onlyUncategorized,
                sinceMinutes,
            });
        }, 300);
        return () => {
            if (searchDebounceRef.current)
                window.clearTimeout(searchDebounceRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        q,
        categoryId,
        page.limit,
        sort,
        justImported,
        onlyUncategorized,
        sinceMinutes,
        lastImportedIds,
    ]);

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
            Rating:
                typeof it.ratingCount === "number" && it.ratingCount > 0
                    ? `★ ${(() => {
                          const avg =
                              typeof it.ratingAvg === "string"
                                  ? parseFloat(it.ratingAvg)
                                  : it.ratingAvg || 0;
                          return avg.toFixed(1);
                      })()} (${it.ratingCount})`
                    : "-",
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Items");
        XLSX.writeFile(wb, "marketplace-items.xlsx");
    };

    // Image preview helpers
    const openPreview = (images?: string[] | null, title?: string) => {
        const imgs = (images || []).filter(Boolean);
        if (!imgs.length) return;
        setPreview({
            open: true,
            images: imgs,
            index: 0,
            title: title || "Images",
        });
    };
    const nextImg = () =>
        setPreview((p) => ({ ...p, index: (p.index + 1) % p.images.length }));
    const prevImg = () =>
        setPreview((p) => ({
            ...p,
            index: (p.index - 1 + p.images.length) % p.images.length,
        }));

    // Inline category picker for each item: shows badges and a searchable popover; saves on close
    function CategoryPicker({ itemId }: { itemId: string }) {
        const [open, setOpen] = useState(false);
        const [draft, setDraft] = useState<string[] | null>(null);
        const [saving, setSaving] = useState(false);
        const saveDebounceRef = useRef<number | null>(null);
        const draftRef = useRef<string[]>([]);
        const saveSeqRef = useRef(0);

        const selectedFromStore = itemCats[itemId];
        const selected = draft ?? selectedFromStore ?? [];

        useEffect(() => {
            if (open) {
                if (!catsLoaded) void loadCategories();
                if (itemCats[itemId] === undefined) void fetchItemCats(itemId);
                const base = selectedFromStore ?? [];
                setDraft(base);
                draftRef.current = base;
            } else {
                setDraft(null);
                draftRef.current = [];
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [open]);

        const scheduleSave = () => {
            if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current);
            saveDebounceRef.current = window.setTimeout(() => {
                const before = selectedFromStore ?? [];
                const after = draftRef.current;
                const changed = before.length !== after.length || before.some((b) => !after.includes(b));
                if (changed) void save(after);
            }, 400);
        };

        const toggle = (id: string) => {
            setDraft((d) => {
                const base = (d ?? selected).slice();
                const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
                draftRef.current = next;
                return next;
            });
            scheduleSave();
        };

        const save = async (finalIds: string[]) => {
            const seq = ++saveSeqRef.current;
            try {
                setSaving(true);
                await fetch(`/api/tools/marketplace/items/${itemId}/categories`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ categoryIds: finalIds }),
                });
                if (seq === saveSeqRef.current) {
                    setItemCats((m) => ({ ...m, [itemId]: finalIds }));
                }
            } catch {
                // ignore
            } finally {
                if (seq === saveSeqRef.current) setSaving(false);
            }
        };

        const onOpenChange = (o: boolean) => {
            if (open && !o) {
                if (saveDebounceRef.current) {
                    window.clearTimeout(saveDebounceRef.current);
                    saveDebounceRef.current = null;
                }
                const before = selectedFromStore ?? [];
                const after = draftRef.current;
                const changed = before.length !== after.length || before.some((b) => !after.includes(b));
                if (changed) void save(after);
            }
            setOpen(o);
        };

        const labelFor = (id: string) => {
            const c = catById[id];
            return c ? `${c.primary} › ${c.sub}` : id;
        };

        const nothingLoaded = !catsLoaded || selectedFromStore === undefined;

        return (
            <div className="space-y-1">
                <div className="flex flex-wrap gap-1 min-h-[1.25rem]">
                    {selected.length ? (
                        selected.map((id) => (
                            <Badge
                                key={id}
                                variant="secondary"
                                title={labelFor(id)}
                            >
                                {labelFor(id)}
                            </Badge>
                        ))
                    ) : nothingLoaded ? (
                        <span className="text-xs text-muted-foreground">
                            Loading…
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground">
                            None
                        </span>
                    )}
                </div>
                <Popover open={open} onOpenChange={onOpenChange}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                        >
                            {saving ? (
                                <span className="inline-flex items-center"><RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Saving…</span>
                            ) : (
                                "Manage"
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0">
                        <Command>
                            <CommandInput placeholder="Search categories…" />
                            <CommandList>
                                <CommandEmpty>No results.</CommandEmpty>
                                <CommandGroup heading="Categories">
                                    {categories.map((c) => (
                                        <CommandItem
                                            key={c.id}
                                            value={`${c.primary} ${c.sub}`}
                                            onSelect={() => toggle(c.id)}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selected.includes(c.id)
                                                        ? "opacity-100"
                                                        : "opacity-0",
                                                )}
                                            />
                                            {c.primary} › {c.sub}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
        );
    }

    const onPrev = () =>
        page.offset > 0 &&
        loadItems({ offset: Math.max(0, page.offset - page.limit) });
    const onNext = () =>
        page.offset + page.limit < page.total &&
        loadItems({ offset: page.offset + page.limit });

    const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
    const selectedCount = selectedItemIds.length;
    const selectedVisibleCount = useMemo(
        () => items.filter((it) => selectedSet.has(it.id)).length,
        [items, selectedSet],
    );
    const allVisibleSelected = items.length > 0 && selectedVisibleCount === items.length;

    const toggleSelectItem = (itemId: string, checked: boolean) => {
        setSelectedItemIds((prev) => {
            if (checked) {
                if (prev.includes(itemId)) return prev;
                return [...prev, itemId];
            }
            return prev.filter((id) => id !== itemId);
        });
    };

    const toggleSelectVisible = () => {
        const visibleIds = items.map((it) => it.id);
        setSelectedItemIds((prev) => {
            if (allVisibleSelected) {
                return prev.filter((id) => !visibleIds.includes(id));
            }
            const next = new Set(prev);
            visibleIds.forEach((id) => next.add(id));
            return Array.from(next);
        });
    };

    const selectAllFiltered = async () => {
        try {
            setSelectFilteredLoading(true);
            const sp = new URLSearchParams();
            if (categoryId) sp.set("categoryId", categoryId);
            if (q) sp.set("q", q);
            sp.set("sort", sort);
            const idsArg = justImported ? lastImportedIds : [];
            if (idsArg.length) sp.set("ids", idsArg.join(","));
            if (onlyUncategorized) sp.set("uncategorized", "true");
            if (typeof sinceMinutes === "number" && sinceMinutes > 0) {
                sp.set("sinceMinutes", String(sinceMinutes));
            }
            sp.set("idsOnly", "true");

            const res = await fetch(
                `/api/tools/marketplace/items?${sp.toString()}`,
                { credentials: "include" },
            );
            if (!res.ok) {
                alert("Failed to select filtered items.");
                return;
            }
            const data = await res.json();
            const ids: string[] = Array.isArray(data?.ids)
                ? data.ids.filter(
                      (value: unknown): value is string =>
                          typeof value === "string",
                  )
                : [];
            setSelectedItemIds(ids);
        } finally {
            setSelectFilteredLoading(false);
        }
    };

    const clearSelection = () => setSelectedItemIds([]);

    const startEdit = (it: Item) => {
        setEditDraft({
            id: it.id,
            title: it.title,
            price: it.price,
            version: it.version ?? undefined,
            description: it.description ?? undefined,
            url: it.url,
            store: it.store ?? undefined,
            creatorName: it.creator?.name ?? "",
            creatorLink: it.creator?.link ?? "",
            imagesText: (it.images || []).join("\n"),
            featuresText: (it.features || []).join("\n"),
            contentsText: (it.contents || []).join("\n"),
            permCopy: it.permissions?.copy ?? "",
            permModify: it.permissions?.modify ?? "",
            permTransfer: it.permissions?.transfer ?? "",
        });
        setEditOpen(true);
    };
    const saveEdit = async () => {
        if (!editDraft.id) return;
        const images = (editDraft.imagesText || "")
            .split(/\r?\n|, /)
            .map((s) => s.trim())
            .filter(Boolean);
        const features = (editDraft.featuresText || "")
            .split(/\r?\n|, /)
            .map((s) => s.trim())
            .filter(Boolean);
        const contents = (editDraft.contentsText || "")
            .split(/\r?\n|, /)
            .map((s) => s.trim())
            .filter(Boolean);
        const creator =
            editDraft.creatorName || editDraft.creatorLink
                ? {
                      name: editDraft.creatorName || "",
                      link: editDraft.creatorLink || "",
                  }
                : null;
        const permissions =
            editDraft.permCopy || editDraft.permModify || editDraft.permTransfer
                ? {
                      copy: editDraft.permCopy || null,
                      modify: editDraft.permModify || null,
                      transfer: editDraft.permTransfer || null,
                  }
                : null;

        await fetch(`/api/tools/marketplace/items`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                id: editDraft.id,
                updates: {
                    title: editDraft.title,
                    price: editDraft.price,
                    version: editDraft.version ?? null,
                    description: editDraft.description ?? null,
                    url: editDraft.url,
                    store: editDraft.store ?? null,
                    creator,
                    images,
                    features,
                    contents,
                    permissions,
                },
            }),
        });
        setEditOpen(false);
        setEditDraft({});
        loadItems();
    };
    const removeItem = async (id: string) => {
        if (!confirm("Remove this item?")) return;
        await fetch(
            `/api/tools/marketplace/items?id=${encodeURIComponent(id)}`,
            { method: "DELETE", credentials: "include" },
        );
        loadItems();
    };

    const bulkSetNsfw = async (value: boolean) => {
        const ids = selectedItemIds.filter(Boolean);
        if (!ids.length) return;

        const label = value ? "NSFW" : "not NSFW";
        if (!confirm(`Mark ${ids.length} selected item(s) as ${label}?`)) return;

        try {
            setBulkNsfwSaving(true);
            const res = await fetch(`/api/tools/marketplace/items`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ ids, updates: { isNsfw: value } }),
            });
            if (!res.ok) {
                alert("Failed to update NSFW tags.");
                return;
            }
            await loadItems({ preserveDetails: true });
        } finally {
            setBulkNsfwSaving(false);
        }
    };

    const bulkApplyCategory = async (
        mode: "add" | "remove",
        categoryId: string,
    ) => {
        const ids = selectedItemIds.filter(Boolean);
        if (!ids.length || !categoryId) return;
        const action = mode === "add" ? "add" : "remove";
        if (!confirm(`${action === "add" ? "Add" : "Remove"} this tag for ${ids.length} selected item(s)?`)) {
            return;
        }

        try {
            setBulkTagSaving(true);
            const res = await fetch(`/api/tools/marketplace/items/categories/batch`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    itemIds: ids,
                    categoryIds: [categoryId],
                    mode,
                }),
            });
            if (!res.ok) {
                alert("Failed to update tags.");
                return;
            }

            setBulkTagOpen(false);
            await loadItems({ preserveDetails: true });
        } finally {
            setBulkTagSaving(false);
        }
    };

    const bulkDeleteSelected = async () => {
        const ids = selectedItemIds.filter(Boolean);
        if (!ids.length) return;
        if (!confirm(`Delete ${ids.length} selected item(s)? This cannot be undone.`)) {
            return;
        }

        try {
            setBulkDeleteSaving(true);
            const res = await fetch(`/api/tools/marketplace/items`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ ids }),
            });
            if (!res.ok) {
                alert("Failed to delete selected items.");
                return;
            }
            clearSelection();
            await loadItems({ preserveDetails: false });
        } finally {
            setBulkDeleteSaving(false);
        }
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
                                        <span className="truncate">
                                            {selectedCategoryLabel}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                    <Command ref={commandRef}>
                                        <CommandInput
                                            placeholder="Search categories..."
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    const first =
                                                        commandRef.current?.querySelector<HTMLElement>(
                                                            "[cmdk-item]",
                                                        );
                                                    first?.click();
                                                }
                                            }}
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                No category found.
                                            </CommandEmpty>
                                            <CommandGroup heading="General">
                                                <CommandItem
                                                    value="__all__"
                                                    onSelect={() => {
                                                        setCategoryId("");
                                                        setCatOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            categoryId === ""
                                                                ? "opacity-100"
                                                                : "opacity-0",
                                                        )}
                                                    />
                                                    All Categories
                                                </CommandItem>
                                            </CommandGroup>
                                            {primaries.map((p) => (
                                                <CommandGroup
                                                    key={p}
                                                    heading={p}
                                                >
                                                    {subsFor(p).map((s) => (
                                                        <CommandItem
                                                            key={s.id}
                                                            value={`${p} ${s.sub}`}
                                                            onSelect={() => {
                                                                setCategoryId(
                                                                    s.id,
                                                                );
                                                                setCatOpen(
                                                                    false,
                                                                );
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    categoryId ===
                                                                        s.id
                                                                        ? "opacity-100"
                                                                        : "opacity-0",
                                                                )}
                                                            />
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
                                <Input
                                    className="h-9 pr-8"
                                    placeholder="Search title or description"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                />
                                {loading ? (
                                    <RefreshCw className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground pointer-events-none" />
                                ) : q ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setQ("");
                                            loadItems({
                                                q: "",
                                                categoryId,
                                                offset: 0,
                                            });
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        aria-label="Clear search"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Sort dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-9">
                                        Sort:{" "}
                                        {sort === "most"
                                            ? "Most rated"
                                            : "Least rated"}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setSort("most");
                                            loadItems({
                                                offset: 0,
                                                sort: "most",
                                            });
                                        }}
                                    >
                                        Most rated
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setSort("least");
                                            loadItems({
                                                offset: 0,
                                                sort: "least",
                                            });
                                        }}
                                    >
                                        Least rated
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            {/* NEW: Batch and filters */}
                            <Button
                                variant={justImported ? "default" : "outline"}
                                className="h-9"
                                disabled={!lastImportedIds.length}
                                title={
                                    lastImportedIds.length
                                        ? `Filter to last imported batch (${lastImportedIds.length})`
                                        : "No recent import in this session"
                                }
                                onClick={() => {
                                    const next = !justImported;
                                    setJustImported(next);
                                    loadItems({
                                        offset: 0,
                                        ids: next ? lastImportedIds : [],
                                        preserveDetails: false,
                                    });
                                }}
                            >
                                Just imported
                            </Button>
                            <Button
                                variant={
                                    onlyUncategorized ? "default" : "outline"
                                }
                                className="h-9"
                                onClick={() => {
                                    const next = !onlyUncategorized;
                                    setOnlyUncategorized(next);
                                    loadItems({
                                        offset: 0,
                                        uncategorized: next,
                                        preserveDetails: false,
                                    });
                                }}
                            >
                                Uncategorized
                            </Button>
                            {isAdmin && (
                                <>
                                    <Button
                                        variant="outline"
                                        className="h-9"
                                        onClick={toggleSelectVisible}
                                        disabled={!items.length}
                                    >
                                        {allVisibleSelected
                                            ? "Unselect page"
                                            : "Select page"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-9"
                                        onClick={selectAllFiltered}
                                        disabled={!page.total || selectFilteredLoading}
                                    >
                                        {selectFilteredLoading
                                            ? "Selecting…"
                                            : `Select filtered (${page.total})`}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-9"
                                        onClick={clearSelection}
                                        disabled={!selectedCount}
                                    >
                                        Clear ({selectedCount})
                                    </Button>
                                </>
                            )}
                            {isAdmin && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-9"
                                            disabled={!selectedCount || bulkNsfwSaving}
                                        >
                                            {bulkNsfwSaving
                                                ? "Applying…"
                                                : "Bulk NSFW"}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onClick={() => bulkSetNsfw(true)}
                                        >
                                            Mark selected as NSFW
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => bulkSetNsfw(false)}
                                        >
                                            Mark selected as SFW
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            {isAdmin && (
                                <Popover
                                    open={bulkTagOpen}
                                    onOpenChange={setBulkTagOpen}
                                >
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-9"
                                            disabled={
                                                !selectedCount ||
                                                bulkTagSaving ||
                                                !categories.length
                                            }
                                        >
                                            {bulkTagSaving
                                                ? "Applying tags…"
                                                : "Bulk Tags"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[340px] p-0" align="end">
                                        <div className="flex items-center gap-2 border-b p-2">
                                            <Button
                                                size="sm"
                                                variant={
                                                    bulkTagMode === "add"
                                                        ? "default"
                                                        : "outline"
                                                }
                                                onClick={() => setBulkTagMode("add")}
                                            >
                                                Add
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={
                                                    bulkTagMode === "remove"
                                                        ? "default"
                                                        : "outline"
                                                }
                                                onClick={() =>
                                                    setBulkTagMode("remove")
                                                }
                                            >
                                                Remove
                                            </Button>
                                            <span className="text-xs text-muted-foreground ml-auto">
                                                {selectedCount} selected
                                            </span>
                                        </div>
                                        <Command>
                                            <CommandInput placeholder="Search categories…" />
                                            <CommandList>
                                                <CommandEmpty>
                                                    No category found.
                                                </CommandEmpty>
                                                <CommandGroup heading="Categories">
                                                    {categories.map((c) => (
                                                        <CommandItem
                                                            key={c.id}
                                                            value={`${c.primary} ${c.sub}`}
                                                            onSelect={() =>
                                                                bulkApplyCategory(
                                                                    bulkTagMode,
                                                                    c.id,
                                                                )
                                                            }
                                                        >
                                                            {c.primary} › {c.sub}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            )}
                            {isAdmin && (
                                <Button
                                    variant="destructive"
                                    className="h-9"
                                    disabled={!selectedCount || bulkDeleteSaving}
                                    onClick={bulkDeleteSelected}
                                >
                                    {bulkDeleteSaving
                                        ? "Deleting…"
                                        : `Delete (${selectedCount})`}
                                </Button>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-9">
                                        Rows: {page.limit}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {[25, 50, 100].map((size) => (
                                        <DropdownMenuItem
                                            key={size}
                                            onClick={() => {
                                                setPage((p) => ({
                                                    ...p,
                                                    limit: size,
                                                    offset: 0,
                                                }));
                                                loadItems({
                                                    limit: size,
                                                    offset: 0,
                                                });
                                            }}
                                        >
                                            Show {size}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-9">
                                        Time:{" "}
                                        {sinceMinutes
                                            ? sinceMinutes >= 1440
                                                ? "24h"
                                                : sinceMinutes >= 60
                                                  ? "1h"
                                                  : `${sinceMinutes}m`
                                            : "Any"}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setSinceMinutes(null);
                                            loadItems({
                                                offset: 0,
                                                sinceMinutes: null,
                                            });
                                        }}
                                    >
                                        Any
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setSinceMinutes(10);
                                            loadItems({
                                                sinceMinutes: 10,
                                            });
                                        }}
                                    >
                                        Last 10m
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setSinceMinutes(60);
                                            loadItems({
                                                sinceMinutes: 60,
                                            });
                                        }}
                                    >
                                        Last 1h
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setSinceMinutes(1440);
                                            loadItems({
                                                sinceMinutes: 1440,
                                            });
                                        }}
                                    >
                                        Last 24h
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                                variant="outline"
                                onClick={exportXlsx}
                                disabled={!items.length}
                            >
                                Export XLSX
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    {isAdmin && (
                                        <th className="px-3 py-2 text-left w-10">
                                            <Checkbox
                                                checked={
                                                    allVisibleSelected
                                                        ? true
                                                        : selectedVisibleCount > 0
                                                          ? "indeterminate"
                                                          : false
                                                }
                                                onCheckedChange={() =>
                                                    toggleSelectVisible()
                                                }
                                                aria-label="Select visible items"
                                            />
                                        </th>
                                    )}
                                    <th className="px-3 py-2 text-left">
                                        Title
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                        Version
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                        Price
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                        Rating
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                        Creator
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                        Categories
                                    </th>
                                    {/* NEW column */}
                                    <th className="px-3 py-2 text-left">URL</th>
                                    <th className="px-3 py-2 text-left">
                                        Images
                                    </th>
                                    <th className="px-3 py-2 text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((it) => (
                                    <Fragment key={it.id}>
                                        <tr className="border-t align-top">
                                            {isAdmin && (
                                                <td className="px-3 py-2 align-top">
                                                    <Checkbox
                                                        checked={selectedSet.has(it.id)}
                                                        onCheckedChange={(checked) =>
                                                            toggleSelectItem(
                                                                it.id,
                                                                checked === true,
                                                            )
                                                        }
                                                        aria-label={`Select ${it.title}`}
                                                    />
                                                </td>
                                            )}
                                            <td className="px-3 py-2 max-w-[28rem]">
                                                <div className="font-medium line-clamp-1">
                                                    {it.title}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {it.version || "-"}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {it.price
                                                    ? `L$ ${it.price}`
                                                    : ""}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {typeof it.ratingCount ===
                                                    "number" &&
                                                it.ratingCount > 0 ? (
                                                    <span>
                                                        ★{" "}
                                                        {(() => {
                                                            const avg =
                                                                typeof it.ratingAvg ===
                                                                "string"
                                                                    ? parseFloat(
                                                                          it.ratingAvg,
                                                                      )
                                                                    : it.ratingAvg ||
                                                                      0;
                                                            return avg.toFixed(
                                                                1,
                                                            );
                                                        })()}{" "}
                                                        ({it.ratingCount})
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        -
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {it.creator?.name ? (
                                                    <a
                                                        href={
                                                            it.store ||
                                                            it.creator?.link ||
                                                            "#"
                                                        }
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="underline"
                                                    >
                                                        {it.creator.name}
                                                    </a>
                                                ) : (
                                                    ""
                                                )}
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <CategoryPicker
                                                    itemId={it.id}
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <a
                                                    href={it.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="underline"
                                                >
                                                    Open
                                                </a>
                                            </td>
                                            <td className="px-3 py-2">
                                                {it.images?.length ? (
                                                    <div className="flex items-center gap-1">
                                                        {it.images
                                                            .slice(0, 3)
                                                            .map((src, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    className="h-8 w-8 overflow-hidden rounded border relative"
                                                                    onClick={() =>
                                                                        openPreview(
                                                                            it.images || [],
                                                                            it.title,
                                                                        )
                                                                    }
                                                                >
                                                                    <Image
                                                                        src={src}
                                                                        alt={it.title}
                                                                        fill
                                                                        sizes="(max-width: 768px) 32px, 32px"
                                                                        className="object-cover"
                                                                    />
                                                                </button>
                                                            ))}
                                                        {it.images.length > 3 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2"
                                                                onClick={() =>
                                                                    openPreview(
                                                                        it.images || [],
                                                                        it.title,
                                                                    )
                                                                }
                                                            >
                                                                +{it.images.length - 3}
                                                            </Button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        setDetailsOpen((o) => ({
                                                            ...o,
                                                            [it.id]: !o[it.id],
                                                        }))
                                                    }
                                                >
                                                    {detailsOpen[it.id]
                                                        ? "Collapse"
                                                        : "Details"}
                                                </Button>
                                                {isAdmin && (
                                                    <>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                startEdit(it)
                                                            }
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() =>
                                                                removeItem(
                                                                    it.id,
                                                                )
                                                            }
                                                        >
                                                            Remove
                                                        </Button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                        {detailsOpen[it.id] && (
                                            <tr className="border-t">
                                                {/* colSpan increased by 1 due to new Categories column */}
                                                <td
                                                    colSpan={isAdmin ? 10 : 9}
                                                    className="px-3 py-3 bg-muted/20"
                                                >
                                                    <div className="grid gap-3 md:grid-cols-3">
                                                        <div className="md:col-span-2">
                                                            <div className="text-xs uppercase text-muted-foreground mb-1">
                                                                Description
                                                            </div>
                                                            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                                                                {it.description ||
                                                                    "No description"}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="text-xs uppercase text-muted-foreground">
                                                                Images
                                                            </div>
                                                            {it.images?.length ? (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {it.images
                                                                        .slice(0, 4)
                                                                        .map((src, idx) => (
                                                                            <button
                                                                                key={idx}
                                                                                className="h-16 w-16 overflow-hidden rounded border relative"
                                                                                onClick={() =>
                                                                                    openPreview(
                                                                                        it.images || [],
                                                                                        it.title,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <Image
                                                                                    src={src}
                                                                                    alt={it.title}
                                                                                    fill
                                                                                    sizes="64px"
                                                                                    className="object-cover"
                                                                                />
                                                                            </button>
                                                                        ))}
                                                                    {it.images.length > 4 && (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                openPreview(
                                                                                    it.images || [],
                                                                                    it.title,
                                                                                )
                                                                            }
                                                                        >
                                                                            +{it.images.length - 4} more
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-muted-foreground">
                                                                    No images
                                                                </div>
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
                                        {/* colSpan increased by 1 due to new Categories column */}
                                        <td
                                            colSpan={isAdmin ? 10 : 9}
                                            className="px-3 py-6 text-center text-muted-foreground"
                                        >
                                            No items
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-sm">
                        <div className="text-muted-foreground">
                            {page.offset + 1}-
                            {Math.min(page.offset + page.limit, page.total)} of{" "}
                            {page.total}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="h-8"
                                disabled={page.offset === 0}
                                onClick={onPrev}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                className="h-8"
                                disabled={
                                    page.offset + page.limit >= page.total
                                }
                                onClick={onNext}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Preview dialog remains */}
            <Dialog
                open={preview.open}
                onOpenChange={(o) => setPreview((p) => ({ ...p, open: o }))}
            >
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{preview.title}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative w-full aspect-video overflow-hidden rounded border bg-background">
                            <Image
                                src={preview.images[preview.index]}
                                alt={preview.title}
                                fill
                                sizes="(max-width: 768px) 100vw, 800px"
                                className="object-cover"
                            />
                        </div>
                        <div className="flex items-center justify-between w-full">
                            <Button variant="outline" onClick={prevImg}>
                                Prev
                            </Button>
                            <div className="text-sm text-muted-foreground">
                                {preview.index + 1} / {preview.images.length}
                            </div>
                            <Button variant="outline" onClick={nextImg}>
                                Next
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit dialog expanded for full editing */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Item</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <div>
                            <div className="text-xs mb-1">Title</div>
                            <Input
                                value={editDraft.title ?? ""}
                                onChange={(e) =>
                                    setEditDraft((d) => ({
                                        ...d,
                                        title: e.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs mb-1">Price</div>
                                <Input
                                    value={editDraft.price ?? ""}
                                    onChange={(e) =>
                                        setEditDraft((d) => ({
                                            ...d,
                                            price: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <div className="text-xs mb-1">Version</div>
                                <Input
                                    value={editDraft.version ?? ""}
                                    onChange={(e) =>
                                        setEditDraft((d) => ({
                                            ...d,
                                            version: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs mb-1">URL</div>
                                <Input
                                    value={editDraft.url ?? ""}
                                    onChange={(e) =>
                                        setEditDraft((d) => ({
                                            ...d,
                                            url: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <div className="text-xs mb-1">Store</div>
                                <Input
                                    value={editDraft.store ?? ""}
                                    onChange={(e) =>
                                        setEditDraft((d) => ({
                                            ...d,
                                            store: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs mb-1">Creator Name</div>
                                <Input
                                    value={editDraft.creatorName ?? ""}
                                    onChange={(e) =>
                                        setEditDraft((d) => ({
                                            ...d,
                                            creatorName: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <div className="text-xs mb-1">Creator Link</div>
                                <Input
                                    value={editDraft.creatorLink ?? ""}
                                    onChange={(e) =>
                                        setEditDraft((d) => ({
                                            ...d,
                                            creatorLink: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <div>
                            <div className="text-xs mb-1">Description</div>
                            <Textarea
                                value={editDraft.description ?? ""}
                                onChange={(e) =>
                                    setEditDraft((d) => ({
                                        ...d,
                                        description: e.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <div className="text-xs mb-1">Perm: Copy</div>
                                <Input
                                    value={editDraft.permCopy ?? ""}
                                    onChange={(e) =>
                                        setEditDraft((d) => ({
                                            ...d,
                                            permCopy: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <div className="text-xs mb-1">Perm: Modify</div>
                                <Input
                                    value={editDraft.permModify ?? ""}
                                    onChange={(e) =>
                                        setEditDraft((d) => ({
                                            ...d,
                                            permModify: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <div className="text-xs mb-1">
                                    Perm: Transfer
                                </div>
                                <Input
                                    value={editDraft.permTransfer ?? ""}
                                    onChange={(e) =>
                                        setEditDraft((d) => ({
                                            ...d,
                                            permTransfer: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <div>
                            <div className="text-xs mb-1">
                                Images (one per line)
                            </div>
                            <Textarea
                                value={editDraft.imagesText ?? ""}
                                onChange={(e) =>
                                    setEditDraft((d) => ({
                                        ...d,
                                        imagesText: e.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs mb-1">
                                    Features (one per line)
                                </div>
                                <Textarea
                                    value={editDraft.featuresText ?? ""}
                                    onChange={(e) =>
                                        setEditDraft((d) => ({
                                            ...d,
                                            featuresText: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <div className="text-xs mb-1">
                                    Contents (one per line)
                                </div>
                                <Textarea
                                    value={editDraft.contentsText ?? ""}
                                    onChange={(e) =>
                                        setEditDraft((d) => ({
                                            ...d,
                                            contentsText: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEditOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={saveEdit}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
