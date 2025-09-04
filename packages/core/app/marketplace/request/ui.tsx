"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Minimal local types (align with Explorer)
 type Category = { id: string; primary: string; sub: string };

export default function PublicRequestForm() {
  const [loading, setLoading] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  // Required fields
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [store, setStore] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [creatorLink, setCreatorLink] = useState("");
  const [description, setDescription] = useState("");
  const [imagesText, setImagesText] = useState("");

  // Optional fields
  const [version, setVersion] = useState("");
  const [featuresText, setFeaturesText] = useState("");
  const [contentsText, setContentsText] = useState("");
  const [permCopy, setPermCopy] = useState("");
  const [permModify, setPermModify] = useState("");
  const [permTransfer, setPermTransfer] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/public/marketplace/categories");
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

  const requiredOk = {
    title: !!title.trim(),
    url: !!url.trim(),
    store: !!store.trim(),
    price: !!price.trim(),
    description: !!description.trim(),
    images: imagesText.split(/\r?\n|,\s*/).map((s) => s.trim()).filter(Boolean).length > 0,
    creatorName: !!creatorName.trim(),
    creatorLink: !!creatorLink.trim(),
    permCopy: !!permCopy.trim(),
    permModify: !!permModify.trim(),
    permTransfer: !!permTransfer.trim(),
    categories: selectedCats.length > 0,
  };

  const formValid = Object.values(requiredOk).every(Boolean) && !loading;

  async function onSubmit() {
    if (!formValid) return;
    setLoading(true);

    const images = imagesText.split(/\r?\n|,\s*/).map((s) => s.trim()).filter(Boolean);
    const features = featuresText.split(/\r?\n|,\s*/).map((s) => s.trim()).filter(Boolean);
    const contents = contentsText.split(/\r?\n|,\s*/).map((s) => s.trim()).filter(Boolean);

    const permissions = { copy: permCopy.trim(), modify: permModify.trim(), transfer: permTransfer.trim() };
    const creator = { name: creatorName.trim(), link: creatorLink.trim() };

    const body = {
      title,
      url,
      store,
      price,
      description,
      images,
      version: version || null,
      features,
      contents,
      permissions,
      creator,
      email: email || undefined,
      categoryIds: selectedCats,
    };

    try {
      const res = await fetch("/api/public/marketplace/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        alert("Thanks! Your request was submitted and is awaiting review.");
        window.location.href = "/marketplace";
      }
    } finally {
      setLoading(false);
    }
  }

  const Help = ({ children }: { children: any }) => (
    <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1"><Info className="h-3 w-3 mt-[2px]" /> {children}</p>
  );

  const Req = ({ ok }: { ok: boolean }) => (
    <span className={cn("ml-1 text-[10px]", ok ? "text-green-600" : "text-red-600")}>{ok ? "✓" : "*"}</span>
  );

  return (
    <Card>
      <CardContent className="grid gap-3 p-4">
        <div>
          <div className="text-xs mb-1">Title <Req ok={requiredOk.title} /></div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product name as seen on the marketplace" />
          <Help>Use the exact product name so we can find it quickly.</Help>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs mb-1">Price (L$) <Req ok={requiredOk.price} /></div>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 599" />
            <Help>Type the price shown on the listing. If it varies, put the base price.</Help>
          </div>
          <div>
            <div className="text-xs mb-1">Version (optional)</div>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. 1.2.3" />
            <Help>If the listing shows a version, add it. Otherwise leave blank.</Help>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs mb-1">Listing URL <Req ok={requiredOk.url} /></div>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://marketplace.secondlife.com/..." />
            <Help>Copy the full product URL from the marketplace or store website.</Help>
          </div>
          <div>
            <div className="text-xs mb-1">Store Name <Req ok={requiredOk.store} /></div>
            <Input value={store} onChange={(e) => setStore(e.target.value)} placeholder="e.g. Session Skins" />
            <Help>The creator brand or shop this product belongs to.</Help>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs mb-1">Creator Name <Req ok={requiredOk.creatorName} /></div>
            <Input value={creatorName} onChange={(e) => setCreatorName(e.target.value)} placeholder="e.g. Jane Doe" />
          </div>
          <div>
            <div className="text-xs mb-1">Creator Profile/Store Link <Req ok={requiredOk.creatorLink} /></div>
            <Input value={creatorLink} onChange={(e) => setCreatorLink(e.target.value)} placeholder="e.g. https://marketplace.secondlife.com/stores/12345" />
          </div>
        </div>

        <div>
          <div className="text-xs mb-1">Short Description <Req ok={requiredOk.description} /></div>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is it? Any important notes we should know." />
          <Help>1-3 sentences is fine. We just need the basics.</Help>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs mb-1">Perm: Copy <Req ok={requiredOk.permCopy} /></div>
            <Input value={permCopy} onChange={(e) => setPermCopy(e.target.value)} placeholder="Yes/No/Unknown" />
          </div>
          <div>
            <div className="text-xs mb-1">Perm: Modify <Req ok={requiredOk.permModify} /></div>
            <Input value={permModify} onChange={(e) => setPermModify(e.target.value)} placeholder="Yes/No/Unknown" />
          </div>
          <div>
            <div className="text-xs mb-1">Perm: Transfer <Req ok={requiredOk.permTransfer} /></div>
            <Input value={permTransfer} onChange={(e) => setPermTransfer(e.target.value)} placeholder="Yes/No/Unknown" />
          </div>
        </div>

        <div>
          <div className="text-xs mb-1">Image URLs (one per line) <Req ok={requiredOk.images} /></div>
          <Textarea value={imagesText} onChange={(e) => setImagesText(e.target.value)} placeholder="https://.../image1.jpg\nhttps://.../image2.png" />
          <Help>Paste at least one image URL from the listing. More is helpful.</Help>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs mb-1">Features (optional, one per line)</div>
            <Textarea value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} placeholder="Feature 1\nFeature 2" />
          </div>
          <div>
            <div className="text-xs mb-1">Contents (optional, one per line)</div>
            <Textarea value={contentsText} onChange={(e) => setContentsText(e.target.value)} placeholder="Item 1\nItem 2" />
          </div>
        </div>

        {/* Category picker (multi) */}
        <div className="space-y-1">
          <div className="text-xs mb-1">Categories <Req ok={requiredOk.categories} /></div>
          <div className="flex flex-wrap gap-1 min-h-[1.25rem]">
            {selectedCats.length ? (
              selectedCats.map((id) => (
                <Badge key={id} variant="secondary">{labelFor(id)}</Badge>
              ))
            ) : (
              <span className="text-xs text-destructive">Select at least one category.</span>
            )}
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
          <Help>Pick one or more categories that fit. This is required.</Help>
        </div>

        <div>
          <div className="text-xs mb-1">Contact email (optional)</div>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="We may contact you if we need clarification" />
        </div>

        <div className="pt-2 flex items-center gap-2">
          <Button onClick={onSubmit} disabled={!formValid}>
            {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>) : ("Submit request")}
          </Button>
          <Button variant="outline" onClick={() => history.back()} disabled={loading}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
