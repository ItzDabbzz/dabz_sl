import { db } from "@/lib/db";
import {
    blogPosts,
    blogPostCategories,
    blogCategories,
    blogPostRatings,
} from "@/schemas/blog";
import { and, desc, eq, inArray, sql, or, ilike } from "drizzle-orm";
import Link from "next/link";
import { CategorySidebar } from "@/components/blog/category-sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { user } from "@/schemas/auth-schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart } from "lucide-react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canViewCategory } from "@/lib/permissions";
import WebBg from "@/components/web-bg";

export const revalidate = 60; // ISR for public list
export const dynamic = "force-dynamic"; // personalized by session

const PAGE_SIZE = 10;

export const metadata = {
    title: "Blog | sanctumrp.net",
    description: "Latest posts, guides, and updates.",
};

export default async function BlogIndex({
    searchParams,
}: {
    searchParams: Promise<{
        c?: string;
        p?: string;
        q?: string;
        sort?: "latest" | "top";
    }>;
}) {
    const params = await (searchParams as any);
    const c = params?.c?.split(",").filter(Boolean);
    const page = Math.max(1, Number(params?.p || 1) || 1);
    const q = (params?.q || "").trim();
    const sort = (params?.sort as "latest" | "top" | undefined) || "latest";

    // Current viewer (for permissions)
    const ses = await auth.api
        .getSession({ headers: await headers() })
        .catch(() => null as any);
    const viewer = {
        isLoggedIn: !!ses?.user,
        role: (ses as any)?.user?.role || null,
        orgId: (ses as any)?.session?.activeOrganizationId || null,
        teamIds: (ses as any)?.session?.activeTeamId
            ? [(ses as any)?.session?.activeTeamId]
            : [],
        userId: (ses as any)?.user?.id || null,
        email: (ses as any)?.user?.email || null,
    };

    // Fetch all categories and filter by visibility for this viewer
    const allCats = await db
        .select({
            id: blogCategories.id,
            name: blogCategories.name,
            slug: blogCategories.slug,
            visibility: (blogCategories as any).visibility,
        })
        .from(blogCategories)
        .orderBy(blogCategories.name);
    const visibleCats = allCats.filter((cat: any) =>
        canViewCategory(cat.visibility as any, viewer),
    );

    // Determine which visible categories to include (selected or all visible)
    let visibleCategoryIds: string[] = [];
    if (c && c.length) {
        const allowedSlugs = new Set(visibleCats.map((x) => x.slug));
        const effective = c.filter((slug: string) => allowedSlugs.has(slug));
        if (effective.length) {
            visibleCategoryIds = visibleCats
                .filter((x) => effective.includes(x.slug))
                .map((x) => x.id);
        } else {
            visibleCategoryIds = []; // no allowed categories selected => no posts
        }
    } else {
        visibleCategoryIds = visibleCats.map((x) => x.id);
    }

    // If no visible categories for this viewer, short-circuit
    if (visibleCategoryIds.length === 0) {
        const cats = visibleCats.map((x) => ({
            id: x.id,
            name: x.name,
            slug: x.slug,
        }));
        return (
            <div className="mx-auto max-w-6xl px-6 py-10">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
                    <aside className="lg:col-span-3 xl:col-span-3">
                        <div className="sticky top-24 space-y-4">
                            <CategorySidebar categories={cats} />
                        </div>
                    </aside>
                    <main className="lg:col-span-9 xl:col-span-9 min-w-0">
                        <header className="mb-8">
                            <h1 className="font-enchanted text-5xl font-bold tracking-tight">
                                Blog
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                0 posts
                            </p>
                        </header>
                        <div className="rounded border p-6 text-sm text-muted-foreground">
                            No accessible posts for your account.
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    // Build optional search condition (title/excerpt)
    const searchCond = q
        ? or(
              ilike(blogPosts.title, `%${q}%`),
              ilike(blogPosts.excerpt, `%${q}%`),
          )
        : undefined;

    // Total count (distinct posts that belong to at least one visible category)
    const [{ count }] = await db
        .select({ count: sql<number>`count(distinct ${blogPosts.id})::int` })
        .from(blogPosts)
        .innerJoin(
            blogPostCategories,
            eq(blogPostCategories.postId, blogPosts.id),
        )
        .where(
            and(
                eq(blogPosts.published, true),
                inArray(blogPostCategories.categoryId, visibleCategoryIds),
                searchCond ? searchCond : sql`true`,
            ),
        );
    const total = Number(count) || 0;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const offset = (page - 1) * PAGE_SIZE;

    // Page IDs (distinct) honoring visibility + search + sort
    let idRows: { id: string }[] = [];
    if (sort === "top") {
        idRows = await db
            .select({
                id: blogPosts.id,
                avgScore: sql<number>`coalesce(avg(${blogPostRatings.score})::float, 0)`,
                cnt: sql<number>`count(${blogPostRatings.id})::int`,
            })
            .from(blogPosts)
            .innerJoin(
                blogPostCategories,
                eq(blogPostCategories.postId, blogPosts.id),
            )
            .leftJoin(blogPostRatings, eq(blogPostRatings.postId, blogPosts.id))
            .where(
                and(
                    eq(blogPosts.published, true),
                    inArray(blogPostCategories.categoryId, visibleCategoryIds),
                    searchCond ? searchCond : sql`true`,
                ),
            )
            .groupBy(blogPosts.id)
            .orderBy(
                desc(sql`coalesce(avg(${blogPostRatings.score})::float, 0)`),
                desc(sql`count(${blogPostRatings.id})::int`),
                desc(blogPosts.publishedAt),
                desc(blogPosts.createdAt),
            )
            .limit(PAGE_SIZE)
            .offset(offset);
    } else {
        idRows = await db
            .select({ id: blogPosts.id })
            .from(blogPosts)
            .innerJoin(
                blogPostCategories,
                eq(blogPostCategories.postId, blogPosts.id),
            )
            .where(
                and(
                    eq(blogPosts.published, true),
                    inArray(blogPostCategories.categoryId, visibleCategoryIds),
                    searchCond ? searchCond : sql`true`,
                ),
            )
            .groupBy(blogPosts.id)
            .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt))
            .limit(PAGE_SIZE)
            .offset(offset);
    }

    const pageIds = idRows.map((r) => r.id);

    // Page of posts + author info (preserve original ordering of pageIds)
    const rows = pageIds.length
        ? await db
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
              .where(inArray(blogPosts.id, pageIds))
        : ([] as any[]);

    const orderIndex = new Map(pageIds.map((id, i) => [id, i] as const));
    rows.sort((a, b) => orderIndex.get(a.id)! - orderIndex.get(b.id)!);

    const posts = rows as typeof rows;
    const visibleIds = posts.map((p) => p.id);

    // Categories per visible post (filter by viewer visibility)
    const catsMap = new Map<string, { name: string; slug: string }[]>();
    if (visibleIds.length) {
        const catRows = await db
            .select({
                postId: blogPostCategories.postId,
                name: blogCategories.name,
                slug: blogCategories.slug,
                visibility: (blogCategories as any).visibility,
            })
            .from(blogPostCategories)
            .innerJoin(
                blogCategories,
                eq(blogPostCategories.categoryId, blogCategories.id),
            )
            .where(inArray(blogPostCategories.postId, visibleIds));
        for (const r of catRows) {
            if (!canViewCategory((r as any).visibility as any, viewer))
                continue;
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
                avg: sql<number>`coalesce(avg(${blogPostRatings.score})::float, 0)`,
                count: sql<number>`count(*)::int`,
            })
            .from(blogPostRatings)
            .where(inArray(blogPostRatings.postId, visibleIds))
            .groupBy(blogPostRatings.postId);
        for (const r of rRows)
            ratingMap.set(r.postId, {
                avg: Number(r.avg || 0),
                count: Number(r.count || 0),
            });
    }

    // Helper to build hrefs preserving filters
    const makeHref = (p: number) => {
        const sp = new URLSearchParams();
        if (c && c.length) sp.set("c", c.join(","));
        if (q) sp.set("q", q);
        if (sort && sort !== "latest") sp.set("sort", sort);
        if (p > 1) sp.set("p", String(p));
        const qs = sp.toString();
        return qs ? `/blog?${qs}` : "/blog";
    };

    // Sidebar categories (visible only)
    const cats = visibleCats.map((x) => ({
        id: x.id,
        name: x.name,
        slug: x.slug,
    }));

    // Recent posts sidebar uses current page slice
    const recentPosts = posts.slice(0, 10);

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <WebBg />
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
                <aside className="lg:col-span-3 xl:col-span-3">
                    <div className="sticky top-24 space-y-4">
                        <CategorySidebar categories={cats} />

                        <Card>
                            <CardContent className="p-4">
                                <div className="mb-2 text-sm font-medium text-muted-foreground">
                                    Recent posts
                                </div>
                                <ScrollArea className="h-48 pr-2">
                                    <ul className="space-y-2 text-sm">
                                        {recentPosts.map((rp) => (
                                            <li key={rp.id}>
                                                <Link
                                                    className="line-clamp-2 hover:underline"
                                                    href={`/blog/${rp.slug}`}
                                                >
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
                    <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">
                                Blog
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {total} post{total === 1 ? "" : "s"}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Search */}
                            <form
                                action="/blog"
                                className="flex items-center gap-2"
                            >
                                <input
                                    type="text"
                                    name="q"
                                    defaultValue={q}
                                    placeholder="Search posts..."
                                    className="h-9 w-48 rounded border bg-background px-3 text-sm"
                                />
                                {c && c.length ? (
                                    <input
                                        type="hidden"
                                        name="c"
                                        value={c.join(",")}
                                    />
                                ) : null}
                                {sort && sort !== "latest" ? (
                                    <input
                                        type="hidden"
                                        name="sort"
                                        value={sort}
                                    />
                                ) : null}
                                <button className="h-9 rounded bg-primary px-3 text-sm text-primary-foreground">
                                    Search
                                </button>
                            </form>
                            {/* Sort */}
                            <form action="/blog">
                                <select
                                    name="sort"
                                    defaultValue={sort}
                                    className="h-9 rounded border bg-background px-2 text-sm"
                                >
                                    <option value="latest">Latest</option>
                                    <option value="top">
                                        Top rated (soon)
                                    </option>
                                </select>
                                {c && c.length ? (
                                    <input
                                        type="hidden"
                                        name="c"
                                        value={c.join(",")}
                                    />
                                ) : null}
                                {q ? (
                                    <input type="hidden" name="q" value={q} />
                                ) : null}
                                <button
                                    type="submit"
                                    className="h-9 rounded border bg-background px-3 text-sm"
                                >
                                    Apply
                                </button>
                            </form>
                            {/* Clear filters */}
                            {q ||
                            (c && c.length) ||
                            (sort && sort !== "latest") ? (
                                <Link
                                    href="/blog"
                                    className="text-sm text-muted-foreground hover:underline"
                                >
                                    Clear filters
                                </Link>
                            ) : null}
                            <Link
                                href="/blog/rss"
                                className="text-sm text-muted-foreground hover:underline"
                            >
                                RSS
                            </Link>
                            <Link
                                href="/"
                                className="hidden lg:inline-flex text-sm text-muted-foreground hover:text-foreground"
                            >
                                ← Back Home
                            </Link>
                        </div>
                    </header>

                    {posts.length === 0 ? (
                        <div className="rounded border p-6 text-sm text-muted-foreground">
                            No posts found. Try clearing filters.
                        </div>
                    ) : (
                        <ul className="grid grid-cols-1 gap-4">
                            {posts.map((p) => {
                                const date = p.publishedAt
                                    ? new Date(
                                          p.publishedAt,
                                      ).toLocaleDateString()
                                    : "Draft";
                                const authorInit = (p.authorName || "?")
                                    .split(" ")
                                    .map((x: any[]) => x[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase();
                                const tags = catsMap.get(p.id) || [];
                                const r = ratingMap.get(p.id) || {
                                    avg: 0,
                                    count: 0,
                                };
                                const rounded = Math.round(r.avg);
                                return (
                                    <li key={p.id}>
                                        <Card className="transition-colors hover:bg-muted/40">
                                            <CardContent className="p-5">
                                                <Link
                                                    href={`/blog/${p.slug}`}
                                                    className="block"
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        <h2 className="text-xl font-semibold">
                                                            {p.title}
                                                        </h2>
                                                        <time className="shrink-0 text-xs text-muted-foreground">
                                                            {date}
                                                        </time>
                                                    </div>
                                                    {p.excerpt ? (
                                                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                                            {p.excerpt}
                                                        </p>
                                                    ) : null}
                                                </Link>

                                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <Avatar>
                                                            <AvatarImage
                                                                src={
                                                                    p.authorImage ||
                                                                    undefined
                                                                }
                                                                alt={
                                                                    p.authorName ||
                                                                    "Author"
                                                                }
                                                            />
                                                            <AvatarFallback>
                                                                {authorInit}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-xs text-muted-foreground">
                                                            {p.authorName ||
                                                                "Unknown"}
                                                        </span>
                                                    </div>

                                                    {/* rating preview */}
                                                    <div className="flex items-center gap-1">
                                                        {Array.from({
                                                            length: 10,
                                                        }).map((_, i) => (
                                                            <Heart
                                                                key={i}
                                                                className={`h-4 w-4 ${i < rounded ? "fill-red-500 stroke-red-500" : "stroke-muted-foreground"}`}
                                                            />
                                                        ))}
                                                        <span className="ml-1 text-xs text-muted-foreground">
                                                            {r.avg.toFixed(1)} ·{" "}
                                                            {r.count}
                                                        </span>
                                                    </div>

                                                    {tags.length ? (
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {tags
                                                                .slice(0, 3)
                                                                .map((t) => (
                                                                    <Link
                                                                        key={
                                                                            t.slug
                                                                        }
                                                                        href={
                                                                            makeHref(
                                                                                1,
                                                                            ) +
                                                                            (c &&
                                                                            c.length
                                                                                ? ""
                                                                                : `?c=${encodeURIComponent(t.slug)}`)
                                                                        }
                                                                    >
                                                                        <Badge variant="outline">
                                                                            {
                                                                                t.name
                                                                            }
                                                                        </Badge>
                                                                    </Link>
                                                                ))}
                                                            {tags.length > 3 ? (
                                                                <span className="text-xs text-muted-foreground">
                                                                    +
                                                                    {tags.length -
                                                                        3}
                                                                </span>
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
                    )}

                    {/* Pagination */}
                    {totalPages > 1 ? (
                        <>
                            <nav
                                className="mt-8 flex items-center justify-between"
                                aria-label="pagination"
                            >
                                <Link
                                    href={makeHref(Math.max(1, page - 1))}
                                    aria-disabled={page === 1}
                                    className={`text-sm ${page === 1 ? "pointer-events-none opacity-50" : "hover:underline"}`}
                                >
                                    ← Previous
                                </Link>
                                <div className="flex items-center gap-2 text-sm">
                                    {(() => {
                                        const items = [] as React.ReactNode[];
                                        let ellipsisShown = false;
                                        for (let n = 1; n <= totalPages; n++) {
                                            if (totalPages > 7) {
                                                const show =
                                                    n === 1 ||
                                                    n === totalPages ||
                                                    Math.abs(n - page) <= 1 ||
                                                    (page <= 4 && n <= 5) ||
                                                    (page >= totalPages - 3 &&
                                                        n >= totalPages - 4);
                                                if (!show) {
                                                    if (
                                                        !ellipsisShown &&
                                                        n > 1 &&
                                                        n < totalPages
                                                    ) {
                                                        items.push(
                                                            <span
                                                                key={`ellipsis-${n}`}
                                                                className="px-2"
                                                            >
                                                                …
                                                            </span>,
                                                        );
                                                        ellipsisShown = true;
                                                    }
                                                    continue;
                                                }
                                            }
                                            ellipsisShown = false;
                                            const active = n === page;
                                            items.push(
                                                <Link
                                                    key={n}
                                                    href={makeHref(n)}
                                                    className={`rounded px-2 py-1 ${active ? "bg-muted" : "hover:underline"}`}
                                                    aria-current={
                                                        active
                                                            ? "page"
                                                            : undefined
                                                    }
                                                >
                                                    {n}
                                                </Link>,
                                            );
                                        }
                                        return items;
                                    })()}
                                </div>
                                <Link
                                    href={makeHref(
                                        Math.min(totalPages, page + 1),
                                    )}
                                    aria-disabled={page === totalPages}
                                    className={`text-sm ${page === totalPages ? "pointer-events-none opacity-50" : "hover:underline"}`}
                                >
                                    Next →
                                </Link>
                            </nav>
                        </>
                    ) : null}
                </main>
            </div>
        </div>
    );
}
