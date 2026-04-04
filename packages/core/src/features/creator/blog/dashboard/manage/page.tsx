import Link from "next/link";
import { db } from "@/lib/db";
import { blogPosts, blogPostCategories } from "@/schemas/blog";
import { and, desc, eq, ilike, or, sql, inArray } from "drizzle-orm";
import { getBlogEditorUser } from "@/lib/blog-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { revalidatePath } from "next/cache";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

async function bulkAction(formData: FormData) {
    "use server";
    const user = await getBlogEditorUser();
    if (!user) return;
    const action = String(formData.get("action") || "");
    const ids = formData.getAll("ids") as string[];
    if (!ids.length) return;

    // Collect slugs upfront (needed for revalidation even if rows are deleted)
    const slugRows = await db
        .select({ id: blogPosts.id, slug: blogPosts.slug })
        .from(blogPosts)
        .where(inArray(blogPosts.id, ids));

    if (action === "publish") {
        await db
            .update(blogPosts)
            .set({ published: true, publishedAt: new Date(), updatedAt: new Date() })
            .where(inArray(blogPosts.id, ids));
    } else if (action === "unpublish") {
        await db
            .update(blogPosts)
            .set({ published: false, publishedAt: null, updatedAt: new Date() })
            .where(inArray(blogPosts.id, ids));
    } else if (action === "delete") {
        await db.delete(blogPostCategories).where(inArray(blogPostCategories.postId, ids));
        await db.delete(blogPosts).where(inArray(blogPosts.id, ids));
    }

    // Revalidate dashboards and public surfaces
    revalidatePath("/dashboard/blog/manage");
    revalidatePath("/blog");
    revalidatePath("/blog/public");
    revalidatePath("/blog/rss");
    revalidatePath("/sitemap.xml");
    for (const r of slugRows) {
        if (r.slug) revalidatePath(`/blog/${r.slug}`);
    }
}

export default async function ManageBlog({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; q?: string }>;
}) {
    const user = await getBlogEditorUser();
    if (!user)
        return (
            <div className="p-6 text-sm text-red-500">
                You do not have access.
            </div>
        );

    const params = await searchParams;
    const status = (params?.status || "all") as
        | "all"
        | "published"
        | "drafts";
    const q = (params?.q || "").trim();

    // counts
    const [
        [{ count: total } = { count: 0 }],
        [{ count: published } = { count: 0 }],
        [{ count: drafts } = { count: 0 }],
    ] = (await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(blogPosts),
        db
            .select({ count: sql<number>`count(*)::int` })
            .from(blogPosts)
            .where(eq(blogPosts.published, true)),
        db
            .select({ count: sql<number>`count(*)::int` })
            .from(blogPosts)
            .where(eq(blogPosts.published, false)),
    ])) as any;

    // filters
    const filters = [] as any[];
    if (status === "published") filters.push(eq(blogPosts.published, true));
    if (status === "drafts") filters.push(eq(blogPosts.published, false));
    if (q) {
        const like = `%${q}%`;
        filters.push(
            or(
                ilike(blogPosts.title, like),
                ilike(blogPosts.slug, like),
                ilike(blogPosts.excerpt, like),
            ),
        );
    }

    const where = filters.length ? and(...filters) : undefined;

    const posts = await db
        .select()
        .from(blogPosts)
        .where(where as any)
        .orderBy(desc(blogPosts.createdAt))
        .limit(50);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-bold">Manage Posts</h1>
                    <p className="text-sm text-muted-foreground">
                        Search, filter, and edit your posts.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/blog/new">New Post</Link>
                </Button>
            </div>

            {/* Bulk actions + table */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Posts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="inline-flex h-9 items-center gap-2 rounded-md border bg-muted/50 p-1">
                            <Button
                                asChild
                                size="sm"
                                variant={status === "all" ? "secondary" : "ghost"}
                            >
                                <Link href="/dashboard/blog/manage?status=all">
                                    All ({total})
                                </Link>
                            </Button>
                            <Button
                                asChild
                                size="sm"
                                variant={
                                    status === "published" ? "secondary" : "ghost"
                                }
                            >
                                <Link href="/dashboard/blog/manage?status=published">
                                    Published ({published})
                                </Link>
                            </Button>
                            <Button
                                asChild
                                size="sm"
                                variant={status === "drafts" ? "secondary" : "ghost"}
                            >
                                <Link href="/dashboard/blog/manage?status=drafts">
                                    Drafts ({drafts})
                                </Link>
                            </Button>
                        </div>
                        <form
                            action="/dashboard/blog/manage"
                            className="flex w-full sm:w-auto items-center gap-2"
                        >
                            <Input
                                name="q"
                                defaultValue={q}
                                placeholder="Search title, slug…"
                                className="w-full sm:w-64"
                            />
                            <input type="hidden" name="status" value={status} />
                            <Button type="submit" variant="secondary">
                                Search
                            </Button>
                        </form>
                    </div>

                    <form action={bulkAction} className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm text-muted-foreground">
                                Select rows to apply bulk actions.
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="submit"
                                    name="action"
                                    value="publish"
                                    variant="secondary"
                                >
                                    Publish
                                </Button>
                                <Button
                                    type="submit"
                                    name="action"
                                    value="unpublish"
                                    variant="secondary"
                                >
                                    Unpublish
                                </Button>
                                <Button
                                    type="submit"
                                    name="action"
                                    value="delete"
                                    variant="destructive"
                                >
                                    Delete
                                </Button>
                            </div>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead className="hidden sm:table-cell">Slug</TableHead>
                                    <TableHead className="hidden md:table-cell">Status</TableHead>
                                    <TableHead className="hidden lg:table-cell">Updated</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {posts.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>
                                            <input type="checkbox" name="ids" value={p.id} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{p.title}</div>
                                            <div className="text-xs text-muted-foreground line-clamp-1">{p.excerpt}</div>
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">{p.slug}</TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {p.published ? (
                                                <Badge variant="secondary">Published</Badge>
                                            ) : (
                                                <Badge variant="outline">Draft</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell">
                                            {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "—"}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" aria-label="More">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/dashboard/blog/edit?id=${p.id}`}>Edit</Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/blog/${p.slug}`} target="_blank">View</Link>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {posts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                                            No posts found.
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </Table>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
