import { getBlogEditorUser } from "@/features/creator/blog/server/access";
import Link from "next/link";
import { db } from "@/server/db/client";
import { blogPosts } from "@/schemas/blog";
import { desc, eq, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

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

    const recent = await db
        .select()
        .from(blogPosts)
        .orderBy(desc(blogPosts.createdAt))
        .limit(5);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Blog</h1>
                    <p className="text-sm text-muted-foreground">
                        Create, edit, and publish posts.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/blog/new">New Post</Link>
                </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">
                            Total Posts
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-3xl font-semibold">
                        {total}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">
                            Published
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-3xl font-semibold">
                        {published}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">
                            Drafts
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-3xl font-semibold">
                        {drafts}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Recent Posts</CardTitle>
                    <Button asChild variant="ghost" size="sm">
                        <Link href="/dashboard/blog/manage">View all</Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Slug</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">
                                        Created
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recent.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">
                                            <Link
                                                className="hover:underline"
                                                href={`/dashboard/blog/edit/${p.id}`}
                                            >
                                                {p.title}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            /{p.slug}
                                        </TableCell>
                                        <TableCell>
                                            {p.published ? (
                                                <Badge variant="default">
                                                    Published
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">
                                                    Draft
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {p.createdAt
                                                ? new Date(
                                                      p.createdAt as any,
                                                  ).toLocaleString()
                                                : "—"}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {recent.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="text-center text-sm text-muted-foreground"
                                        >
                                            No posts yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
