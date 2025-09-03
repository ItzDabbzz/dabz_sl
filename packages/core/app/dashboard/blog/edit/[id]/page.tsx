"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
const MdEditor: any = dynamic(() => import("next-md-editor").then((m: any) => m.default ?? m.MdEditor ?? m), { ssr: false });

export default function EditBlogPost() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [content, setContent] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
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
      body: JSON.stringify({ id, title: data.title, slug: data.slug, excerpt: data.excerpt, contentMd: content, categories, published: publish ?? data.published }),
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
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <input className="w-full rounded border px-3 py-2 bg-background" defaultValue={data.title} onBlur={(e) => setData({ ...data, title: e.target.value })} />
        <input className="w-full rounded border px-3 py-2 bg-background" defaultValue={data.slug} onBlur={(e) => setData({ ...data, slug: e.target.value })} />
        <input className="w-full rounded border px-3 py-2 bg-background" defaultValue={data.excerpt} onBlur={(e) => setData({ ...data, excerpt: e.target.value })} />
        <div>
          <label className="block text-sm mb-1">Categories</label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-3 py-2 bg-background"
              placeholder="Add category slug (enter to add)"
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
            />
            <button onClick={addCategory} className="rounded border px-3 py-2 hover:bg-muted">Add</button>
          </div>
          {categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((c) => (
                <span key={c} className="inline-flex items-center gap-2 rounded border px-2 py-0.5 text-xs">
                  {c}
                  <button onClick={() => removeCategory(c)} className="text-muted-foreground hover:text-foreground">✕</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="min-h-[400px]">
        <MdEditor value={content} onChange={setContent} />
      </div>
      <div className="flex gap-2">
        <button onClick={() => save(false)} className="rounded border px-3 py-2 hover:bg-muted">Save</button>
        <button onClick={() => save(true)} className="rounded border px-3 py-2 hover:bg-muted">Publish</button>
        <button onClick={del} className="rounded border px-3 py-2 hover:bg-destructive/20 text-destructive border-destructive">Delete</button>
      </div>
    </div>
  );
}
