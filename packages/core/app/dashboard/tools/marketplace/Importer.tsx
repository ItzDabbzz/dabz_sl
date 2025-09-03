"use client";

import { useEffect, useMemo, useState } from "react";
import { Tag, Plus, Pencil, Trash2, Search, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [items, setItems] = useState<MpItem[]>([]);
  const [assign, setAssign] = useState<Record<string, { primary: string; sub?: string }[]>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import JSON</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input type="file" accept="application/json" onChange={(e) => e.target.files && e.target.files[0] && onFile(e.target.files[0])} />
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
