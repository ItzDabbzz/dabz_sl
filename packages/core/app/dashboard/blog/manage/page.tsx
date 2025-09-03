import Link from "next/link";
import { db } from "@/lib/db";
import { blogPosts } from "@/schemas/blog";
import { desc } from "drizzle-orm";
import { getBlogEditorUser } from "@/lib/blog-auth";

export default async function ManageBlog() {
    const user = await getBlogEditorUser();
    if (!user)
        return (
            <div className="p-6 text-sm text-red-500">
                You do not have access.
            </div>
        );

    const posts = await db
        .select()
        .from(blogPosts)
        .orderBy(desc(blogPosts.createdAt));

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Manage Posts</h1>
            <ul className="space-y-2">
                {posts.map((p) => (
                    <li
                        key={p.id}
                        className="rounded border p-3 flex items-center justify-between"
                    >
                        <div>
                            <div className="font-medium">{p.title}</div>
                            <div className="text-xs text-muted-foreground">
                                /{p.slug} ·{" "}
                                {p.published ? "Published" : "Draft"}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Link
                                className="rounded border px-2 py-1 text-xs hover:bg-muted"
                                href={`/blog/${p.slug}`}
                            >
                                View
                            </Link>
                            <Link
                                className="rounded border px-2 py-1 text-xs hover:bg-muted"
                                href={`/dashboard/blog/edit/${p.id}`}
                            >
                                Edit
                            </Link>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
