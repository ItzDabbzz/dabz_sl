"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { toast } from "sonner";
import {
    CheckCheck,
    FileJson,
    Layers,
    Loader2,
    PackageCheck,
    Search,
    Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ItemDropzone from "./ItemDropzone";
import PathGroupRow from "./PathGroupRow";
import { parseItemsFile } from "../lib/parse-items";
import {
    groupByPath,
    pathKey,
    pathLabel,
    suggestCategory,
} from "../lib/category-matching";
import type { ScrapedItem } from "../lib/types";

/** A file that has been read and parsed. */
interface Loaded {
    fileName: string;
    kind: ReturnType<typeof parseItemsFile>["kind"];
    items: ScrapedItem[];
    /** Rows dropped because they repeat a URL already in the file. */
    duplicates: number;
    /** Rows with no URL — they cannot be matched to a category on import. */
    missingUrl: number;
}

/** A category path as stored by the API. */
interface StoredCategory {
    id: string;
    primary: string;
    sub?: string | null;
    sub2?: string | null;
    sub3?: string | null;
    sub4?: string | null;
    sub5?: string | null;
}

/** The assignment for one marketplace path. */
interface Assignment {
    /** The marketplace path this group came from. */
    path: string[];
    /** The category paths assigned to the group. */
    value: string[][];
    /** Whether the assignment is still the automatic suggestion. */
    suggested: boolean;
}

export default function Importer() {
    const [categories, setCategories] = useState<StoredCategory[]>([]);
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const res = await fetch("/api/tools/marketplace/categories", {
                    credentials: "include",
                });
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled) return;
                setCategories(Array.isArray(data.items) ? data.items : []);
            } catch {
                /* the picker degrades to an empty list; the import still works */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    /** Every category path that already exists. */
    const existingPaths = useMemo<string[][]>(
        () =>
            categories.map((c) =>
                [
                    c.primary,
                    c.sub,
                    c.sub2,
                    c.sub3,
                    c.sub4,
                    c.sub5,
                ]
                    .filter(
                        (level): level is string =>
                            typeof level === "string" &&
                            level !== "All" &&
                            level.trim().length > 0,
                    ),
            ),
        [categories],
    );

    const onFile = useCallback(
        async (file: File) => {
            setError(null);
            try {
                const text = await file.text();
                const parsed = parseItemsFile(text);

                if (!parsed.items.length) {
                    setLoaded(null);
                    setAssignments([]);
                    setError(
                        parsed.kind === "empty"
                            ? "That file is empty."
                            : "No items found in that file.",
                    );
                    return;
                }

                // Drop repeat URLs: the same product twice would import twice.
                const seen = new Set<string>();
                const items: ScrapedItem[] = [];
                let duplicates = 0;
                let missingUrl = 0;
                for (const it of parsed.items) {
                    if (!it.url) {
                        missingUrl++;
                        items.push(it);
                        continue;
                    }
                    if (seen.has(it.url)) {
                        duplicates++;
                        continue;
                    }
                    seen.add(it.url);
                    items.push(it);
                }

                setLoaded({
                    fileName: file.name,
                    kind: parsed.kind,
                    items,
                    duplicates,
                    missingUrl,
                });
                setQuery("");
            } catch (e) {
                setLoaded(null);
                setError(
                    e instanceof Error ? e.message : "Could not read that file.",
                );
            }
        },
        [],
    );

    const onClear = useCallback(() => {
        setLoaded(null);
        setAssignments([]);
        setError(null);
    }, []);

    /**
     * The groups: the marketplace paths, and how many items share each.
     *
     * This is the whole point. 2,000 items collapse into a few dozen
     * marketplace paths, and the work is per path rather than per item.
     */
    const groups = useMemo(() => {
        if (!loaded) return [];
        return groupByPath(loaded.items);
    }, [loaded]);

    /** The suggestion for every group, computed once per file/tree change. */
    const suggestions = useMemo(() => {
        const map = new Map<string, string[] | null>();
        for (const group of groups) {
            map.set(
                pathKey(group.path),
                suggestCategory(group.path, existingPaths),
            );
        }
        return map;
    }, [groups, existingPaths]);

    /** The assignment for a group, falling back to the suggestion. */
    const assignmentFor = useCallback(
        (path: string[]): string[][] => {
            const key = pathKey(path);
            const found = assignments.find((a) => pathKey(a.path) === key);
            if (found) return found.value;
            const suggestion = suggestions.get(key);
            return suggestion ? [suggestion] : [];
        },
        [assignments, suggestions],
    );

    const setAssignment = useCallback(
        (path: string[], value: string[][]) => {
            const key = pathKey(path);
            setAssignments((old) => {
                const next = old.filter((a) => pathKey(a.path) !== key);
                return [...next, { path, value, suggested: false }];
            });
        },
        [],
    );

    /** Accept every suggestion at once — the one-click path for a big import. */
    const acceptAll = useCallback(() => {
        setAssignments(
            groups.map((group) => {
                const key = pathKey(group.path);
                const suggestion = suggestions.get(key);
                return {
                    path: group.path,
                    value: suggestion ? [suggestion] : [],
                    suggested: Boolean(suggestion),
                };
            }),
        );
    }, [groups, suggestions]);

    const clearAll = useCallback(() => setAssignments([]), []);

    const visibleGroups = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return groups;
        return groups.filter((g) => {
            if (pathLabel(g.path).toLowerCase().includes(q)) return true;
            return g.items.some((it) =>
                it.title?.toLowerCase().includes(q),
            );
        });
    }, [groups, query]);

    const totalAssigned = useMemo(
        () =>
            groups.reduce(
                (sum, g) =>
                    sum + (assignmentFor(g.path).length ? g.items.length : 0),
                0,
            ),
        [groups, assignmentFor],
    );

    const unmatched = useMemo(
        () => groups.filter((g) => !assignmentFor(g.path).length),
        [groups, assignmentFor],
    );

    const onImport = async () => {
        if (!loaded?.items.length) return;
        setBusy(true);
        setError(null);
        try {
            // Every item gets the categories of the group it belongs to.
            const byUrl = new Map<string, string[][]>();
            for (const group of groups) {
                const value = assignmentFor(group.path);
                if (!value.length) continue;
                for (const item of group.items) {
                    if (item.url) byUrl.set(item.url, value);
                }
            }

            const res = await fetch("/api/tools/marketplace/items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    items: loaded.items,
                    assign: Array.from(byUrl.entries()).map(
                        ([url, paths]) => ({
                            url,
                            categories: paths.map((p) => ({ path: p })),
                        }),
                    ),
                }),
            });
            if (!res.ok) throw new Error("Import failed");
            const data = await res.json();
            const count = Array.isArray(data.items) ? data.items.length : 0;
            toast.success(`Imported ${count} item${count === 1 ? "" : "s"}`);
            setLoaded(null);
            setAssignments([]);
            if (typeof window !== "undefined") {
                const ids: string[] = Array.isArray(data.items)
                    ? data.items.map((x: any) => x.id).filter(Boolean)
                    : [];
                try {
                    sessionStorage.setItem(
                        "mp:lastImportedIds",
                        JSON.stringify(ids),
                    );
                    sessionStorage.setItem(
                        "mp:lastImportedAt",
                        String(Date.now()),
                    );
                } catch {
                    /* storage is optional */
                }
                window.dispatchEvent(
                    new CustomEvent("mp:itemsImported", {
                        detail: { ids, at: Date.now() },
                    }) as any,
                );
                window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
            }
        } catch (e: any) {
            const message = e?.message || "Import failed";
            setError(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Import items</CardTitle>
                </CardHeader>
                <CardContent>
                    <ItemDropzone
                        onFile={onFile}
                        onClear={onClear}
                        fileName={loaded?.fileName}
                        summary={
                            loaded
                                ? `${loaded.items.length.toLocaleString()} item${loaded.items.length === 1 ? "" : "s"} · ${describeKind(loaded.kind)}` +
                                  (loaded.duplicates
                                      ? ` · ${loaded.duplicates} duplicate${loaded.duplicates === 1 ? "" : "s"} skipped`
                                      : "") +
                                  (loaded.missingUrl
                                      ? ` · ${loaded.missingUrl} missing a URL`
                                      : "")
                                : undefined
                        }
                        error={error}
                        disabled={busy}
                    />
                </CardContent>
            </Card>

            {loaded && (
                <Card>
                    <CardHeader className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-base">
                                    {loaded.items.length.toLocaleString()} item
                                    {loaded.items.length === 1 ? "" : "s"}
                                </CardTitle>
                                <p
                                    role="status"
                                    aria-atomic="true"
                                    className="mt-0.5 text-xs text-muted-foreground"
                                >
                                    {groups.length.toLocaleString()} marketplace
                                    categor{groups.length === 1 ? "y" : "ies"} ·{" "}
                                    {totalAssigned.toLocaleString()} item
                                    {totalAssigned === 1 ? "" : "s"} categorised
                                    {unmatched.length > 0 && (
                                        <>
                                            {" · "}
                                            <span className="text-destructive">
                                                {unmatched.length} unmatched
                                            </span>
                                        </>
                                    )}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={acceptAll}
                                    disabled={busy || groups.length === 0}
                                >
                                    <Sparkles className="mr-1.5 h-4 w-4" />
                                    Accept all suggestions
                                </Button>
                                <Button
                                    onClick={onImport}
                                    disabled={busy}
                                    className="disabled:opacity-50"
                                >
                                    {busy ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Importing…
                                        </>
                                    ) : (
                                        <>
                                            <PackageCheck className="mr-2 h-4 w-4" />
                                            Import{" "}
                                            {loaded.items.length.toLocaleString()}{" "}
                                            item
                                            {loaded.items.length === 1 ? "" : "s"}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-wrap items-end gap-3">
                            <div className="min-w-[14rem] flex-1 space-y-1.5">
                                <Label htmlFor="import-search">
                                    Search categories
                                </Label>
                                <div className="relative">
                                    <Search
                                        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                        aria-hidden
                                    />
                                    <Input
                                        id="import-search"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Marketplace path or item title"
                                        className="pl-8"
                                    />
                                </div>
                            </div>
                            <p className="pb-2 text-xs text-muted-foreground">
                                Match marketplace categories to yours — each
                                row is one path, not one item.
                            </p>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        {visibleGroups.length === 0 ? (
                            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                                Nothing matches that search.
                            </p>
                        ) : (
                            <Virtuoso
                                data={visibleGroups}
                                className="themed-scrollbar max-h-[38rem]"
                                overscan={200}
                                itemContent={(_index, group) => (
                                    <PathGroupRow
                                        marketplacePath={group.path}
                                        count={group.items.length}
                                        sample={group.items}
                                        value={assignmentFor(group.path)}
                                        onChange={(next) =>
                                            setAssignment(group.path, next)
                                        }
                                        existing={existingPaths}
                                        suggested={
                                            Boolean(
                                                suggestions.get(
                                                    pathKey(group.path),
                                                ),
                                            ) &&
                                            !assignments.some(
                                                (a) =>
                                                    pathKey(a.path) ===
                                                        pathKey(group.path),
                                            )
                                        }
                                        disabled={busy}
                                    />
                                )}
                            />
                        )}
                    </CardContent>

                    {assignments.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 rounded-b-lg border-t border-border bg-card/95 px-4 py-3">
                            <span className="text-sm font-medium">
                                <CheckCheck className="mr-1.5 inline h-4 w-4" />
                                {assignments.length} categor
                                {assignments.length === 1 ? "y" : "ies"} matched
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearAll}
                                disabled={busy}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Clear all matches
                            </Button>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}

/** A short name for a file format. */
function describeKind(kind: string): string {
    if (kind === "json") return "JSON";
    if (kind === "jsonl") return "JSONL";
    if (kind === "checkpoint") return "checkpoint";
    return "file";
}
