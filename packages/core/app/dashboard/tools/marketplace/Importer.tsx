"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderOpen, FolderClosed, Tag, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Search, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type MpItem = {
  url: string;
  title: string;
  version?: string;
  images?: string[];
  price?: string;
  creator?: { name: string; link: string };
  store?: string;
  permissions?: { copy: string; modify: string; transfer: string };
  description?: string;
  features?: string[];
  contents?: string[];
  updatedOn?: string;
};

type Category = { id: string; primary: string; sub: string };

export default function Importer() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [primary, setPrimary] = useState("");
  const [sub, setSub] = useState("All");
  const [items, setItems] = useState<MpItem[]>([]);
  const [assign, setAssign] = useState<Record<string, { primary: string; sub?: string }[]>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; primary: string; sub: string } | null>(null);
  const [filterText, setFilterText] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [subInput, setSubInput] = useState("");

  const loadCategories = async () => {
    const res = await fetch("/api/tools/marketplace/categories", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setCategories(data.items || []);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const onAddCategory = async () => {
    if (!primary.trim()) return;
    const res = await fetch("/api/tools/marketplace/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ primary: primary.trim(), sub: (sub || "All").trim() }),
    });
    if (res.ok) {
      setPrimary("");
      setSub("All");
      loadCategories();
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
    }
  };

  const onFile = async (f: File) => {
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      const arr: MpItem[] = Array.isArray(json) ? json : (Array.isArray(json.items) ? json.items : []);
      setItems(arr);
      setMessage(`Loaded ${arr.length} items from ${f.name}`);
    } catch (e) {
      setMessage("Invalid JSON file");
    }
  };

  const onAssign = (url: string, p: string, s?: string) => {
    setAssign((old) => {
      const list = old[url] ? [...old[url]] : [];
      const exists = list.some((c) => c.primary === p && (c.sub || "All") === (s || "All"));
      if (!exists) list.push({ primary: p, sub: s || "All" });
      return { ...old, [url]: list };
    });
  };

  const onImport = async () => {
    if (!items.length) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/tools/marketplace/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items, assign: Object.entries(assign).map(([url, categories]) => ({ url, categories })) }),
      });
      if (!res.ok) throw new Error("Import failed");
      const data = await res.json();
      setMessage(`Imported ${data.items?.length ?? 0} items`);
      setItems([]);
      setAssign({});
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mp:itemsImported"));
        window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
      }
    } catch (e: any) {
      setMessage(e.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const primaries = useMemo(() => Array.from(new Set(categories.map((c) => c.primary))).sort(), [categories]);
  const subsFor = (p: string) => categories.filter((c) => c.primary === p).map((c) => c.sub);

  const renameCategory = async () => {
    if (!edit) return;
    await fetch(`/api/tools/marketplace/categories/${edit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ primary: edit.primary, sub: edit.sub }),
    });
    setEdit(null);
    loadCategories();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
  };

  const deleteCategory = async (id: string) => {
    await fetch(`/api/tools/marketplace/categories/${id}`, { method: "DELETE", credentials: "include" });
    loadCategories();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
  };

  const grouped = useMemo(() =>
    categories.reduce((acc: Record<string, Category[]>, c) => {
      acc[c.primary] = acc[c.primary] || [];
      acc[c.primary].push(c);
      return acc;
    }, {}), [categories]);

  const filteredPrimaries = useMemo(() => {
    const f = filterText.trim().toLowerCase();
    if (!f) return Object.keys(grouped).sort();
    return Object.keys(grouped)
      .filter((p) => p.toLowerCase().includes(f) || grouped[p].some((c) => c.sub.toLowerCase().includes(f)))
      .sort();
  }, [grouped, filterText]);

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
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
              <Button onClick={onAddCategory} className="inline-flex items-center gap-1">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          <div className="space-y-2 mt-1">
            {filteredPrimaries.map((p) => {
              const subs = (grouped[p] || []).sort((a, b) => a.sub.localeCompare(b.sub));
              const isOpen = expanded[p] ?? true;
              return (
                <Collapsible key={p} open={isOpen} onOpenChange={(o) => setExpanded((old) => ({ ...old, [p]: o }))}>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    {isOpen ? <FolderOpen className="h-4 w-4 text-foreground/80" /> : <FolderClosed className="h-4 w-4 text-foreground/80" />}
                    <div className="font-medium">{p}</div>
                    <Badge variant="secondary" className="ml-2">{subs.length}</Badge>
                    <div className="ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="inline-flex items-center gap-1"
                        onClick={() => { setAddingFor(p); setSubInput(""); setExpanded((o) => ({ ...o, [p]: true })); }}
                      >
                        <Plus className="h-3 w-3" /> Add subcategory
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
                            onChange={(e) => setSubInput(e.target.value)}
                          />
                          <Button onClick={() => onAddSub(p)}>Save</Button>
                          <Button variant="outline" onClick={() => { setAddingFor(null); setSubInput(""); }}>Cancel</Button>
                        </div>
                      )}
                      <div className="mt-1 flex flex-wrap gap-2">
                        {subs.map((c) => (
                          <span key={c.id} className="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs">
                            <Tag className="h-3 w-3 text-muted-foreground" />
                            <span>{c.sub}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Rename"
                              onClick={() => setEdit({ id: c.id, primary: c.primary, sub: c.sub })}
                              className="h-6 w-6"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete"
                              onClick={() => deleteCategory(c.id)}
                              className="h-6 w-6"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </span>
                        ))}
                        {!subs.length && (
                          <div className="text-xs text-muted-foreground">No subcategories</div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
            {!filteredPrimaries.length && <div className="text-sm text-muted-foreground">No categories match your search.</div>}
          </div>

          <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rename category</DialogTitle>
              </DialogHeader>
              <div className="mt-2 space-y-2">
                <Input placeholder="Primary" value={edit?.primary || ""} onChange={(e) => setEdit((old) => old ? { ...old, primary: e.target.value } : old)} />
                <Input placeholder="Sub" value={edit?.sub || ""} onChange={(e) => setEdit((old) => old ? { ...old, sub: e.target.value } : old)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
                <Button onClick={renameCategory}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import JSON</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input type="file" accept="application/json" onChange={(e) => e.target.files && e.target.files[0] && onFile(e.target.files[0])} />
            <Button variant="outline" size="icon" title="Upload">
              <Upload className="h-4 w-4" />
            </Button>
          </div>
          {message && <div className="text-sm text-muted-foreground">{message}</div>}
        </CardContent>
      </Card>

      {!!items.length && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Assign Categories ({items.length} items)</CardTitle>
            <Button disabled={busy} onClick={onImport} className="disabled:opacity-50">{busy ? "Importing..." : "Import"}</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {items.slice(0, 20).map((it) => (
                <div key={it.url} className="rounded border p-3 space-y-2">
                  <div className="font-medium">{it.title}</div>
                  <div className="text-xs text-muted-foreground break-all">{it.url}</div>
                  <div className="flex flex-wrap gap-2">
                    {primaries.map((p) => (
                      <div key={p} className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => onAssign(it.url, p, "All")}>{p}</Button>
                        {!!subsFor(p).length && (
                          <select className="h-8 rounded border bg-transparent text-xs" onChange={(e) => onAssign(it.url, p, e.target.value)} defaultValue="">
                            <option value="" disabled>Sub…</option>
                            {subsFor(p).map((s) => (
                              <option key={p+"/"+s} value={s}>{s}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                  {!!(assign[it.url]?.length) && (
                    <div className="text-xs text-muted-foreground">Assigned: {assign[it.url].map((c) => `${c.primary}${c.sub && c.sub !== "All" ? ` / ${c.sub}` : ""}`).join(", ")}</div>
                  )}
                </div>
              ))}
            </div>
            {items.length > 20 && (
              <div className="text-xs text-muted-foreground">Showing first 20 for preview…</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
