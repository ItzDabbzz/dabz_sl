"use client";

import { useEffect, useMemo, useState } from "react";
import {
    FolderOpen,
    FolderClosed,
    Tag,
    Plus,
    Pencil,
    Trash2,
    ChevronDown,
    ChevronRight,
    Search,
    Check,
    X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

/**
 * Marketplace Categories Editor
 *
 * Features:
 * - List, search and group categories by primary name
 * - Add primary + sub categories
 * - Inline edit for subcategory chips (subcategory-only)
 * - Rename a primary category from the group header
 * - Delete a category with confirmation
 * - Expand/Collapse all groups and sort primaries/subs
 */

type Category = { id: string; primary: string; sub: string };

/*

  TODO: Category TODO
  - [x] Rename category (primary + sub)
  - [x] More intuitive ui for editing sub categories (inline chip editing)
  - [x] Delete category (with confirmation)
  - [x] Collapse all / Expand all quick buttons along with sorting options
  - [ ] Add indepth JSDoc and comments explaining things (initial pass added)

*/

export default function CategoriesEditor() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [primary, setPrimary] = useState("");
    const [sub, setSub] = useState("All");
    // Dialog for renaming a PRIMARY only
    const [primaryEdit, setPrimaryEdit] = useState<
        null | { primary: string; newPrimary: string }
    >(null);
    const [filterText, setFilterText] = useState("");
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [addingFor, setAddingFor] = useState<string | null>(null);
    const [subInput, setSubInput] = useState("");
    // Sorting and inline editing states
    const [primarySort, setPrimarySort] = useState<
        "name-asc" | "name-desc" | "count-asc" | "count-desc"
    >("name-asc");
    const [subSort, setSubSort] = useState<"name-asc" | "name-desc">(
        "name-asc",
    );
    const [editingSubId, setEditingSubId] = useState<string | null>(null);
    const [editingSubValue, setEditingSubValue] = useState("");
    const [confirmDelete, setConfirmDelete] = useState<null | {
        id: string;
        label: string;
    }>(null);

    /** Load categories from API and populate state */
    const loadCategories = async () => {
        const res = await fetch("/api/tools/marketplace/categories", {
            credentials: "include",
        });
        if (res.ok) {
            const data = await res.json();
            setCategories(data.items || []);
        }
    };

    useEffect(() => {
        loadCategories();
        const onChanged = () => loadCategories();
        window.addEventListener("mp:categoriesChanged" as any, onChanged);
        return () =>
            window.removeEventListener(
                "mp:categoriesChanged" as any,
                onChanged,
            );
    }, []);

    /** Add a new category. If sub is empty, defaults to "All" */
    const onAddCategory = async () => {
        if (!primary.trim()) return;
        const res = await fetch("/api/tools/marketplace/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                primary: primary.trim(),
                sub: (sub || "All").trim(),
            }),
        });
        if (res.ok) {
            setPrimary("");
            setSub("All");
            loadCategories();
            window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
        }
    };

    /** Rename a PRIMARY category for all its subcategories */
    const renamePrimary = async () => {
        if (!primaryEdit) return;
        const from = primaryEdit.primary;
        const to = primaryEdit.newPrimary.trim();
        if (!to || to === from) {
            setPrimaryEdit(null);
            return;
        }
        const items = grouped[from] || [];
        await Promise.all(
            items.map((c) =>
                fetch(`/api/tools/marketplace/categories/${c.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ primary: to, sub: c.sub }),
                }),
            ),
        );
        setPrimaryEdit(null);
        loadCategories();
        window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
    };

    /** Inline save for subcategory rename */
    const saveSubInline = async (cat: Category, newSub: string) => {
        const nextSub = (newSub || "All").trim();
        if (!nextSub || nextSub === cat.sub) {
            setEditingSubId(null);
            setEditingSubValue("");
            return;
        }
        await fetch(`/api/tools/marketplace/categories/${cat.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ primary: cat.primary, sub: nextSub }),
        });
        setEditingSubId(null);
        setEditingSubValue("");
        loadCategories();
        window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
    };

    /** Ask confirmation before deleting a category */
    const deleteCategory = async (id: string) => {
        await fetch(`/api/tools/marketplace/categories/${id}`, {
            method: "DELETE",
            credentials: "include",
        });
        loadCategories();
        window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
    };

    // Group categories by primary
    const grouped = useMemo(
        () =>
            categories.reduce((acc: Record<string, Category[]>, c) => {
                acc[c.primary] = acc[c.primary] || [];
                acc[c.primary].push(c);
                return acc;
            }, {}),
        [categories],
    );

    // Filter and sort primary keys according to search and selected sort
    const filteredPrimaries = useMemo(() => {
        const f = filterText.trim().toLowerCase();
        let keys = Object.keys(grouped);
        if (f) {
            keys = keys.filter(
                (p) =>
                    p.toLowerCase().includes(f) ||
                    grouped[p].some((c) => c.sub.toLowerCase().includes(f)),
            );
        }
        keys.sort((a, b) => {
            const countA = grouped[a]?.length || 0;
            const countB = grouped[b]?.length || 0;
            switch (primarySort) {
                case "name-desc":
                    return b.localeCompare(a);
                case "count-asc":
                    return countA === countB
                        ? a.localeCompare(b)
                        : countA - countB;
                case "count-desc":
                    return countA === countB
                        ? a.localeCompare(b)
                        : countB - countA;
                case "name-asc":
                default:
                    return a.localeCompare(b);
            }
        });
        return keys;
    }, [grouped, filterText, primarySort]);

    /** Add a subcategory to a primary. If empty, defaults to "All" */
    const onAddSub = async (p: string) => {
        const s = subInput.trim() || "All";
        if (!p.trim()) return;
        await fetch("/api/tools/marketplace/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ primary: p.trim(), sub: s }),
        });
        setAddingFor(null);
        setSubInput("");
        loadCategories();
        window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
    };

    // Expand/Collapse helpers for quick toggling all groups
    const expandAll = () =>
        setExpanded(
            Object.fromEntries(Object.keys(grouped).map((k) => [k, true])),
        );
    const collapseAll = () =>
        setExpanded(
            Object.fromEntries(Object.keys(grouped).map((k) => [k, false])),
        );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Toolbar: search, expand/collapse all, sorting, add new */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            className="w-64 pl-8"
                            placeholder="Search categories…"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={expandAll}>
                            <ChevronDown className="mr-1 h-3 w-3" /> Expand all
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={collapseAll}
                        >
                            <ChevronRight className="mr-1 h-3 w-3" /> Collapse
                            all
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">
                            Primary sort
                        </label>
                        <select
                            className="h-9 rounded-md border bg-background px-2 text-sm"
                            value={primarySort}
                            onChange={(e) =>
                                setPrimarySort(e.target.value as any)
                            }
                        >
                            <option value="name-asc">Name (A→Z)</option>
                            <option value="name-desc">Name (Z→A)</option>
                            <option value="count-asc">Count (low→high)</option>
                            <option value="count-desc">Count (high→low)</option>
                        </select>
                        <label className="ml-2 text-xs text-muted-foreground">
                            Sub sort
                        </label>
                        <select
                            className="h-9 rounded-md border bg-background px-2 text-sm"
                            value={subSort}
                            onChange={(e) => setSubSort(e.target.value as any)}
                        >
                            <option value="name-asc">Name (A→Z)</option>
                            <option value="name-desc">Name (Z→A)</option>
                        </select>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <Input
                            placeholder="New primary"
                            value={primary}
                            onChange={(e) => setPrimary(e.target.value)}
                        />
                        <Input
                            placeholder="Sub (optional)"
                            value={sub}
                            onChange={(e) => setSub(e.target.value)}
                        />
                        <Button
                            onClick={onAddCategory}
                            className="inline-flex items-center gap-1"
                        >
                            <Plus className="h-4 w-4" /> Add
                        </Button>
                    </div>
                </div>

                <div className="space-y-2 mt-1">
                    {filteredPrimaries.map((p) => {
                        const subs = (grouped[p] || []).sort((a, b) =>
                            subSort === "name-desc"
                                ? b.sub.localeCompare(a.sub)
                                : a.sub.localeCompare(b.sub),
                        );
                        const isOpen = expanded[p] ?? true;
                        return (
                            <Collapsible
                                key={p}
                                open={isOpen}
                                onOpenChange={(o) =>
                                    setExpanded((old) => ({ ...old, [p]: o }))
                                }
                            >
                                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                    <CollapsibleTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                        >
                                            {isOpen ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </CollapsibleTrigger>
                                    {isOpen ? (
                                        <FolderOpen className="h-4 w-4 text-foreground/80" />
                                    ) : (
                                        <FolderClosed className="h-4 w-4 text-foreground/80" />
                                    )}
                                    <div className="font-medium">{p}</div>
                                    <Badge variant="secondary" className="ml-2">
                                        {subs.length}
                                    </Badge>
                                    {/* Rename PRIMARY button */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        title="Rename primary"
                                        onClick={() =>
                                            setPrimaryEdit({
                                                primary: p,
                                                newPrimary: p,
                                            })
                                        }
                                        className="h-7 w-7 ml-1"
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                    <div className="ml-auto">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="inline-flex items-center gap-1"
                                            onClick={() => {
                                                setAddingFor(p);
                                                setSubInput("");
                                                setExpanded((o) => ({
                                                    ...o,
                                                    [p]: true,
                                                }));
                                            }}
                                        >
                                            <Plus className="h-3 w-3" /> Add
                                            subcategory
                                        </Button>
                                    </div>
                                </div>
                                <CollapsibleContent>
                                    <div className="px-3 pb-3">
                                        {addingFor === p && (
                                            <div className="mb-2 flex items-center gap-2">
                                                <Tag className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="New subcategory name"
                                                    value={subInput}
                                                    onChange={(e) =>
                                                        setSubInput(
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <Button
                                                    onClick={() => onAddSub(p)}
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setAddingFor(null);
                                                        setSubInput("");
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        )}
                                        <div className="mt-1 flex flex-wrap gap-2">
                                            {subs.map((c) => (
                                                <span
                                                    key={c.id}
                                                    className="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs"
                                                >
                                                    <Tag className="h-3 w-3 text-muted-foreground" />
                                                    {editingSubId === c.id ? (
                                                        <>
                                                            <Input
                                                                className="h-7 w-40"
                                                                autoFocus
                                                                value={
                                                                    editingSubValue
                                                                }
                                                                onChange={(e) =>
                                                                    setEditingSubValue(
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                onKeyDown={(e) => {
                                                                    if (
                                                                        e.key ===
                                                                        "Enter"
                                                                    )
                                                                        saveSubInline(
                                                                            c,
                                                                            editingSubValue,
                                                                        );
                                                                    if (
                                                                        e.key ===
                                                                        "Escape"
                                                                    ) {
                                                                        setEditingSubId(
                                                                            null,
                                                                        );
                                                                        setEditingSubValue(
                                                                            "",
                                                                        );
                                                                    }
                                                                }}
                                                            />
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                title="Save"
                                                                onClick={() =>
                                                                    saveSubInline(
                                                                        c,
                                                                        editingSubValue,
                                                                    )
                                                                }
                                                                className="h-6 w-6"
                                                            >
                                                                <Check className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                title="Cancel"
                                                                onClick={() => {
                                                                    setEditingSubId(
                                                                        null,
                                                                    );
                                                                    setEditingSubValue(
                                                                        "",
                                                                    );
                                                                }}
                                                                className="h-6 w-6"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>{c.sub}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                title="Rename subcategory"
                                                                onClick={() => {
                                                                    setEditingSubId(
                                                                        c.id,
                                                                    );
                                                                    setEditingSubValue(
                                                                        c.sub,
                                                                    );
                                                                }}
                                                                className="h-6 w-6"
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                title="Delete"
                                                                onClick={() =>
                                                                    setConfirmDelete(
                                                                        {
                                                                            id: c.id,
                                                                            label: `${c.primary} / ${c.sub}`,
                                                                        },
                                                                    )
                                                                }
                                                                className="h-6 w-6"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </span>
                                            ))}
                                            {!subs.length && (
                                                <div className="text-xs text-muted-foreground">
                                                    No subcategories
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        );
                    })}
                    {!filteredPrimaries.length && (
                        <div className="text-sm text-muted-foreground">
                            No categories match your search.
                        </div>
                    )}
                </div>

                {/* Dialog: rename PRIMARY */}
                <Dialog
                    open={!!primaryEdit}
                    onOpenChange={(o) => !o && setPrimaryEdit(null)}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Rename primary</DialogTitle>
                        </DialogHeader>
                        <div className="mt-2 space-y-2">
                            <Input
                                placeholder="New name"
                                value={primaryEdit?.newPrimary || ""}
                                onChange={(e) =>
                                    setPrimaryEdit((old) =>
                                        old
                                            ? {
                                                  ...old,
                                                  newPrimary: e.target.value,
                                              }
                                            : old,
                                    )
                                }
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setPrimaryEdit(null)}
                            >
                                Cancel
                            </Button>
                            <Button onClick={renamePrimary}>Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Dialog: delete confirmation */}
                <Dialog
                    open={!!confirmDelete}
                    onOpenChange={(o) => !o && setConfirmDelete(null)}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete category?</DialogTitle>
                        </DialogHeader>
                        <div className="text-sm text-muted-foreground">
                            {confirmDelete ? (
                                <>
                                    Are you sure you want to delete "
                                    {confirmDelete.label}"? This action cannot
                                    be undone.
                                </>
                            ) : null}
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setConfirmDelete(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={async () => {
                                    if (confirmDelete) {
                                        await deleteCategory(confirmDelete.id);
                                        setConfirmDelete(null);
                                    }
                                }}
                            >
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
