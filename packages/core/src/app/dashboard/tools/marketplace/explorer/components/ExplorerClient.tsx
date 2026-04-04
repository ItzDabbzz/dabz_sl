"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import * as XLSX from "xlsx";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import ExplorerToolbar from "./ExplorerToolbar";
import CategoryPicker from "./CategoryPicker";
import type { Item, Category, Page } from "./types";

/**
 * ExplorerClient
 *
 * Holds the interactive state for the Marketplace Explorer and renders the table.
 * Performance notes:
 * - Debounces search and autosaves to reduce network thrash.
 * - Aborts in-flight item requests on new queries to avoid race conditions.
 * - Prefetches category mappings for the first few items to improve perceived latency.
 */
export default function ExplorerClient() {
    // data sets
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<Item[]>([]);

    // ui state
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState<Page>({ limit: 25, offset: 0, total: 0 });
    const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
    const [preview, setPreview] = useState<{
        open: boolean;
        images: string[];
        index: number;
        title: string;
    }>({ open: false, images: [], index: 0, title: "" });
    const [isAdmin, setIsAdmin] = useState(false);

    // toolbar model
    const [q, setQ] = useState("");
    const [categoryId, setCategoryId] = useState<string>("");
    const [sort, setSort] = useState<"most" | "least">("most");
    const [justImported, setJustImported] = useState(false);
    const [onlyUncategorized, setOnlyUncategorized] = useState(false);
    const [sinceMinutes, setSinceMinutes] = useState<number | null>(null);
    const [lastImportedIds, setLastImportedIds] = useState<string[]>([]);

    // categories lazy flags/cache
    const [catsLoaded, setCatsLoaded] = useState(false);
    const [itemCats, setItemCats] = useState<Record<string, string[]>>({});

    // map cache for labels
    const catById = useMemo(() => {
        const map: Record<string, Category> = {};
        for (const c of categories) map[c.id] = c;
        return map;
    }, [categories]);

    const labelFor = (id: string) => {
        const c = catById[id];
        return c ? `${c.primary} › ${c.sub}` : id;
    };

    // Fetch helpers
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

    // Items loader with abort to prevent races
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
            if (seq !== itemsReqSeq.current) return;
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
            if (e?.name === "AbortError") return;
            if (seq !== itemsReqSeq.current) return;
            setLoading(false);
        }
    };

    // session import batch tracking
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
                loadItems({ offset: 0, ids, preserveDetails: false });
            }
        };
        window.addEventListener("mp:itemsImported" as any, onImported);
        return () =>
            window.removeEventListener("mp:itemsImported" as any, onImported);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Prefetch for first visible rows
    useEffect(() => {
        const ids = items.slice(0, 8).map((i) => i.id);
        ids.forEach((id) => {
            if (itemCats[id] === undefined) fetchItemCats(id);
        });
    }, [items, itemCats]);

    // admin gate
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

    // initial load
    useEffect(() => {
        loadCategories();
        loadItems({ offset: 0 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // batch fetch categories for visible items
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

    // live search debounce
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

    // XLSX export remains simple and client-only
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
            IsNsfw: it.isNsfw ? "Yes" : "No",
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

    const onPrev = () =>
        page.offset > 0 &&
        loadItems({ offset: Math.max(0, page.offset - page.limit) });
    const onNext = () =>
        page.offset + page.limit < page.total &&
        loadItems({ offset: page.offset + page.limit });

    // editing state
    const [editOpen, setEditOpen] = useState(false);
    type EditDraft = Partial<Item> & {
        id?: string;
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
            isNsfw: !!it.isNsfw,
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
                    isNsfw: !!editDraft.isNsfw,
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

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="space-y-2">
                    <CardTitle>Explore</CardTitle>
                    <ExplorerToolbar
                        categories={categories}
                        state={{
                            q,
                            categoryId,
                            sort,
                            justImported,
                            onlyUncategorized,
                            sinceMinutes,
                        }}
                        loading={loading}
                        lastImportedIds={lastImportedIds}
                        onChange={(next) => {
                            if (next.q !== undefined) setQ(next.q);
                            if (next.categoryId !== undefined)
                                setCategoryId(next.categoryId);
                            if (next.sort !== undefined) setSort(next.sort);
                            if (next.justImported !== undefined)
                                setJustImported(next.justImported);
                            if (next.onlyUncategorized !== undefined)
                                setOnlyUncategorized(next.onlyUncategorized);
                            if (next.sinceMinutes !== undefined)
                                setSinceMinutes(next.sinceMinutes);
                        }}
                        onRefresh={() => loadItems({ preserveDetails: true })}
                    />
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
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
                                            <td className="px-3 py-2 max-w-[28rem]">
                                                <div className="font-medium line-clamp-1">
                                                    {it.title}
                                                </div>
                                                {!!it.isNsfw && (
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        <Badge variant="destructive">
                                                            NSFW
                                                        </Badge>
                                                    </div>
                                                )}
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
                                                    categories={categories}
                                                    catsLoaded={catsLoaded}
                                                    selectedCategoryIds={
                                                        itemCats[it.id]
                                                    }
                                                    labelFor={labelFor}
                                                    onEnsureCatsLoaded={
                                                        loadCategories
                                                    }
                                                    onEnsureItemCats={
                                                        fetchItemCats
                                                    }
                                                    onSave={async (
                                                        itemId,
                                                        finalIds,
                                                    ) => {
                                                        await fetch(
                                                            `/api/tools/marketplace/items/${itemId}/categories`,
                                                            {
                                                                method: "PUT",
                                                                headers: {
                                                                    "Content-Type":
                                                                        "application/json",
                                                                },
                                                                credentials:
                                                                    "include",
                                                                body: JSON.stringify(
                                                                    {
                                                                        categoryIds:
                                                                            finalIds,
                                                                    },
                                                                ),
                                                            },
                                                        );
                                                        setItemCats((m) => ({
                                                            ...m,
                                                            [itemId]: finalIds,
                                                        }));
                                                    }}
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
                                                                            it.images ||
                                                                                [],
                                                                            it.title,
                                                                        )
                                                                    }
                                                                >
                                                                    <Image
                                                                        src={
                                                                            src
                                                                        }
                                                                        alt={
                                                                            it.title
                                                                        }
                                                                        fill
                                                                        sizes="(max-width: 768px) 32px, 32px"
                                                                        className="object-cover"
                                                                    />
                                                                </button>
                                                            ))}
                                                        {it.images.length >
                                                            3 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2"
                                                                onClick={() =>
                                                                    openPreview(
                                                                        it.images ||
                                                                            [],
                                                                        it.title,
                                                                    )
                                                                }
                                                            >
                                                                +
                                                                {it.images
                                                                    .length - 3}
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
                                                <td
                                                    colSpan={9}
                                                    className="px-3 py-3 bg-muted/20"
                                                >
                                                    <div className="grid gap-3 md:grid-cols-3">
                                                        <div className="md:col-span-2">
                                                            {!!it.isNsfw && (
                                                                <div className="mb-3 flex flex-wrap gap-2">
                                                                    <Badge variant="destructive">
                                                                        NSFW
                                                                    </Badge>
                                                                </div>
                                                            )}
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
                                                            {it.images
                                                                ?.length ? (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {it.images
                                                                        .slice(
                                                                            0,
                                                                            4,
                                                                        )
                                                                        .map(
                                                                            (
                                                                                src,
                                                                                idx,
                                                                            ) => (
                                                                                <button
                                                                                    key={
                                                                                        idx
                                                                                    }
                                                                                    className="h-16 w-16 overflow-hidden rounded border relative"
                                                                                    onClick={() =>
                                                                                        openPreview(
                                                                                            it.images ||
                                                                                                [],
                                                                                            it.title,
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <Image
                                                                                        src={
                                                                                            src
                                                                                        }
                                                                                        alt={
                                                                                            it.title
                                                                                        }
                                                                                        fill
                                                                                        sizes="64px"
                                                                                        className="object-cover"
                                                                                    />
                                                                                </button>
                                                                            ),
                                                                        )}
                                                                    {it.images
                                                                        .length >
                                                                        4 && (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                openPreview(
                                                                                    it.images ||
                                                                                        [],
                                                                                    it.title,
                                                                                )
                                                                            }
                                                                        >
                                                                            +
                                                                            {it
                                                                                .images
                                                                                .length -
                                                                                4}{" "}
                                                                            more
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
                                        <td
                                            colSpan={9}
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

            {/* Preview dialog */}
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

            {/* Edit dialog */}
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
                        <div className="flex items-center justify-between rounded-md border px-3 py-2">
                            <div className="space-y-1">
                                <div className="text-sm font-medium">NSFW</div>
                                <div className="text-xs text-muted-foreground">
                                    Hide this item from the public marketplace unless viewers enable the NSFW toggle.
                                </div>
                            </div>
                            <Switch
                                checked={!!editDraft.isNsfw}
                                onCheckedChange={(checked) =>
                                    setEditDraft((draft) => ({
                                        ...draft,
                                        isNsfw: checked,
                                    }))
                                }
                            />
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

            {/* Floating refresh */}
            <Button
                className="fixed bottom-6 right-6 h-10 w-10 rounded-full shadow-lg"
                title="Refresh"
                onClick={() => loadItems({ preserveDetails: true })}
            >
                <RefreshCw
                    className={"h-5 w-5" + (loading ? " animate-spin" : "")}
                />
            </Button>

            {/* Export */}
            <Button
                variant="outline"
                onClick={exportXlsx}
                disabled={!items.length}
            >
                Export XLSX
            </Button>
        </div>
    );
}
