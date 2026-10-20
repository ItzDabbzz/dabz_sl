"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
    ChevronRight,
    ChevronDown,
    Plus,
    Pencil,
    Trash2,
    Search,
    SortAsc,
    X,
    Check,
    Merge,
} from "lucide-react";
import {
    normalizePath,
    pathKey,
    pathLabel,
} from "@/features/marketplace/shared/category-path";

/** A category row as the API returns it. */
interface Category {
    id: string;
    path: string[];
}

/** One node in the category tree. */
interface TreeNode {
    /** The segment this node is named after. */
    name: string;
    /** The full path from the root to this node. */
    path: string[];
    /** The database id of the category at exactly this path, if there is one. */
    id?: string;
    /** Child nodes, keyed by segment. */
    children: Map<string, TreeNode>;
    /** Every category id at or below this node. */
    descendantIds: string[];
}

/** One row of the flattened tree. */
interface FlatRow {
    /** Unique composite key. */
    key: string;
    /** The database id of the category at exactly this path. */
    id?: string;
    /** The full path to this node. */
    path: string[];
    /** The node's own name. */
    name: string;
    /** How deep this node sits. */
    depth: number;
    /** How many immediate children it has. */
    childCount: number;
    /** Every category id at or below this node. */
    deletableIds: string[];
}

/** Read a row's path. */
function pathOfRow(c: Category): string[] {
    return normalizePath(c.path);
}

export default function CategoriesEditor() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);

    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<"name" | "count">("name");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");

    const [addingUnder, setAddingUnder] = useState<{
        /** The path of the parent, or null for a root-level category. */
        parent: string[] | null;
    } | null>(null);
    const [addingValue, setAddingValue] = useState("");

    const [deleting, setDeleting] = useState<{
        label: string;
        ids: string[];
    } | null>(null);

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
        void load();
        const h = () => void load();
        window.addEventListener("mp:categoriesChanged" as any, h);
        return () =>
            window.removeEventListener("mp:categoriesChanged" as any, h);
    }, [load]);

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
            children: new Map(),
            descendantIds: [],
        };

        for (const c of categories) {
            const path = pathOfRow(c);
            if (!path.length) continue;
            let node = root;
            const ids: string[] = [];
            path.forEach((segment, index) => {
                let child = node.children.get(segment);
                if (!child) {
                    child = {
                        name: segment,
                        path: [...node.path, segment],
                        children: new Map(),
                        descendantIds: [],
                    };
                    node.children.set(segment, child);
                }
                if (index === path.length - 1) child.id = c.id;
                ids.push(c.id);
                node = child;
            });
            // Every node along the path owns this category id.
            let walker = root;
            for (const segment of path) {
                walker = walker.children.get(segment)!;
                walker.descendantIds.push(c.id);
            }
        }

        return root;
    }, [categories]);

    /** Flatten the tree, honouring expansion and the search filter. */
    const flat = useMemo<FlatRow[]>(() => {
        const rows: FlatRow[] = [];
        const q = query.trim().toLowerCase();
        const matches = (name: string) => !q || name.toLowerCase().includes(q);

        const walk = (node: TreeNode, depth: number): boolean => {
            const entries = Array.from(node.children.values());
            const sorted = entries.sort((a, b) => {
                if (sort === "name") return a.name.localeCompare(b.name);
                return (
                    a.descendantIds.length - b.descendantIds.length
                );
            });
            if (sortDir === "desc") sorted.reverse();

            for (const child of sorted) {
                // A node matches if it or any descendant matches the search.
                const subtreeMatches = matches(child.name) ||
                    Array.from(child.children.values()).some((c) =>
                        matches(c.name),
                    );
                if (q && !subtreeMatches) continue;

                const key = `p:${pathKey(child.path)}`;
                rows.push({
                    key,
                    id: child.id,
                    path: child.path,
                    name: child.name,
                    depth,
                    childCount: child.children.size,
                    deletableIds: child.descendantIds,
                });

                if (child.children.size && expanded.has(key)) {
                    walk(child, depth + 1);
                }
            }
            return true;
        };

        walk(tree, 0);
        return rows;
    }, [tree, expanded, query, sort, sortDir]);

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
                all.add(`p:${pathKey(child.path)}`);
                walk(child);
            }
        };
        walk(tree);
        setExpanded(all);
    };

    const collapseAll = () => setExpanded(new Set());

    // ── Editing ───────────────────────────────────────────────────────────
    const startEdit = (row: FlatRow) => {
        setEditingKey(row.key);
        setEditingValue(row.name);
    };

    const cancelEdit = () => {
        setEditingKey(null);
        setEditingValue("");
    };

    const commitEdit = async () => {
        if (!editingKey) return;
        const row = flat.find((r) => r.key === editingKey);
        if (!row) return;
        const newName = editingValue.trim();
        if (!newName || newName === row.name) {
            cancelEdit();
            return;
        }
        try {
            // Rename every category at or below this node, so the branch
            // keeps its shape. A rename onto an existing path merges instead
            // of creating a duplicate.
            const newPath = [...row.path.slice(0, -1), newName];
            const targets = categories.filter((c) => {
                const cp = pathOfRow(c);
                return pathKey(cp.slice(0, row.path.length)) === pathKey(row.path);
            });
            await Promise.all(
                targets.map((c) => {
                    const cp = pathOfRow(c);
                    const updated = [
                        ...newPath,
                        ...cp.slice(row.path.length),
                    ];
                    return fetch(
                        `/api/tools/marketplace/categories/${c.id}`,
                        {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ path: updated }),
                        },
                    );
                }),
            );
            toast.success(
                targets.length > 1
                    ? `Renamed ${targets.length} categories`
                    : "Updated",
            );
            cancelEdit();
            await load();
            window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
        } catch {
            toast.error("Update failed");
        }
    };

    // ── Adding ────────────────────────────────────────────────────────────
    const beginAdd = (parent: string[] | null) => {
        setAddingUnder({ parent });
        setAddingValue("");
    };

    const cancelAdd = () => {
        setAddingUnder(null);
        setAddingValue("");
    };

    const commitAdd = async () => {
        if (!addingUnder) return;
        const val = addingValue.trim();
        if (!val) {
            cancelAdd();
            return;
        }
        const parent = addingUnder.parent ?? [];
        try {
            await fetch("/api/tools/marketplace/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ path: [...parent, val] }),
            });
            toast.success("Added");
            cancelAdd();
            await load();
            window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
        } catch {
            toast.error("Add failed");
        }
    };

    // ── Deleting ──────────────────────────────────────────────────────────
    const confirmDelete = (row: FlatRow) => {
        setDeleting({
            label: pathLabel(row.path),
            ids: row.deletableIds,
        });
    };

    const performDelete = async () => {
        if (!deleting) return;
        try {
            await Promise.all(
                deleting.ids.map((id) =>
                    fetch(`/api/tools/marketplace/categories/${id}`, {
                        method: "DELETE",
                        credentials: "include",
                    }),
                ),
            );
            toast.success("Deleted");
            setDeleting(null);
            await load();
            window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
        } catch {
            toast.error("Delete failed");
        }
    };

    const onEditKey = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") void commitEdit();
        if (e.key === "Escape") cancelEdit();
    };

    const onAddKey = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") void commitAdd();
        if (e.key === "Escape") cancelAdd();
    };

    return (
        <Card className="overflow-hidden">
            <CardHeader className="space-y-2">
                <CardTitle className="text-base">Categories</CardTitle>
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search…"
                            className="pl-8 w-60"
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={expandAll}>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Expand
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={collapseAll}
                    >
                        <ChevronRight className="h-3 w-3 mr-1" />
                        Collapse
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <SortAsc className="h-4 w-4 mr-1" />
                                Sort
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuItem
                                onClick={() => {
                                    setSort("name");
                                    setSortDir("asc");
                                }}
                            >
                                Name A→Z
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => {
                                    setSort("name");
                                    setSortDir("desc");
                                }}
                            >
                                Name Z→A
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => {
                                    setSort("count");
                                    setSortDir("desc");
                                }}
                            >
                                Children High→Low
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => {
                                    setSort("count");
                                    setSortDir("asc");
                                }}
                            >
                                Children Low→High
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="sm" onClick={() => beginAdd(null)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Primary
                    </Button>
                    {loading && (
                        <span className="text-xs text-muted-foreground">
                            Loading…
                        </span>
                    )}
                    {deleting && (
                        <div className="ml-auto flex items-center gap-2 text-xs bg-destructive/10 px-2 py-1 rounded">
                            <span>
                                Delete {deleting.label}? ({deleting.ids.length})
                            </span>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={performDelete}
                            >
                                Confirm
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleting(null)}
                            >
                                Cancel
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-auto max-h-[70vh]">
                    <Table className="text-sm">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[420px]">Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="w-24">
                                    Children
                                </TableHead>
                                <TableHead className="text-right w-40">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {flat.map((row) => {
                                const isEditing = editingKey === row.key;
                                const padding = row.depth * 16;
                                const expandable = row.childCount > 0;
                                const isExpanded = expanded.has(row.key);
                                return (
                                    <TableRow
                                        key={row.key}
                                        data-row-key={row.key}
                                        className="hover:bg-muted/40"
                                    >
                                        <TableCell>
                                            <div
                                                className="flex items-center gap-1"
                                                style={{ paddingLeft: padding }}
                                            >
                                                {expandable ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 shrink-0"
                                                        onClick={() =>
                                                            toggle(row.key)
                                                        }
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <span className="inline-block w-6" />
                                                )}
                                                {isEditing ? (
                                                    <div className="flex items-center gap-1 w-full">
                                                        <Input
                                                            autoFocus
                                                            value={
                                                                editingValue
                                                            }
                                                            onChange={(e) =>
                                                                setEditingValue(
                                                                    e.target.value,
                                                                )
                                                            }
                                                            onKeyDown={
                                                                onEditKey
                                                            }
                                                            className="h-7 w-full"
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={commitEdit}
                                                        >
                                                            <Check className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={cancelEdit}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span
                                                            className="truncate"
                                                            title={pathLabel(
                                                                row.path,
                                                            )}
                                                        >
                                                            {row.name}
                                                        </span>
                                                        {row.childCount === 0 && (
                                                            <Badge variant="outline">
                                                                empty
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="capitalize">
                                            level {row.depth + 1}
                                        </TableCell>
                                        <TableCell>
                                            {row.childCount || 0}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    title="Add child"
                                                    onClick={() =>
                                                        beginAdd(row.path)
                                                    }
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    title="Rename"
                                                    onClick={() =>
                                                        startEdit(row)
                                                    }
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    title="Delete"
                                                    onClick={() =>
                                                        confirmDelete(row)
                                                    }
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {addingUnder && (
                                <TableRow className="bg-muted/30">
                                    <TableCell colSpan={4}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                Add under{" "}
                                                {addingUnder.parent?.length
                                                    ? pathLabel(
                                                          addingUnder.parent,
                                                      )
                                                    : "root"}
                                            </span>
                                            <Input
                                                autoFocus
                                                value={addingValue}
                                                onChange={(e) =>
                                                    setAddingValue(e.target.value)
                                                }
                                                onKeyDown={onAddKey}
                                                className="h-7 w-64"
                                            />
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={commitAdd}
                                            >
                                                Save
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={cancelAdd}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                            {!flat.length && !loading && (
                                <TableRow>
                                    <TableCell
                                        colSpan={4}
                                        className="text-center text-xs text-muted-foreground py-6"
                                    >
                                        No categories yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
