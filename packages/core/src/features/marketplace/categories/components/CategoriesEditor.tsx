"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
    ChevronRight,
    ChevronDown,
    ChevronsDownUp,
    ChevronsUpDown,
    Plus,
    Pencil,
    Trash2,
    Search,
    GripVertical,
    MoreHorizontal,
    Check,
    X,
    FolderTree,
    Package,
    MoveRight,
    CornerDownRight,
    Layers,
    Loader2,
    EyeOff,
} from "lucide-react";
import {
    normalizePath,
    pathKey,
    pathLabel,
} from "@/features/marketplace/shared/category-path";
import { cn } from "@/lib/utils";

/** A category row as the API returns it. */
interface Category {
    id: string;
    path: string[];
    /** The number of items in this branch, itself and everything beneath. */
    count?: number;
    /** Whether the category holds adult material. */
    isNsfw?: boolean;
}

/** One node in the category tree. */
interface TreeNode {
    /** The segment this node is named after. */
    name: string;
    /** The full path from the root to this node. */
    path: string[];
    /** The database id of the category at exactly this path, if there is one. */
    id?: string;
    /** Items in this branch. */
    count: number;
    /** Whether this branch holds adult material. */
    isNsfw: boolean;
    /** Child nodes, keyed by segment. */
    children: Map<string, TreeNode>;
}

/** One row of the flattened tree. */
interface FlatRow {
    key: string;
    id?: string;
    path: string[];
    name: string;
    depth: number;
    childCount: number;
    count: number;
    /** Whether this branch holds adult material. */
    isNsfw: boolean;
    /** True when the node has no row of its own - it only groups its children. */
    isGrouping: boolean;
}

/** An item as the tools items API returns it. */
interface Item {
    id: string;
    title: string;
    price?: string | null;
    creator?: { name?: string | null } | null;
    url?: string;
}

/** A count with thousands separators, so a column of them can be scanned. */
function formatCount(value: number): string {
    return new Intl.NumberFormat("en-US").format(value);
}

export default function CategoriesEditor({
    initial,
}: {
    /** Seed data, used to preview the editor without the tools API. */
    initial?: Category[];
} = {}) {
    const [categories, setCategories] = useState<Category[]>(initial ?? []);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [query, setQuery] = useState("");
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

    /** The category whose items are shown on the right. */
    const [selected, setSelected] = useState<string[] | null>(null);

    const [renaming, setRenaming] = useState<{
        path: string[];
        value: string;
    } | null>(null);
    const [adding, setAdding] = useState<{ parent: string[] | null } | null>(null);
    const [addingValue, setAddingValue] = useState("");
    const [deleting, setDeleting] = useState<{
        path: string[];
        ids: string[];
        count: number;
    } | null>(null);

    /** The category being dragged, and where it would land. */
    const [dragging, setDragging] = useState<string[] | null>(null);
    const [dropTarget, setDropTarget] = useState<{
        key: string;
        kind: "into" | "root";
    } | null>(null);

    /** The items of the selected category, and the ones picked for a bulk move. */
    const [items, setItems] = useState<Item[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [picked, setPicked] = useState<Set<string>>(() => new Set());
    const [bulkMode, setBulkMode] = useState<"add" | "replace" | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch("/api/tools/marketplace/categories", {
                credentials: "include",
            });
            if (!r.ok) throw new Error("failed");
            const d = await r.json();
            setCategories(d.items || []);
        } catch {
            toast.error("Failed to load categories");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (initial) return;
        void load();
        const h = () => void load();
        window.addEventListener("mp:categoriesChanged" as any, h);
        return () =>
            window.removeEventListener("mp:categoriesChanged" as any, h);
    }, [load, initial]);

    /**
     * The tree, built from the flat list of category paths.
     *
     * Built generically over depth, so the tree is as deep as the data goes
     * rather than as deep as the code assumed.
     */
    const tree = useMemo(() => {
        const root: TreeNode = {
            name: "",
            path: [],
            count: 0,
            isNsfw: false,
            children: new Map(),
        };
        for (const c of categories) {
            const path = normalizePath(c.path);
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

        // A branch marked as adult covers everything beneath it, so the
        // flag is inherited on the way down.
        const inherit = (node: TreeNode, parentNsfw: boolean) => {
            for (const child of node.children.values()) {
                child.isNsfw = child.isNsfw || parentNsfw;
                inherit(child, child.isNsfw);
            }
        };
        inherit(root, root.isNsfw);

        // A node without a row of its own still holds the items of its
        // children, so a branch total is rolled up the tree.
        const rollUp = (node: TreeNode): number => {
            let total = node.count;
            for (const child of node.children.values()) {
                total += rollUp(child);
            }
            node.count = total;
            return total;
        };
        rollUp(root);
        return root;
    }, [categories]);

    /** Flatten the tree, honouring expansion and the search filter. */
    const flat = useMemo<FlatRow[]>(() => {
        const rows: FlatRow[] = [];
        const q = query.trim().toLowerCase();
        const matches = (name: string) => !q || name.toLowerCase().includes(q);

        const walk = (node: TreeNode, depth: number) => {
            const entries = Array.from(node.children.values()).sort((a, b) =>
                a.name.localeCompare(b.name),
            );
            for (const child of entries) {
                // A node matches if it or any descendant matches the search.
                const subtreeMatches =
                    matches(child.name) ||
                    Array.from(child.children.values()).some((c) =>
                        matches(c.name),
                    );
                if (q && !subtreeMatches) continue;

                const key = pathKey(child.path);
                rows.push({
                    key,
                    id: child.id,
                    path: child.path,
                    name: child.name,
                    depth,
                    childCount: child.children.size,
                    count: child.count,
                    isNsfw: child.isNsfw,
                    isGrouping: !child.id,
                });

                // A search shows the whole matching branch, however it was
                // folded away.
                if (child.children.size && (q || expanded.has(key))) {
                    walk(child, depth + 1);
                }
            }
        };

        walk(tree, 0);
        return rows;
    }, [tree, expanded, query]);

    const toggle = (key: string) =>
        setExpanded((s) => {
            const n = new Set(s);
            if (n.has(key)) n.delete(key);
            else n.add(key);
            return n;
        });

    const expandAll = () => {
        const all = new Set<string>();
        const walk = (node: TreeNode) => {
            for (const child of node.children.values()) {
                all.add(pathKey(child.path));
                walk(child);
            }
        };
        walk(tree);
        setExpanded(all);
    };

    const collapseAll = () => setExpanded(new Set());

    /** The ids of a branch, for deleting it whole. */
    const branchIds = useCallback(
        (path: string[]): string[] => {
            const key = pathKey(path);
            return categories
                .filter((c) => {
                    const cp = normalizePath(c.path);
                    return (
                        cp.length >= path.length &&
                        pathKey(cp.slice(0, path.length)) === key
                    );
                })
                .map((c) => c.id);
        },
        [categories],
    );

    // ── Items of the selected category ──────────────────────────────────
    useEffect(() => {
        if (!selected) {
            setItems([]);
            setPicked(new Set());
            return;
        }
        const match = categories.find(
            (c) => pathKey(normalizePath(c.path)) === pathKey(selected),
        );
        if (!match?.id) {
            setItems([]);
            return;
        }
        let cancelled = false;
        setItemsLoading(true);
        (async () => {
            try {
                const params = new URLSearchParams();
                params.set("categoryId", match.id!);
                params.set("limit", "100");
                const res = await fetch(
                    `/api/tools/marketplace/items?${params.toString()}`,
                    { credentials: "include" },
                );
                const data = await res.json();
                if (!cancelled) setItems(data.items || []);
            } catch {
                if (!cancelled) setItems([]);
            } finally {
                if (!cancelled) setItemsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selected, categories]);

    // ── Editing ─────────────────────────────────────────────────────────
    const startRename = (row: FlatRow) => {
        if (!row.id) return;
        setRenaming({ path: row.path, value: row.name });
    };

    const cancelRename = () => setRenaming(null);

    const commitRename = async () => {
        if (!renaming) return;
        const newName = renaming.value.trim();
        const match = categories.find(
            (c) => pathKey(normalizePath(c.path)) === pathKey(renaming.path),
        );
        if (!newName || !match?.id) {
            cancelRename();
            return;
        }
        const nextPath = [...renaming.path.slice(0, -1), newName];
        setSaving(true);
        try {
            const r = await fetch(
                `/api/tools/marketplace/categories/${match.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ path: nextPath }),
                },
            );
            if (!r.ok) throw new Error("rename");
            toast.success(`Renamed to ${pathLabel(nextPath)}`);
            cancelRename();
            setSelected((prev) =>
                prev && pathKey(prev) === pathKey(renaming.path)
                    ? nextPath
                    : prev,
            );
            await load();
            window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
        } catch {
            toast.error("Rename failed - that name may already exist");
        } finally {
            setSaving(false);
        }
    };

    const beginAdd = (parent: string[] | null) => {
        setAdding({ parent });
        setAddingValue("");
    };

    const cancelAdd = () => {
        setAdding(null);
        setAddingValue("");
    };

    const commitAdd = async () => {
        if (!adding) return;
        const value = addingValue.trim();
        if (!value) {
            cancelAdd();
            return;
        }
        const path = [...(adding.parent ?? []), value];
        setSaving(true);
        try {
            const r = await fetch("/api/tools/marketplace/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ path }),
            });
            if (!r.ok) throw new Error("add");
            toast.success(`Added ${pathLabel(path)}`);
            cancelAdd();
            await load();
            window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
        } catch {
            toast.error("Could not add that category");
        } finally {
            setSaving(false);
        }
    };

    // ── Moving ──────────────────────────────────────────────────────────
    /**
     * Move a category under a new parent.
     *
     * A category is a path, so moving one is a rename to the new path. The
     * server carries the descendants along.
     */
    const moveCategory = async (path: string[], newParent: string[] | null) => {
        const match = categories.find(
            (c) => pathKey(normalizePath(c.path)) === pathKey(path),
        );
        if (!match?.id) return;
        const nextPath = [...(newParent ?? []), path[path.length - 1]];
        if (pathKey(nextPath) === pathKey(path)) return;
        // A category cannot live inside itself.
        if (
            newParent &&
            newParent.length >= path.length &&
            pathKey(newParent.slice(0, path.length)) === pathKey(path)
        ) {
            toast.error("A category cannot move inside itself");
            return;
        }
        setSaving(true);
        try {
            const r = await fetch(
                `/api/tools/marketplace/categories/${match.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ path: nextPath }),
                },
            );
            if (!r.ok) throw new Error("move");
            toast.success(`Moved to ${pathLabel(newParent ?? ["Top level"])}`);
            setSelected((prev) =>
                prev && pathKey(prev) === pathKey(path) ? nextPath : prev,
            );
            await load();
            window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
        } catch {
            toast.error("Move failed - that category may already exist");
        } finally {
            setSaving(false);
        }
    };

    /**
     * Mark a category - and everything beneath it - as adult material, or
     * clear the mark.
     */
    const setNsfw = async (row: FlatRow, value: boolean) => {
        if (!row.id) return;
        setSaving(true);
        try {
            const r = await fetch(
                `/api/tools/marketplace/categories/${row.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ isNsfw: value }),
                },
            );
            if (!r.ok) throw new Error("nsfw");
            toast.success(
                value
                    ? `${row.name} and its subcategories are now hidden until NSFW is turned on`
                    : `${row.name} is no longer marked as adult`,
            );
            await load();
            window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
        } catch {
            toast.error("Could not change the NSFW mark");
        } finally {
            setSaving(false);
        }
    };

    const onDragStart = (e: React.DragEvent, path: string[]) => {
        setDragging(path);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", pathKey(path));
    };

    const onDragEnd = () => {
        setDragging(null);
        setDropTarget(null);
    };

    const onDragOverRow = (e: React.DragEvent, row: FlatRow) => {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        // Dropping on a node makes it the new parent.
        setDropTarget({ key: row.key, kind: "into" });
    };

    const onDragOverRoot = (e: React.DragEvent) => {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTarget({ key: "__root__", kind: "root" });
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const target = dropTarget;
        const source = dragging;
        setDragging(null);
        setDropTarget(null);
        if (!source || !target) return;
        if (target.kind === "root") {
            void moveCategory(source, null);
            return;
        }
        const row = flat.find((r) => r.key === target.key);
        if (!row) return;
        void moveCategory(source, row.path);
    };

    // ── Deleting ────────────────────────────────────────────────────────
    const confirmDelete = (row: FlatRow) => {
        if (!row.id) return;
        setDeleting({
            path: row.path,
            ids: branchIds(row.path),
            count: row.count,
        });
    };

    const performDelete = async () => {
        if (!deleting) return;
        setSaving(true);
        try {
            await Promise.all(
                deleting.ids.map((id) =>
                    fetch(`/api/tools/marketplace/categories/${id}`, {
                        method: "DELETE",
                        credentials: "include",
                    }),
                ),
            );
            toast.success(`Deleted ${pathLabel(deleting.path)}`);
            setDeleting(null);
            setSelected((prev) =>
                prev && pathKey(prev) === pathKey(deleting.path) ? null : prev,
            );
            await load();
            window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
        } catch {
            toast.error("Delete failed");
        } finally {
            setSaving(false);
        }
    };

    // ── Bulk item move ──────────────────────────────────────────────────
    const togglePick = (id: string) =>
        setPicked((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const allPicked = items.length > 0 && picked.size === items.length;

    const toggleAll = () =>
        setPicked((prev) =>
            prev.size === items.length
                ? new Set()
                : new Set(items.map((i) => i.id)),
        );

    const performBulk = async (mode: "add" | "replace", categoryId: string) => {
        setSaving(true);
        try {
            const r = await fetch(
                "/api/tools/marketplace/items/categories/batch",
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        itemIds: Array.from(picked),
                        categoryIds: [categoryId],
                        mode,
                    }),
                },
            );
            if (!r.ok) throw new Error("move");
            toast.success(
                mode === "replace"
                    ? `Moved ${picked.size} items`
                    : `Added ${picked.size} items to the category`,
            );
            setPicked(new Set());
            setBulkMode(null);
            await load();
        } catch {
            toast.error("Could not move those items");
        } finally {
            setSaving(false);
        }
    };

    const selectedRow = useMemo(
        () =>
            flat.find((r) => selected && pathKey(r.path) === pathKey(selected)),
        [flat, selected],
    );

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(320px,380px)_1fr]">
            {/* ── The tree ─────────────────────────────────────────────── */}
            <div className="rounded-lg border bg-card">
                <div className="flex items-center gap-2 border-b px-3 py-2">
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Filter categories"
                            className="h-8 pl-8 text-sm"
                        />
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Expand all"
                                onClick={expandAll}
                            >
                                <ChevronsDownUp className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="px-2 py-1">
                            Expand all
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Collapse all"
                                onClick={collapseAll}
                            >
                                <ChevronsUpDown className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="px-2 py-1">
                            Collapse all
                        </TooltipContent>
                    </Tooltip>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                        {categories.length}
                    </span>
                    <Button
                        size="sm"
                        className="h-8"
                        onClick={() => beginAdd(null)}
                    >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Root
                    </Button>
                </div>

                {/* The drop target for "make this a top-level category". */}
                <div
                    onDragOver={onDragOverRoot}
                    onDrop={onDrop}
                    className={cn(
                        "flex items-center gap-2 border-b px-3 py-1.5 text-xs transition-colors",
                        dropTarget?.kind === "root"
                            ? "bg-primary/15 text-foreground"
                            : "text-muted-foreground",
                    )}
                >
                    <Layers className="h-3.5 w-3.5" />
                    Drop here to make it a top-level category
                </div>

                <ScrollArea className="h-[58vh] min-h-[320px]">
                    <div className="p-1.5">
                        {flat.map((row) => {
                            const isRenaming =
                                !!renaming && pathKey(renaming.path) === row.key;
                            const isSelected =
                                !!selected && pathKey(selected) === row.key;
                            const isDragging =
                                !!dragging && pathKey(dragging) === row.key;
                            const isDropTarget =
                                dropTarget?.key === row.key &&
                                dropTarget.kind === "into";
                            return (
                                <div
                                    key={row.key}
                                    draggable={!row.isGrouping}
                                    onDragStart={(e) =>
                                        onDragStart(e, row.path)
                                    }
                                    onDragEnd={onDragEnd}
                                    onDragOver={(e) => onDragOverRow(e, row)}
                                    onDrop={onDrop}
                                    onClick={() =>
                                        !row.isGrouping && setSelected(row.path)
                                    }
                                    className={cn(
                                        "group flex items-center gap-1 rounded-md px-1.5 py-1 text-sm transition-colors",
                                        isSelected
                                            ? "bg-primary/15"
                                            : "hover:bg-muted/60",
                                        isDragging && "opacity-40",
                                        isDropTarget &&
                                            "bg-primary/20 ring-1 ring-primary",
                                    )}
                                >
                                    {row.isGrouping ? (
                                        // A node with no row of its own only
                                        // groups its children - it cannot be
                                        // dragged, renamed or deleted.
                                        <span
                                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/70"
                                            title="A grouping - it has no items of its own"
                                        >
                                            <FolderTree className="h-3.5 w-3.5" />
                                        </span>
                                    ) : (
                                        <span
                                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground cursor-grab hover:text-foreground active:cursor-grabbing"
                                            aria-hidden="true"
                                        >
                                            <GripVertical className="h-3.5 w-3.5" />
                                        </span>
                                    )}

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (row.childCount) toggle(row.key);
                                        }}
                                        className={cn(
                                            "flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground",
                                            !row.childCount && "invisible",
                                        )}
                                        aria-label={
                                            row.childCount
                                                ? `${expanded.has(row.key) ? "Collapse" : "Expand"} ${row.name}`
                                                : undefined
                                        }
                                        tabIndex={row.childCount ? 0 : -1}
                                    >
                                        {expanded.has(row.key) ? (
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        ) : (
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        )}
                                    </button>

                                    {isRenaming ? (
                                        <div className="flex min-w-0 flex-1 items-center gap-1">
                                            <Input
                                                autoFocus
                                                value={renaming.value}
                                                onChange={(e) =>
                                                    setRenaming({
                                                        ...renaming,
                                                        value: e.target.value,
                                                    })
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter")
                                                        void commitRename();
                                                    if (e.key === "Escape")
                                                        cancelRename();
                                                }}
                                                className="h-7"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 shrink-0"
                                                aria-label="Save name"
                                                onClick={() =>
                                                    void commitRename()
                                                }
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 shrink-0"
                                                aria-label="Cancel rename"
                                                onClick={cancelRename}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <span
                                                className={cn(
                                                    "min-w-0 flex-1 truncate",
                                                    row.depth > 0 &&
                                                        "text-muted-foreground",
                                                )}
                                                title={pathLabel(row.path)}
                                            >
                                                {row.name}
                                            </span>
                                            {row.isNsfw && (
                                                <Badge
                                                    variant="destructive"
                                                    className="shrink-0 px-1.5"
                                                >
                                                    NSFW
                                                </Badge>
                                            )}
                                            {row.count > 0 && (
                                                <Badge
                                                    variant="secondary"
                                                    className="shrink-0 px-1.5 tabular-nums"
                                                >
                                                    {formatCount(row.count)}
                                                </Badge>
                                            )}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                                                        aria-label={`Actions for ${row.name}`}
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    >
                                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    className="w-52"
                                                >
                                                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                                                        {pathLabel(row.path)}
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        disabled={!row.id}
                                                        onSelect={() =>
                                                            startRename(row)
                                                        }
                                                    >
                                                        <Pencil className="mr-2 h-3.5 w-3.5" />
                                                        Rename
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            beginAdd(row.path)
                                                        }
                                                    >
                                                        <Plus className="mr-2 h-3.5 w-3.5" />
                                                        Add child
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                                                        Move
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuItem
                                                        disabled={
                                                            !row.id ||
                                                            row.depth === 0
                                                        }
                                                        onSelect={() =>
                                                            void moveCategory(
                                                                row.path,
                                                                row.path.slice(
                                                                    0,
                                                                    -1,
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        <CornerDownRight className="mr-2 h-3.5 w-3.5" />
                                                        Move up a level
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        disabled={!row.id}
                                                        onSelect={() =>
                                                            void moveCategory(
                                                                row.path,
                                                                null,
                                                            )
                                                        }
                                                    >
                                                        <MoveRight className="mr-2 h-3.5 w-3.5" />
                                                        Make top-level
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        disabled={!row.id}
                                                        onSelect={() =>
                                                            void setNsfw(
                                                                row,
                                                                !row.isNsfw,
                                                            )
                                                        }
                                                    >
                                                        {row.isNsfw ? (
                                                            <>
                                                                <Check className="mr-2 h-3.5 w-3.5" />
                                                                Clear the NSFW mark
                                                            </>
                                                        ) : (
                                                            <>
                                                                <EyeOff className="mr-2 h-3.5 w-3.5" />
                                                                Mark as NSFW
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        disabled={!row.id}
                                                        className="text-destructive focus:text-destructive"
                                                        onSelect={() =>
                                                            confirmDelete(row)
                                                        }
                                                    >
                                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                        Delete category
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </>
                                    )}
                                </div>
                            );
                        })}

                        {adding && (
                            <div className="mt-1 flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-1">
                                <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <Input
                                    autoFocus
                                    value={addingValue}
                                    onChange={(e) =>
                                        setAddingValue(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                            void commitAdd();
                                        if (e.key === "Escape") cancelAdd();
                                    }}
                                    placeholder={`New category under ${
                                        adding.parent?.length
                                            ? pathLabel(adding.parent)
                                            : "root"
                                    }`}
                                    className="h-7"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    aria-label="Save category"
                                    onClick={() => void commitAdd()}
                                >
                                    <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    aria-label="Cancel"
                                    onClick={cancelAdd}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}

                        {!flat.length && !loading && (
                            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                                {query
                                    ? "No categories match that filter."
                                    : "No categories yet."}
                            </p>
                        )}
                        {loading && (
                            <p className="flex items-center justify-center gap-2 px-2 py-6 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Loading categories
                            </p>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* ── The selected category and its items ───────────────────── */}
            <div className="space-y-4">
                {!selectedRow ? (
                    <div className="rounded-lg border bg-card">
                        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                            <FolderTree className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                            <div className="space-y-1">
                                <div className="text-sm font-medium">
                                    Pick a category
                                </div>
                                <div className="max-w-sm text-xs text-muted-foreground">
                                    Choose one on the left to see the items
                                    inside it, rename it, or move items
                                    between categories in bulk.
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="rounded-lg border bg-card p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <FolderTree className="h-3.5 w-3.5" />
                                        {pathLabel(selectedRow.path)}
                                    </div>
                                    <h2 className="mt-1 truncate text-lg font-semibold">
                                        {selectedRow.name}
                                    </h2>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {formatCount(selectedRow.count)} items
                                        across this branch ·{" "}
                                        {selectedRow.childCount} subcategories
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => startRename(selectedRow)}
                                    >
                                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                        Rename
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            beginAdd(selectedRow.path)
                                        }
                                    >
                                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                                        Add child
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-card">
                            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                    Items in {selectedRow.name}
                                </span>
                                {picked.size > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                        {picked.size} selected
                                    </span>
                                )}
                                <div className="ml-auto flex flex-wrap items-center gap-2">
                                    {picked.size > 0 && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={saving}
                                                onClick={() =>
                                                    setBulkMode("add")
                                                }
                                            >
                                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                                Add to category
                                            </Button>
                                            <Button
                                                size="sm"
                                                disabled={saving}
                                                onClick={() =>
                                                    setBulkMode("replace")
                                                }
                                            >
                                                <MoveRight className="mr-1.5 h-3.5 w-3.5" />
                                                Move to category
                                            </Button>
                                        </>
                                    )}
                                    {items.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={toggleAll}
                                        >
                                            {allPicked
                                                ? "Clear selection"
                                                : "Select all"}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <ScrollArea className="h-[40vh] min-h-[240px]">
                                <div className="divide-y">
                                    {items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/40"
                                        >
                                            <Checkbox
                                                checked={picked.has(item.id)}
                                                onCheckedChange={() =>
                                                    togglePick(item.id)
                                                }
                                                aria-label={`Select ${item.title}`}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-medium">
                                                    {item.title || "Untitled"}
                                                </div>
                                                {item.creator?.name && (
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        by {item.creator.name}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="shrink-0 text-sm font-medium tabular-nums">
                                                {item.price
                                                    ? `L$ ${item.price}`
                                                    : "—"}
                                            </div>
                                            {item.url && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 shrink-0"
                                                    aria-label="Open listing"
                                                    asChild
                                                >
                                                    <a
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <MoveRight className="h-3.5 w-3.5" />
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    {itemsLoading && (
                                        <p className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-muted-foreground">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Loading items
                                        </p>
                                    )}
                                    {!itemsLoading && !items.length && (
                                        <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                                            No items are tagged to this
                                            category directly. The{" "}
                                            {formatCount(selectedRow.count)}{" "}
                                            items in the branch sit in its
                                            subcategories.
                                        </p>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </>
                )}
            </div>

            {/* Where the picked items go. */}
            <Dialog
                open={!!bulkMode}
                onOpenChange={(open) => {
                    if (!open) setBulkMode(null);
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {bulkMode === "replace"
                                ? `Move ${picked.size} items`
                                : `Add ${picked.size} items to a category`}
                        </DialogTitle>
                        <DialogDescription>
                            {bulkMode === "replace"
                                ? "These items will end up in the category you pick, and nowhere else."
                                : "These items keep every category they already have, and gain the one you pick."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-64 overflow-y-auto rounded-md border">
                        {flat
                            .filter((r) => r.id)
                            .map((r) => (
                                <button
                                    key={r.id}
                                    type="button"
                                    disabled={saving}
                                    onClick={() =>
                                        void performBulk(bulkMode ?? "add", r.id!)
                                    }
                                    className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/60 disabled:opacity-50"
                                >
                                    <span className="truncate">
                                        {pathLabel(r.path)}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        {r.count}
                                    </span>
                                </button>
                            ))}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setBulkMode(null)}
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* The confirmation before a category and its branch go. */}
            <Dialog
                open={!!deleting}
                onOpenChange={(open) => {
                    if (!open) setDeleting(null);
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete this category?</DialogTitle>
                        <DialogDescription>
                            {deleting
                                ? `${pathLabel(deleting.path)} and ${
                                      deleting.ids.length - 1
                                  } subcategories will be removed. The ${
                                      deleting.count
                                  } items inside them are not deleted - they
                                  simply stop being categorised.`
                                : ""}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleting(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={saving}
                            onClick={() => void performDelete()}
                        >
                            {saving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
