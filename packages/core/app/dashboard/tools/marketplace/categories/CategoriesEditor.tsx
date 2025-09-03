"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderOpen, FolderClosed, Tag, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Category = { id: string; primary: string; sub: string };

/*

  TODO: Category TODO
  - Rename category (primary + sub)
  - More intuitive ui for editing sub categories
  - Delete category (with confirmation)
  - Collapse all / Expand all quick buttons along with sorting options
  - Add indepth JSDoc and comments explaining things

*/

export default function CategoriesEditor() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [primary, setPrimary] = useState("");
  const [sub, setSub] = useState("All");
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
    const onChanged = () => loadCategories();
    window.addEventListener("mp:categoriesChanged" as any, onChanged);
    return () => window.removeEventListener("mp:categoriesChanged" as any, onChanged);
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
      window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
    }
  };

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
    window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
  };

  const deleteCategory = async (id: string) => {
    await fetch(`/api/tools/marketplace/categories/${id}`, { method: "DELETE", credentials: "include" });
    loadCategories();
    window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
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
    window.dispatchEvent(new CustomEvent("mp:categoriesChanged"));
  };

  return (
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
  );
}
