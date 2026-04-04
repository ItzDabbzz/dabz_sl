"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const MDEditor: any = dynamic(() => import("@uiw/react-md-editor").then((m: any) => m.default ?? m), { ssr: false });

export default function NewBlogPost() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState<string>("# Hello\n\nStart writing…");
  const [saving, setSaving] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const router = useRouter();

  const addCategory = () => {
    const v = categoryInput.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)+/g, "");
    if (!v) return;
    if (!categories.includes(v)) setCategories((c) => [...c, v]);
    setCategoryInput("");
  };
  const removeCategory = (slug: string) => setCategories((c) => c.filter((x) => x !== slug));

  const onSave = async () => {
    setSaving(true);
    const res = await fetch("/api/creator/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug, excerpt, contentMd: content, categories, published: false }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/blog/edit/${data.id}`);
    } else {
      alert("Failed to save");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">New Post</h1>
          <p className="text-sm text-muted-foreground">Draft a new blog post using Markdown.</p>
        </div>
        <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save Draft"}</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" />
            </div>
            <div className="min-h-[420px]" data-color-mode="dark">
              <MDEditor value={content} onChange={setContent} height={420} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="optional-custom-slug" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Input id="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="A short summary (optional)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categories">Categories</Label>
                <div className="flex gap-2">
                  <Input
                    id="categories"
                    className="flex-1"
                    placeholder="Add category slug (press Enter)"
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                  />
                  <Button type="button" variant="secondary" onClick={addCategory}>Add</Button>
                </div>
                {categories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <Badge key={c} variant="secondary" className="gap-2">
                        {c}
                        <button type="button" aria-label={`Remove ${c}`} onClick={() => removeCategory(c)} className="text-muted-foreground hover:text-foreground">✕</button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
