"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const MDEditor: any = dynamic(() => import("@uiw/react-md-editor").then((m: any) => m.default ?? m), { ssr: false });

export default function EditBlogPost() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [content, setContent] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [announce, setAnnounce] = useState<"none" | "send">("none");
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/creator/blog?id=${id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setContent(json.contentMd || "");
        setCategories(Array.isArray(json.categories) ? json.categories : []);
      }
      setLoading(false);
    })();
  }, [id]);

  const addCategory = () => {
    const v = categoryInput.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)+/g, "");
    if (!v) return;
    if (!categories.includes(v)) setCategories((c) => [...c, v]);
    setCategoryInput("");
  };
  const removeCategory = (slug: string) => setCategories((c) => c.filter((x) => x !== slug));

  const save = async (publish?: boolean) => {
    const res = await fetch("/api/creator/blog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title: data.title, slug: data.slug, excerpt: data.excerpt, contentMd: content, categories, published: publish ?? data.published, sendAnnouncement: publish ? announce === "send" : false }),
    });
    if (!res.ok) alert("Failed to save");
    else if (publish) router.push(`/blog/${data.slug}`);
  };

  const del = async () => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    const res = await fetch(`/api/creator/blog?id=${id}`, { method: "DELETE" });
    if (!res.ok) alert("Failed to delete");
    else router.push("/dashboard/blog/manage");
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-6 text-sm text-red-500">Not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Edit Post</h1>
          <p className="text-sm text-muted-foreground">{data.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <Label className="text-xs text-muted-foreground">Announcement on publish</Label>
            <Select value={announce} onValueChange={(v: any) => setAnnounce(v)}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Do not send" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Do not send</SelectItem>
                <SelectItem value="send">Send once on first publish</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => save(false)} variant="secondary">Save</Button>
          <Button onClick={() => save(true)}>Publish</Button>
          <Button onClick={del} variant="destructive">Delete</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" defaultValue={data.title} onBlur={(e) => setData({ ...data, title: e.target.value })} />
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
                <Input id="slug" defaultValue={data.slug} onBlur={(e) => setData({ ...data, slug: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Input id="excerpt" defaultValue={data.excerpt} onBlur={(e) => setData({ ...data, excerpt: e.target.value })} />
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
