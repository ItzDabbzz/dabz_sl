import { db } from "@/lib/db";
import { blogPosts, blogPostCategories, blogCategories, blogPostRatings } from "@/schemas/blog";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import { CategorySidebar } from "@/components/blog/category-sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { user } from "@/schemas/auth-schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart } from "lucide-react";

export const revalidate = 60; // ISR for public list

const PAGE_SIZE = 10;

export default async function BlogIndex({
    searchParams,
}: {
    searchParams: Promise<{ c?: string; p?: string }>;
}) {
    const params = await searchParams;
    const c = params?.c?.split(",").filter(Boolean);
    const page = Math.max(1, Number(params?.p || 1) || 1);

    // Optional category filtering -> list of matching post IDs
    let filteredPostIds: string[] | null = null;
    if (c && c.length) {
        const rows = await db
            .select({ id: blogPosts.id })
            .from(blogPosts)
            .innerJoin(
                blogPostCategories,
                eq(blogPostCategories.postId, blogPosts.id),
            )
            .innerJoin(
                blogCategories,
                eq(blogPostCategories.categoryId, blogCategories.id),
            )
            .where(and(eq(blogPosts.published, true), inArray(blogCategories.slug, c)));
        filteredPostIds = Array.from(new Set(rows.map((r) => r.id)));
    }

    // Total count
    let total = 0;
    if (filteredPostIds) {
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(blogPosts)
            .where(and(eq(blogPosts.published, true), inArray(blogPosts.id, filteredPostIds)));
        total = Number(count) || 0;
    } else {
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(blogPosts)
            .where(eq(blogPosts.published, true));
        total = Number(count) || 0;
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const offset = (page - 1) * PAGE_SIZE;

    // Page of posts + author info
    const rows = await db
        .select({
            id: blogPosts.id,
            title: blogPosts.title,
            slug: blogPosts.slug,
            excerpt: blogPosts.excerpt,
            publishedAt: blogPosts.publishedAt,
            createdAt: blogPosts.createdAt,
            authorName: user.name,
            authorImage: user.image,
        })
        .from(blogPosts)
        .leftJoin(user, eq(user.id, blogPosts.authorUserId))
        .where(
            filteredPostIds
                ? and(eq(blogPosts.published, true), inArray(blogPosts.id, filteredPostIds))
                : eq(blogPosts.published, true),
        )
        .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset);

    const posts = rows;
    const visibleIds = posts.map((p) => p.id);

    // Categories for visible posts
    const catsMap = new Map<string, { name: string; slug: string }[]>();
    if (visibleIds.length) {
        const catRows = await db
            .select({
                postId: blogPostCategories.postId,
                name: blogCategories.name,
                slug: blogCategories.slug,
            })
            .from(blogPostCategories)
            .innerJoin(
                blogCategories,
                eq(blogPostCategories.categoryId, blogCategories.id),
            )
            .where(inArray(blogPostCategories.postId, visibleIds));
        for (const r of catRows) {
            const arr = catsMap.get(r.postId) || [];
            arr.push({ name: r.name, slug: r.slug });
            catsMap.set(r.postId, arr);
        }
    }

    // Ratings preview for visible posts
    const ratingMap = new Map<string, { avg: number; count: number }>();
    if (visibleIds.length) {
        const rRows = await db
            .select({
                postId: blogPostRatings.postId,
                avg: sql<number>`coalesce(avg(${blogPostRatings.score})::float, 0)` ,
                count: sql<number>`count(*)::int`,
            })
            .from(blogPostRatings)
            .where(inArray(blogPostRatings.postId, visibleIds))
            .groupBy(blogPostRatings.postId);
        for (const r of rRows) ratingMap.set(r.postId, { avg: Number(r.avg || 0), count: Number(r.count || 0) });
    }

    // Helper to build hrefs preserving category filters
    const makeHref = (p: number) => {
        const sp = new URLSearchParams();
        if (c && c.length) sp.set("c", c.join(","));
        if (p > 1) sp.set("p", String(p));
        const qs = sp.toString();
        return qs ? `/blog?${qs}` : "/blog";
    };

    const cats = await db
        .select({ id: blogCategories.id, name: blogCategories.name, slug: blogCategories.slug })
        .from(blogCategories)
        .orderBy(blogCategories.name);

    // Build a simple sticky TOC: categories and recent posts
    const recentPosts = posts.slice(0, 10);

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
                <aside className="lg:col-span-3 xl:col-span-3">
                    <div className="sticky top-24 space-y-4">
                        <CategorySidebar categories={cats} />

                        <Card>
                            <CardContent className="p-4">
                                <div className="mb-2 text-sm font-medium text-muted-foreground">Recent posts</div>
                                <ScrollArea className="h-48 pr-2">
                                    <ul className="space-y-2 text-sm">
                                        {recentPosts.map((rp) => (
                                            <li key={rp.id}>
                                                <Link className="line-clamp-2 hover:underline" href={`/blog/${rp.slug}`}>
                                                    {rp.title}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </aside>
                <main className="lg:col-span-9 xl:col-span-9 min-w-0">
                    <header className="mb-8 flex items-end justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
                            <p className="text-sm text-muted-foreground">{total} post{total === 1 ? "" : "s"}</p>
                        </div>
                        <Link href="/" className="hidden lg:inline-flex text-sm text-muted-foreground hover:text-foreground">
                            ← Back Home
                        </Link>
                    </header>

                    <ul className="grid grid-cols-1 gap-4">
                        {posts.map((p) => {
                            const date = p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "Draft";
                            const authorInit = (p.authorName || "?")
                                .split(" ")
                                .map((x) => x[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase();
                            const tags = catsMap.get(p.id) || [];
                            const r = ratingMap.get(p.id) || { avg: 0, count: 0 };
                            const rounded = Math.round(r.avg);
                            return (
                                <li key={p.id}>
                                    <Card className="transition-colors hover:bg-muted/40">
                                        <CardContent className="p-5">
                                            <Link href={`/blog/${p.slug}`} className="block">
                                                <div className="flex items-start justify-between gap-4">
                                                    <h2 className="text-xl font-semibold">{p.title}</h2>
                                                    <time className="shrink-0 text-xs text-muted-foreground">{date}</time>
                                                </div>
                                                {p.excerpt ? (
                                                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>
                                                ) : null}
                                            </Link>

                                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <Avatar>
                                                        <AvatarImage src={p.authorImage || undefined} alt={p.authorName || "Author"} />
                                                        <AvatarFallback>{authorInit}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs text-muted-foreground">{p.authorName || "Unknown"}</span>
                                                </div>

                                                {/* rating preview */}
                                                <div className="flex items-center gap-1">
                                                    {Array.from({ length: 10 }).map((_, i) => (
                                                        <Heart key={i} className={`h-4 w-4 ${i < rounded ? "fill-red-500 stroke-red-500" : "stroke-muted-foreground"}`} />
                                                    ))}
                                                    <span className="ml-1 text-xs text-muted-foreground">{r.avg.toFixed(1)} · {r.count}</span>
                                                </div>

                                                {tags.length ? (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {tags.slice(0, 3).map((t) => (
                                                            <Link key={t.slug} href={makeHref(1) + (c && c.length ? "" : `?c=${encodeURIComponent(t.slug)}`)}>
                                                                <Badge variant="outline">{t.name}</Badge>
                                                            </Link>
                                                        ))}
                                                        {tags.length > 3 ? (
                                                            <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </li>
                            );
                        })}
                    </ul>

                    {/* Pagination */}
                    {totalPages > 1 ? (
                        <nav className="mt-8 flex items-center justify-between" aria-label="pagination">
                            <Link
                                href={makeHref(Math.max(1, page - 1))}
                                aria-disabled={page === 1}
                                className={`text-sm ${page === 1 ? "pointer-events-none opacity-50" : "hover:underline"}`}
                            >
                                ← Previous
                            </Link>
                            <div className="flex items-center gap-2 text-sm">
                                {Array.from({ length: totalPages })
                                    .slice(0, totalPages > 7 ? 7 : totalPages)
                                    .map((_, i) => {
                                        const n = i + 1;
                                        if (totalPages > 7) {
                                            const show =
                                                n === 1 ||
                                                n === totalPages ||
                                                Math.abs(n - page) <= 1 ||
                                                (page <= 4 && n <= 5) ||
                                                (page >= totalPages - 3 && n >= totalPages - 4);
                                            if (!show) return i === 3 ? <span key={`e-${i}`}>…</span> : null;
                                        }
                                        const active = n === page;
                                        return (
                                            <Link
                                                key={n}
                                                href={makeHref(n)}
                                                className={`rounded px-2 py-1 ${active ? "bg-muted" : "hover:underline"}`}
                                                aria-current={active ? "page" : undefined}
                                            >
                                                {n}
                                            </Link>
                                        );
                                    })}
                            </div>
                            <Link
                                href={makeHref(Math.min(totalPages, page + 1))}
                                aria-disabled={page === totalPages}
                                className={`text-sm ${page === totalPages ? "pointer-events-none opacity-50" : "hover:underline"}`}
                            >
                                Next →
                            </Link>
                        </nav>
                    ) : null}
                </main>
            </div>
        </div>
    );
}
