import { getBlogEditorUser } from "@/lib/blog-auth";
import Link from "next/link";

export default async function DashboardBlog() {
    const user = await getBlogEditorUser();
    if (!user) {
        return (
            <div className="p-6">
                <p className="text-sm text-red-500">
                    You do not have access to the Blog editor.
                </p>
            </div>
        );
    }
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Blog</h1>
            <div className="flex gap-2">
                <Link
                    className="rounded border px-3 py-2 hover:bg-muted"
                    href="/dashboard/blog/new"
                >
                    New Post
                </Link>
                <Link
                    className="rounded border px-3 py-2 hover:bg-muted"
                    href="/dashboard/blog/manage"
                >
                    Manage
                </Link>
            </div>
        </div>
    );
}
