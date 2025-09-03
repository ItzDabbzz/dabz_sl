"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
// Use dynamic import for the editor (client-only)
const MdEditor: any = dynamic(
    () => import("next-md-editor").then((m: any) => m.default ?? m.MdEditor ?? m),
    { ssr: false },
);

export default function NewBlogPost() {
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [excerpt, setExcerpt] = useState("");
    const [content, setContent] = useState("# Hello\n\nStart writing…");
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
            body: JSON.stringify({
                title,
                slug,
                excerpt,
                contentMd: content,
                categories,
                published: false,
            }),
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
        <div className="p-4 space-y-4">
            <div className="space-y-2">
                <input
                    className="w-full rounded border px-3 py-2 bg-background"
                    placeholder="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                <input
                    className="w-full rounded border px-3 py-2 bg-background"
                    placeholder="Slug (optional)"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                />
                <input
                    className="w-full rounded border px-3 py-2 bg-background"
                    placeholder="Excerpt (optional)"
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                />
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
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="rounded border px-3 py-2 hover:bg-muted disabled:opacity-50"
                >
                    Save Draft
                </button>
            </div>
        </div>
    );
}
