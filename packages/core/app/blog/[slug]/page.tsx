import { db } from "@/lib/db";
import { blogPosts, blogPostCategories, blogCategories } from "@/schemas/blog";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Markdown } from "@/components/markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { user } from "@/schemas/auth-schema";
import { Rating } from "@/components/blog/rating";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TableOfContents, TocItem } from "@/components/blog/toc";
import { ScrollArea } from "@/components/ui/scroll-area";
import SanctumBg from "@/components/sanctum-bg";

export const revalidate = 60; // ISR

function extractToc(md: string): TocItem[] {
    const lines = md.split(/\r?\n/);
    const items: TocItem[] = [];
    const seen = new Map<string, number>();
    for (const line of lines) {
        const m = /^(#{2,4})\s+(.+)$/.exec(line.trim());
        if (!m) continue;
        const level = m[1].length; // 2..4
        const raw = m[2]
            .replace(/[`_*~]/g, "")
            .replace(/\[(.*?)\]\([^)]*\)/g, "$1") // strip markdown links
            .trim();
        const base = raw
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-");
        const n = (seen.get(base) || 0) + 1;
        seen.set(base, n);
        const id = n > 1 ? `${base}-${n}` : base;
        items.push({ id, text: raw, level });
    }
    return items;
}

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const [row] = await db
        .select({
            post: blogPosts,
            authorName: user.name,
            authorImage: user.image,
        })
        .from(blogPosts)
        .leftJoin(user, eq(user.id, blogPosts.authorUserId))
        .where(and(eq(blogPosts.slug, slug), eq(blogPosts.published, true)))
        .limit(1);

    if (!row) return notFound();
    const post = row.post;

    const published = post.publishedAt
        ? new Date(post.publishedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
          })
        : null;

    const categories = await db
        .select({
            id: blogCategories.id,
            name: blogCategories.name,
            slug: blogCategories.slug,
        })
        .from(blogPostCategories)
        .innerJoin(
            blogCategories,
            eq(blogPostCategories.categoryId, blogCategories.id),
        )
        .where(eq(blogPostCategories.postId, post.id));

    const words = post.contentMd?.trim().split(/\s+/).length || 0;
    const readMin = Math.max(1, Math.round(words / 200));

    const initials = (row.authorName || "?")
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const toc = extractToc(post.contentMd || "");

    return (
        <div className="relative min-h-screen">
            {/* Full-viewport background behind content */}
            <div className="fixed inset-0 -z-10">
                <SanctumBg />
            </div>
            <div className="relative mx-auto max-w-8xl px-6 py-10">
                {/* Floating back button */}
                <Button
                    asChild
                    variant="secondary"
                    className="group fixed left-4 top-1/2 hidden -translate-y-1/2 transition-all md:inline-flex"
                >
                    <Link
                        href="/blog"
                        aria-label="Back to all posts"
                        className="flex items-center"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="max-w-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:max-w-[120px] group-hover:opacity-100 group-focus-visible:max-w-[120px] group-focus-visible:opacity-100">
                            All Posts
                        </span>
                    </Link>
                </Button>

                {/* Grid with sticky TOC at right */}
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
                    <main className="lg:col-span-9 xl:col-span-9 min-w-0">
                        {/* Header / hero */}
                        <Card className="mb-6 bg-gradient-to-b from-card to-muted/40">
                            <CardContent className="p-6 md:p-8">
                                <h1 className="font-secondary text-balance text-6xl font-bold leading-tight tracking-tight md:text-5xl sm:text-lg">
                                    {post.title}
                                </h1>
                                {post.excerpt ? (
                                    <p className="mt-3 text-balance text-base text-muted-foreground md:text-lg">
                                        {post.excerpt}
                                    </p>
                                ) : null}

                                <div className="mt-5 flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage
                                                src={
                                                    row.authorImage || undefined
                                                }
                                                alt={row.authorName || "Author"}
                                            />
                                            <AvatarFallback>
                                                {initials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="text-sm text-muted-foreground">
                                            <div className="font-medium text-foreground">
                                                {row.authorName ||
                                                    "Unknown Author"}
                                            </div>
                                            <div>
                                                {published
                                                    ? published
                                                    : "Unpublished"}{" "}
                                                • {readMin} min read
                                            </div>
                                        </div>
                                    </div>

                                    {categories.length ? (
                                        <>
                                            <span
                                                aria-hidden
                                                className="mx-1 h-6 w-px bg-border"
                                            />
                                            <div className="flex flex-wrap items-center gap-2">
                                                {categories.map((c) => (
                                                    <Link
                                                        key={c.id}
                                                        href={`/blog?c=${encodeURIComponent(c.slug)}`}
                                                    >
                                                        <Badge variant="secondary">
                                                            {c.name}
                                                        </Badge>
                                                    </Link>
                                                ))}
                                            </div>
                                        </>
                                    ) : null}
                                </div>

                                {/* Inline rating card */}
                                <div className="mt-6">
                                    <Card>
                                        <CardContent className="flex items-center justify-between gap-4 p-4">
                                            <div className="text-sm font-medium">
                                                Rate this post
                                            </div>
                                            <Rating postId={post.id} />
                                        </CardContent>
                                    </Card>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Content */}
                        <Card>
                            <CardContent className="p-6 md:p-8">
                                <Suspense
                                    fallback={
                                        <div className="text-sm text-muted-foreground">
                                            Rendering…
                                        </div>
                                    }
                                >
                                    <article className="prose prose-neutral max-w-none dark:prose-invert">
                                        <Markdown value={post.contentMd} />
                                    </article>
                                </Suspense>
                            </CardContent>
                        </Card>
                    </main>
                    <aside className="hidden lg:block lg:col-span-3 xl:col-span-3">
                        <div className="sticky top-24">
                            <Card className="max-h-[calc(100vh-6rem)] overflow-hidden">
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[calc(100vh-6rem)]">
                                        <div className="p-4">
                                            <TableOfContents items={toc} />
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
