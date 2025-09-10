"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { 
    ChevronRight, ChevronDown, Plus, Pencil, Trash2, Search, SortAsc, X, Check 
} from "lucide-react";

interface Category { id: string; primary: string; sub: string; sub2?: string | null }
type NodeKind = "primary" | "sub" | "sub2";
interface FlatRow {
    key: string;              // unique composite key
    id?: string;              // db id for sub2 rows and base rows
    kind: NodeKind;
    primary: string;
    sub?: string;
    sub2?: string;
    name: string;
    depth: number;
    childCount: number;       // number of immediate children
    totalDesc?: number;       // total descendants (for sorting if needed)
    deletableIds: string[];   // ids to delete when removing this logical node
}

export default function CategoriesEditor() {
    // Data
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);

    // UI / filter / sort
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<"name" | "count">("name");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    // Expansion: store keys like p:<primary> or s:<primary>/<sub>
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

    // Editing state
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");

        // Adding state (insert row below a node) – for root we use special key "root"
    const [addingUnder, setAddingUnder] = useState<null | { kind: "root" | NodeKind; primary?: string; sub?: string }>(null);
    const [addingValue, setAddingValue] = useState("");

            // Pending focus/scroll after mutation & highlight
            const [pendingFocus, setPendingFocus] = useState<null | { kind: NodeKind | "primary" | "sub" | "sub2"; primary: string; sub?: string; sub2?: string }>(null);
            const [highlightKey, setHighlightKey] = useState<string | null>(null);
            const containerRef = useCallback((el: HTMLDivElement | null) => { (window as any).__catTable = el; }, []);

    // Delete confirm
    const [deleting, setDeleting] = useState<null | { label: string; ids: string[] }>(null);

    // Load categories
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch("/api/tools/marketplace/categories", { credentials: "include" });
            if (!r.ok) throw new Error("failed");
            const d = await r.json();
            setCategories(d.items || []);
        } catch (e) {
            toast.error("Failed to load categories");
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); const h = () => load(); window.addEventListener("mp:categoriesChanged" as any, h); return () => window.removeEventListener("mp:categoriesChanged" as any, h); }, [load]);

    // Build tree grouping
    interface SubGroup { sub: string; base?: Category; sub2: Category[] };
    interface PrimaryGroup { primary: string; subs: Record<string, SubGroup> };
    const tree = useMemo(() => {
        const prim: Record<string, PrimaryGroup> = {};
        for (const c of categories) {
            if (!prim[c.primary]) prim[c.primary] = { primary: c.primary, subs: {} };
            const pg = prim[c.primary];
            if (!pg.subs[c.sub]) pg.subs[c.sub] = { sub: c.sub, sub2: [] };
            const sg = pg.subs[c.sub];
            if ((c.sub2 || "All") === "All") sg.base = c; else sg.sub2.push(c);
        }
        return prim;
    }, [categories]);

    // Flatten respecting expansion & filters
    const flat = useMemo<FlatRow[]>(() => {
        const rows: FlatRow[] = [];
        const q = query.trim().toLowerCase();
        const match = (name: string) => !q || name.toLowerCase().includes(q);

        // Build sortable primary list with counts
        const primaryMeta = Object.keys(tree).map(p => {
            const pg = tree[p];
            const subKeys = Object.keys(pg.subs);
            const totalSub2 = subKeys.reduce((acc, s) => acc + pg.subs[s].sub2.length, 0);
            return { p, subKeys, totalSub2 };
        });

        primaryMeta.sort((a,b) => {
            let cmp: number;
            if (sort === "name") cmp = a.p.localeCompare(b.p);
            else cmp = (a.totalSub2 - b.totalSub2);
            return sortDir === "asc" ? cmp : -cmp;
        });

        for (const meta of primaryMeta) {
            const p = meta.p;
            const primaryGroup = tree[p];
            const subKeys = [...meta.subKeys];
            // Filter early – determine if any descendant matches search
            const primaryMatches = match(p) || subKeys.some(sk => match(sk) || primaryGroup.subs[sk].sub2.some(s2 => match(s2.sub2 || "")));
            if (!primaryMatches) continue;
            // Sort sub keys per selection
            subKeys.sort((a,b) => {
                if (sort === "name") {
                    const cmp = a.localeCompare(b);
                    return sortDir === "asc" ? cmp : -cmp;
                } else {
                    const ca = primaryGroup.subs[a].sub2.length;
                    const cb = primaryGroup.subs[b].sub2.length;
                    const cmp = ca - cb;
                    return sortDir === "asc" ? cmp : -cmp;
                }
            });

            const primaryKey = `p:${p}`;
            rows.push({
                key: primaryKey,
                kind: "primary",
                name: p,
                primary: p,
                depth: 0,
                childCount: subKeys.length,
                totalDesc: meta.totalSub2,
                deletableIds: categories.filter(c => c.primary === p).map(c => c.id)
            });

            if (!expanded.has(primaryKey)) continue;

            for (const s of subKeys) {
                const sg = primaryGroup.subs[s];
                const sub2Children = sg.sub2;
                const subMatches = match(s) || sub2Children.some(c => match(c.sub2 || ""));
                if (!subMatches) continue;
                const subKey = `s:${p}/${s}`;
                rows.push({
                    key: subKey,
                    kind: "sub",
                    name: s,
                    primary: p,
                    sub: s,
                    depth: 1,
                    childCount: sub2Children.length,
                    totalDesc: sub2Children.length,
                    deletableIds: categories.filter(c => c.primary === p && c.sub === s).map(c => c.id),
                    id: sg.base?.id
                });
                if (!expanded.has(subKey)) continue;
                const orderedSub2 = [...sub2Children].sort((a,b) => (a.sub2 || "").localeCompare(b.sub2 || ""));
                for (const s2 of orderedSub2) {
                    const s2Name = s2.sub2 || "";
                    if (!match(s2Name)) continue;
                    rows.push({
                        key: `u:${s2.id}`,
                        id: s2.id,
                        kind: "sub2",
                        name: s2Name,
                        primary: p,
                        sub: s,
                        sub2: s2Name,
                        depth: 2,
                        childCount: 0,
                        deletableIds: [s2.id]
                    });
                }
            }
        }
        return rows; // already hierarchically ordered
    }, [tree, expanded, query, sort, sortDir, categories]);

    // Expansion toggles
    const toggle = (key: string) => setExpanded(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
    const expandAll = () => { const all = new Set<string>(); Object.keys(tree).forEach(p => { all.add(`p:${p}`); Object.keys(tree[p].subs).forEach(s=> all.add(`s:${p}/${s}`)); }); setExpanded(all); };
    const collapseAll = () => setExpanded(new Set());

    // Editing
    const startEdit = (row: FlatRow) => { setEditingKey(row.key); setEditingValue(row.name); };
    const cancelEdit = () => { setEditingKey(null); setEditingValue(""); };
    const commitEdit = async () => {
        if (!editingKey) return; const row = flat.find(r => r.key === editingKey); if (!row) return; const newName = editingValue.trim(); if (!newName || newName === row.name) { cancelEdit(); return; }
        try {
            if (row.kind === "primary") {
                // Patch every category with this primary
                const targets = categories.filter(c => c.primary === row.primary);
                await Promise.all(targets.map(c => fetch(`/api/tools/marketplace/categories/${c.id}`, { method: "PATCH", headers: {"Content-Type":"application/json"}, credentials:"include", body: JSON.stringify({ primary: newName, sub: c.sub, sub2: c.sub2 }) } )));
            } else if (row.kind === "sub") {
                const targets = categories.filter(c => c.primary === row.primary && c.sub === row.sub);
                await Promise.all(targets.map(c => fetch(`/api/tools/marketplace/categories/${c.id}`, { method: "PATCH", headers:{"Content-Type":"application/json"}, credentials:"include", body: JSON.stringify({ primary: c.primary, sub: newName, sub2: c.sub2 }) }) ));
            } else if (row.kind === "sub2" && row.id) {
                await fetch(`/api/tools/marketplace/categories/${row.id}`, { method: "PATCH", headers:{"Content-Type":"application/json"}, credentials:"include", body: JSON.stringify({ primary: row.primary, sub: row.sub, sub2: newName }) });
            }
            toast.success("Updated");
            cancelEdit();
            load();
            window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
        } catch { toast.error("Update failed"); }
    };

    // Adding
    const beginAddPrimary = () => { setAddingUnder({ kind: "root" }); setAddingValue(""); };
    const beginAddSub = (row: FlatRow) => { setAddingUnder({ kind: "primary", primary: row.primary }); setAddingValue(""); expanded.add(row.key); setExpanded(new Set(expanded)); };
    const beginAddSub2 = (row: FlatRow) => { setAddingUnder({ kind: "sub", primary: row.primary, sub: row.sub }); setAddingValue(""); expanded.add(row.key); setExpanded(new Set(expanded)); };
    const cancelAdd = () => { setAddingUnder(null); setAddingValue(""); };
        const commitAdd = async () => {
            if (!addingUnder) return; const val = addingValue.trim(); if (!val) { cancelAdd(); return; }
            try {
                if (addingUnder.kind === "root") {
                    await fetch("/api/tools/marketplace/categories", { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"include", body: JSON.stringify({ primary: val, sub: "All", sub2: "All" }) });
                    setPendingFocus({ kind: "primary", primary: val });
                } else if (addingUnder.kind === "primary") {
                    await fetch("/api/tools/marketplace/categories", { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"include", body: JSON.stringify({ primary: addingUnder.primary, sub: val, sub2: "All" }) });
                    setPendingFocus({ kind: "sub", primary: addingUnder.primary!, sub: val });
                } else if (addingUnder.kind === "sub") {
                    await fetch("/api/tools/marketplace/categories", { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"include", body: JSON.stringify({ primary: addingUnder.primary, sub: addingUnder.sub, sub2: val }) });
                    setPendingFocus({ kind: "sub2", primary: addingUnder.primary!, sub: addingUnder.sub!, sub2: val });
                }
                toast.success("Added");
                cancelAdd();
                load();
                window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
            } catch { toast.error("Add failed"); }
        };

    // Delete
    const confirmDelete = (row: FlatRow) => {
        let label = row.name;
        if (row.kind === "sub") label = `${row.primary} / ${row.sub}`;
        if (row.kind === "sub2") label = `${row.primary} / ${row.sub} / ${row.sub2}`;
        setDeleting({ label, ids: row.deletableIds });
    };
    const performDelete = async () => {
        if (!deleting) return; try {
            await Promise.all(deleting.ids.map(id => fetch(`/api/tools/marketplace/categories/${id}`, { method: "DELETE", credentials:"include" }))); toast.success("Deleted");
            setDeleting(null); load(); window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
        } catch { toast.error("Delete failed"); }
    };

    // Keyboard support for editing/add
    const onEditKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") { commitEdit(); } if (e.key === "Escape") { cancelEdit(); } };
    const onAddKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") cancelAdd(); };

        // After flat rebuild, if we have pendingFocus, scroll & highlight
            useEffect(() => {
                if (!pendingFocus || !flat.length) return;
                // ensure parents expanded
                const target = flat.find(r => (pendingFocus.kind === r.kind && r.primary === pendingFocus.primary && (r.sub ?? undefined) === (pendingFocus.sub ?? undefined) && (r.sub2 ?? undefined) === (pendingFocus.sub2 ?? undefined)) || (pendingFocus.kind === "primary" && r.kind === "primary" && r.primary === pendingFocus.primary) || (pendingFocus.kind === "sub" && r.kind === "sub" && r.primary === pendingFocus.primary && r.sub === pendingFocus.sub) || (pendingFocus.kind === "sub2" && r.kind === "sub2" && r.primary === pendingFocus.primary && r.sub === pendingFocus.sub && r.sub2 === pendingFocus.sub2));
                if (!target) return;
                if (target.kind === "sub" || target.kind === "sub2") {
                    const pKey = `p:${target.primary}`; if (!expanded.has(pKey)) setExpanded(e => new Set(e).add(pKey));
                }
                if (target.kind === "sub2") {
                    const sKey = `s:${target.primary}/${target.sub}`; if (!expanded.has(sKey)) setExpanded(e => new Set(e).add(sKey));
                }
                requestAnimationFrame(() => {
                    const el = (window as any).__catTable?.querySelector?.(`[data-row-key="${target.key}"]`);
                    if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
                    setHighlightKey(target.key); setTimeout(()=> setHighlightKey(k => k === target.key ? null : k), 2400);
                });
                setPendingFocus(null);
            }, [pendingFocus, flat, expanded]);

        return (
        <Card className="overflow-hidden">
            <CardHeader className="space-y-2">
                <CardTitle className="text-base">Categories</CardTitle>
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={query} onChange={e=> setQuery(e.target.value)} placeholder="Search…" className="pl-8 w-60" />
                    </div>
                    <Button variant="outline" size="sm" onClick={expandAll}><ChevronDown className="h-3 w-3 mr-1" />Expand</Button>
                    <Button variant="outline" size="sm" onClick={collapseAll}><ChevronRight className="h-3 w-3 mr-1" />Collapse</Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm"><SortAsc className="h-4 w-4 mr-1" />Sort</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuItem onClick={()=> { setSort("name"); setSortDir("asc"); }}>Name A→Z</DropdownMenuItem>
                            <DropdownMenuItem onClick={()=> { setSort("name"); setSortDir("desc"); }}>Name Z→A</DropdownMenuItem>
                            <DropdownMenuItem onClick={()=> { setSort("count"); setSortDir("desc"); }}>Children High→Low</DropdownMenuItem>
                            <DropdownMenuItem onClick={()=> { setSort("count"); setSortDir("asc"); }}>Children Low→High</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="sm" onClick={beginAddPrimary}><Plus className="h-4 w-4 mr-1" />Primary</Button>
                    {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
                    {deleting && (
                        <div className="ml-auto flex items-center gap-2 text-xs bg-destructive/10 px-2 py-1 rounded">
                            <span>Delete {deleting.label}? ({deleting.ids.length})</span>
                            <Button size="sm" variant="destructive" onClick={performDelete}>Confirm</Button>
                            <Button size="sm" variant="outline" onClick={()=> setDeleting(null)}>Cancel</Button>
                        </div>
                    )}
                </div>
            </CardHeader>
                                    <CardContent className="p-0">
                                        <div ref={containerRef} className="overflow-auto max-h-[70vh]">
                                            <Table className="text-sm">
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[420px]">Name</TableHead>
                                                        <TableHead>Type</TableHead>
                                                        <TableHead className="w-24">Children</TableHead>
                                                        <TableHead className="text-right w-40">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {flat.map(row => {
                                                        const isEditing = editingKey === row.key;
                                                        const padding = row.depth * 16;
                                                        const expandable = row.kind !== "sub2" && row.childCount > 0;
                                                        const isExpanded = expanded.has(row.key);
                                                        return (
                                                            <TableRow key={row.key} data-row-key={row.key} className={highlightKey === row.key ? "animate-pulse bg-accent/50" : "hover:bg-muted/40"}>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-1" style={{ paddingLeft: padding }}>
                                                                        {expandable && (
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={()=> toggle(row.key)}>
                                                                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                                            </Button>
                                                                        )}
                                                                        {!expandable && <span className="inline-block w-6" />}
                                                                        {isEditing ? (
                                                                            <div className="flex items-center gap-1 w-full">
                                                                                <Input autoFocus value={editingValue} onChange={e=> setEditingValue(e.target.value)} onKeyDown={onEditKey} className="h-7 w-full" />
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={commitEdit}><Check className="h-3 w-3" /></Button>
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}><X className="h-3 w-3" /></Button>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                <span className="truncate" title={row.name}>{row.name}</span>
                                                                                {row.kind !== "primary" && row.kind !== "sub2" && row.childCount === 0 && <Badge variant="outline">empty</Badge>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="capitalize">{row.kind}</TableCell>
                                                                <TableCell>{row.childCount || (row.kind === "sub2" ? "-" : 0)}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex justify-end gap-1">
                                                                        {row.kind !== "sub2" && (
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Add child" onClick={()=> row.kind === "primary" ? beginAddSub(row) : beginAddSub2(row)}>
                                                                                <Plus className="h-4 w-4" />
                                                                            </Button>
                                                                        )}
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Rename" onClick={() => startEdit(row)}><Pencil className="h-4 w-4" /></Button>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete" onClick={()=> confirmDelete(row)}><Trash2 className="h-4 w-4" /></Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                    {addingUnder && (
                                                        <TableRow className="bg-muted/30">
                                                            <TableCell colSpan={4}>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">Add {addingUnder.kind === "root" ? "primary" : addingUnder.kind === "primary" ? "sub" : "sub2"}</span>
                                                                    <Input autoFocus value={addingValue} onChange={e=> setAddingValue(e.target.value)} onKeyDown={onAddKey} className="h-7 w-64" />
                                                                    <Button variant="secondary" size="sm" onClick={commitAdd}>Save</Button>
                                                                    <Button variant="ghost" size="sm" onClick={cancelAdd}>Cancel</Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                    {!flat.length && !loading && (
                                                        <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">No categories yet.</TableCell></TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
        </Card>
    );
}
