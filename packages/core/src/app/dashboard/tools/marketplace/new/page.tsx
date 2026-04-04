"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = { id: string; primary: string; sub: string };

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [version, setVersion] = useState("");
  const [url, setUrl] = useState("");
  const [store, setStore] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [creatorLink, setCreatorLink] = useState("");
  const [description, setDescription] = useState("");
  const [imagesText, setImagesText] = useState("");
  const [featuresText, setFeaturesText] = useState("");
  const [contentsText, setContentsText] = useState("");
  const [permCopy, setPermCopy] = useState("");
  const [permModify, setPermModify] = useState("");
  const [permTransfer, setPermTransfer] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/tools/marketplace/items/categories", { credentials: "include" });
        if (r.ok) {
          const d = await r.json();
          setCategories(d.items || []);
        }
      } catch {}
    })();
  }, []);

  const catById = useMemo(() => {
    const m: Record<string, Category> = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  const labelFor = (id: string) => {
    const c = catById[id];
    return c ? `${c.primary} › ${c.sub}` : id;
  };

  const onToggleCat = (id: string) => {
    setSelectedCats((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  };

  const onCreate = async () => {
    if (!title.trim() || !url.trim()) return;
    setLoading(true);
    const images = imagesText.split(/\r?\n|, /).map((s) => s.trim()).filter(Boolean);
    const features = featuresText.split(/\r?\n|, /).map((s) => s.trim()).filter(Boolean);
    const contents = contentsText.split(/\r?\n|, /).map((s) => s.trim()).filter(Boolean);
    const creator = (creatorName || creatorLink) ? { name: creatorName || "", link: creatorLink || "" } : null;
    const permissions = (permCopy || permModify || permTransfer) ? { copy: permCopy || null, modify: permModify || null, transfer: permTransfer || null } : null;

    const assignEntry = selectedCats.length
      ? [{ url, categories: selectedCats.map((cid) => ({ primary: catById[cid]?.primary || "Misc", sub: catById[cid]?.sub || "All" })) }]
      : [];

    const body = {
      items: [{ url, title, version: version || null, images, price: price || null, creator, store: store || null, permissions, description, features, contents, updatedOn: null }],
      assign: assignEntry,
    };

    try {
      const res = await fetch("/api/tools/marketplace/items", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      if (res.ok) {
        window.location.href = "/dashboard/tools/marketplace/explorer";
      }
    } finally {
      setLoading(false);
    }
  };

  const canCreate = !loading && !!title.trim() && !!url.trim();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>New Marketplace Item</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div>
            <div className="text-xs mb-1">Title</div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-1">Price</div>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <div className="text-xs mb-1">Version</div>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-1">URL</div>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div>
              <div className="text-xs mb-1">Store</div>
              <Input value={store} onChange={(e) => setStore(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-1">Creator Name</div>
              <Input value={creatorName} onChange={(e) => setCreatorName(e.target.value)} />
            </div>
            <div>
              <div className="text-xs mb-1">Creator Link</div>
              <Input value={creatorLink} onChange={(e) => setCreatorLink(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="text-xs mb-1">Description</div>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs mb-1">Perm: Copy</div>
              <Input value={permCopy} onChange={(e) => setPermCopy(e.target.value)} />
            </div>
            <div>
              <div className="text-xs mb-1">Perm: Modify</div>
              <Input value={permModify} onChange={(e) => setPermModify(e.target.value)} />
            </div>
            <div>
              <div className="text-xs mb-1">Perm: Transfer</div>
              <Input value={permTransfer} onChange={(e) => setPermTransfer(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="text-xs mb-1">Images (one per line)</div>
            <Textarea value={imagesText} onChange={(e) => setImagesText(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-1">Features (one per line)</div>
              <Textarea value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} />
            </div>
            <div>
              <div className="text-xs mb-1">Contents (one per line)</div>
              <Textarea value={contentsText} onChange={(e) => setContentsText(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs mb-1">Categories</div>
            <div className="flex flex-wrap gap-1 min-h-[1.25rem]">
              {selectedCats.length ? selectedCats.map((id) => (
                <Badge key={id} variant="secondary">{labelFor(id)}</Badge>
              )) : <span className="text-xs text-muted-foreground">None</span>}
            </div>
            <Popover open={catsOpen} onOpenChange={setCatsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2">Manage</Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0">
                <Command>
                  <CommandInput placeholder="Search categories…" />
                  <CommandList>
                    <CommandEmpty>No results.</CommandEmpty>
                    <CommandGroup heading="Categories">
                      {categories.map((c) => (
                        <CommandItem key={c.id} value={`${c.primary} ${c.sub}`} onSelect={() => onToggleCat(c.id)}>
                          <Check className={cn("mr-2 h-4 w-4", selectedCats.includes(c.id) ? "opacity-100" : "opacity-0")} />
                          {c.primary} › {c.sub}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <Button onClick={onCreate} disabled={!canCreate}>{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create"}</Button>
            <Button variant="outline" onClick={() => history.back()} disabled={loading}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
