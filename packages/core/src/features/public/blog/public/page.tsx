import { db } from "@/server/db/client";
import {
    resolveHandles,
    postPath,
    listAuthors,
    resolveAuthorByHandle,
    AuthorRef,
} from "@/features/creator/blog/server/handle";
import { blogPosts, blogPostCategories, blogCategories, blogPostRatings } from "@/schemas/blog";
import { and, desc, eq, inArray, sql, or, ilike } from "drizzle-orm";
import { Suspense } from "react";
import Link from "next/link";
import { CategorySidebar } from "@/features/public/blog/components/category-sidebar";
import { PublicHeader } from "@/components/shared/public-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { user } from "@/schemas/auth-schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart } from "lucide-react";

// ISR: revalidate every 60 seconds; no force-static since searchParams are used for filtering
export const revalidate = 60;

const PAGE_SIZE = 10;

export const metadata = {
  title: "Public Blog | sl.itzdabbzz.me",
  description: "Public posts, guides, and updates.",
};

export default async function PublicBlogIndex({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; p?: string; q?: string; sort?: "latest" | "top"; author?: string }>;
}) {
  const params = await (searchParams as any);
  const c = params?.c?.split(",").filter(Boolean) as string[] | undefined;
  const page = Math.max(1, Number(params?.p || 1) || 1);
  const q = (params?.q || "").trim();
  const sort = (params?.sort as "latest" | "top" | undefined) || "latest";
  /** The author being read, if one was chosen. */
  const authorHandle = (params?.author || "").trim().toLowerCase();
  let dataUnavailable = false;
  let allCats: Array<{ id: string; name: string; slug: string }> = [];
  let total = 0;
  let totalPages = 1;
  let posts: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    authorName: string | null;
    authorImage: string | null;
  }> = [];
  const catsMap = new Map<string, { name: string; slug: string }[]>();
  const ratingMap = new Map<string, { avg: number; count: number }>();
  // Each post is addressed by the creator who wrote it.
  let handles = new Map<string, string>();
  /**
   * The authors, so a visitor can read one person's work rather than
   * everybody's, and the author that was chosen.
   */
  let authors: AuthorRef[] = [];
  let chosen: AuthorRef | null = null;
  let authorCond: ReturnType<typeof eq> | ReturnType<typeof sql> | undefined;

  try {
    allCats = await db
      .select({ id: blogCategories.id, name: blogCategories.name, slug: blogCategories.slug })
      .from(blogCategories)
      .where(sql`(${blogCategories.visibility} ->> 'mode') = 'public'`)
      .orderBy(blogCategories.name);

    let filteredPostIds: string[] | null = null;
    if (c && c.length) {
      const allowedSlugs = new Set(allCats.map((x) => x.slug));
      const effective = c.filter((slug) => allowedSlugs.has(slug));
      if (effective.length === 0) {
        filteredPostIds = [];
      } else {
        const rows = await db
          .select({ id: blogPosts.id })
          .from(blogPosts)
          .innerJoin(blogPostCategories, eq(blogPostCategories.postId, blogPosts.id))
          .innerJoin(blogCategories, eq(blogPostCategories.categoryId, blogCategories.id))
          .where(
            and(
              eq(blogPosts.published, true),
              sql`(${blogCategories.visibility} ->> 'mode') = 'public'`,
              inArray(blogCategories.slug, effective),
            ),
          );
        filteredPostIds = Array.from(new Set(rows.map((r) => r.id)));
      }
    }

    const searchCond = q ? or(ilike(blogPosts.title, `%${q}%`), ilike(blogPosts.excerpt, `%${q}%`)) : undefined;

    /**
     * The authors, so a visitor can read one person's work rather than
     * everybody's, and the author that was chosen.
     */
    authors = await listAuthors().catch(() => []);
    chosen = authorHandle
        ? authors.find((a) => a.handle === authorHandle) ?? null
        : null;
    authorCond = authorHandle
        ? await (async () => {
              const resolved = await resolveAuthorByHandle(authorHandle);
              if (!resolved) return sql`false`;
              return resolved.authorUserId
                  ? eq(blogPosts.authorUserId, resolved.authorUserId)
                  : eq(
                        blogPosts.authorOrganizationId,
                        resolved.authorOrganizationId as string,
                    );
          })()
        : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(distinct ${blogPosts.id})::int` })
      .from(blogPosts)
      .innerJoin(blogPostCategories, eq(blogPostCategories.postId, blogPosts.id))
      .innerJoin(blogCategories, eq(blogPostCategories.categoryId, blogCategories.id))
      .where(
        and(
          eq(blogPosts.published, true),
          sql`(${blogCategories.visibility} ->> 'mode') = 'public'`,
          filteredPostIds ? inArray(blogPosts.id, filteredPostIds) : sql`true`,
          searchCond ? searchCond : sql`true`,
          authorCond ? authorCond : sql`true`,
        ),
      );
    total = Number(count) || 0;
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const offset = (page - 1) * PAGE_SIZE;

    let idRows: { id: string }[] = [];
    if (sort === "top") {
      idRows = await db
        .select({
          id: blogPosts.id,
        })
        .from(blogPosts)
        .innerJoin(blogPostCategories, eq(blogPostCategories.postId, blogPosts.id))
        .innerJoin(blogCategories, eq(blogPostCategories.categoryId, blogCategories.id))
        .leftJoin(blogPostRatings, eq(blogPostRatings.postId, blogPosts.id))
        .where(
          and(
            eq(blogPosts.published, true),
            sql`(${blogCategories.visibility} ->> 'mode') = 'public'`,
            filteredPostIds ? inArray(blogPosts.id, filteredPostIds) : sql`true`,
            searchCond ? searchCond : sql`true`,
            authorCond ? authorCond : sql`true`,
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
        .innerJoin(blogPostCategories, eq(blogPostCategories.postId, blogPosts.id))
        .innerJoin(blogCategories, eq(blogPostCategories.categoryId, blogCategories.id))
        .where(
          and(
            eq(blogPosts.published, true),
            sql`(${blogCategories.visibility} ->> 'mode') = 'public'`,
            filteredPostIds ? inArray(blogPosts.id, filteredPostIds) : sql`true`,
            searchCond ? searchCond : sql`true`,
            authorCond ? authorCond : sql`true`,
            ),
        )
        .groupBy(blogPosts.id)
        .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset);
    }

    const pageIds = idRows.map((r) => r.id);
    const rows = pageIds.length
      ? await db
          .select({
            id: blogPosts.id,
            title: blogPosts.title,
            slug: blogPosts.slug,
            excerpt: blogPosts.excerpt,
            publishedAt: blogPosts.publishedAt,
            createdAt: blogPosts.createdAt,
            authorUserId: blogPosts.authorUserId,
            authorOrganizationId: blogPosts.authorOrganizationId,
            authorName: user.name,
            authorImage: user.image,
          })
          .from(blogPosts)
          .leftJoin(user, eq(user.id, blogPosts.authorUserId))
          .where(inArray(blogPosts.id, pageIds))
      : [];

    // Each post is addressed by the creator who wrote it.
    handles = await resolveHandles(rows);

    const orderIndex = new Map(pageIds.map((id, index) => [id, index] as const));
    posts = rows.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

    const visibleIds = posts.map((post) => post.id);

    if (visibleIds.length) {
      const catRows = await db
        .select({ postId: blogPostCategories.postId, name: blogCategories.name, slug: blogCategories.slug })
        .from(blogPostCategories)
        .innerJoin(blogCategories, eq(blogPostCategories.categoryId, blogCategories.id))
        .where(
          and(inArray(blogPostCategories.postId, visibleIds), sql`(${blogCategories.visibility} ->> 'mode') = 'public'`),
        );
      for (const row of catRows) {
        const existing = catsMap.get(row.postId) || [];
        existing.push({ name: row.name, slug: row.slug });
        catsMap.set(row.postId, existing);
      }

      const rRows = await db
        .select({
          postId: blogPostRatings.postId,
          avg: sql<number>`coalesce(avg(${blogPostRatings.score})::float, 0)`,
          count: sql<number>`count(*)::int`,
        })
        .from(blogPostRatings)
        .where(inArray(blogPostRatings.postId, visibleIds))
        .groupBy(blogPostRatings.postId);
      for (const row of rRows) {
        ratingMap.set(row.postId, { avg: Number(row.avg || 0), count: Number(row.count || 0) });
      }
    }
  } catch (error) {
    dataUnavailable = true;
    console.error("Failed to load public blog index", error);
  }

  const makeHref = (p: number) => {
    const sp = new URLSearchParams();
    if (c && c.length) sp.set("c", c.join(","));
    if (q) sp.set("q", q);
    if (sort && sort !== "latest") sp.set("sort", sort);
    if (authorHandle) sp.set("author", authorHandle);
    if (p > 1) sp.set("p", String(p));
    const qs = sp.toString();
    return qs ? `/blog/public?${qs}` : "/blog/public";
  };

  /** The same page with the author changed, keeping everything else. */
  const authorHref = (handle: string | null) => {
    const sp = new URLSearchParams();
    if (c && c.length) sp.set("c", c.join(","));
    if (q) sp.set("q", q);
    if (sort && sort !== "latest") sp.set("sort", sort);
    if (handle) sp.set("author", handle);
    const qs = sp.toString();
    return qs ? `/blog/public?${qs}` : "/blog/public";
  };

  const cats = allCats.map((x) => ({ id: x.id, name: x.name, slug: x.slug }));
  const recentPosts = posts.slice(0, 10);

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-6 py-10">
    <div className="mb-6 flex items-center gap-3">
      <Link href="/blog" className="text-sm text-muted-foreground hover:underline">My Feed</Link>
      <span className="text-sm">/</span>
      <span className="text-sm font-medium">Public</span>
    </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <aside className="lg:col-span-3 xl:col-span-3">
          <div className="sticky top-24 space-y-4">
            <Suspense>
              <CategorySidebar categories={cats} />
            </Suspense>
            {authors.length ? (
              <Card>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Creators
                    </div>
                    <Link
                      href="/creators"
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      All profiles
                    </Link>
                  </div>
                  <ul className="space-y-1 text-sm">
                    <li>
                      <Link
                        href={authorHref(null)}
                        className={
                          authorHandle
                            ? "text-muted-foreground hover:text-foreground hover:underline"
                            : "font-medium hover:underline"
                        }
                      >
                        All creators
                      </Link>
                    </li>
                    {authors.map((author) => (
                      <li key={author.handle} className="flex items-center justify-between gap-2">
                        <Link
                          href={authorHref(author.handle)}
                          className={
                            authorHandle === author.handle
                              ? "font-medium hover:underline"
                              : "text-muted-foreground hover:text-foreground hover:underline"
                          }
                        >
                          {author.name || author.handle}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {author.postCount}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 text-sm font-medium text-muted-foreground">Recent posts</div>
                <ScrollArea className="h-48 pr-2">
                  <ul className="space-y-2 text-sm">
                    {recentPosts.map((rp) => (
                      <li key={rp.id}>
                        <Link
                            className="line-clamp-2 hover:underline"
                            href={postPath(
                                handles.get(rp.id) ?? "creator",
                                rp.slug,
                            )}
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
                {chosen ? `Posts by ${chosen.name || chosen.handle}` : "Public Blog"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {total} post{total === 1 ? "" : "s"}
                {chosen ? ` by ${chosen.name || chosen.handle}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form action="/blog/public" className="flex items-center gap-2">
                <input type="text" name="q" defaultValue={q} placeholder="Search posts..." className="h-9 w-48 rounded border bg-background px-3 text-sm" />
                {c && c.length ? <input type="hidden" name="c" value={c.join(",")} /> : null}
                {sort && sort !== "latest" ? <input type="hidden" name="sort" value={sort} /> : null}
                {authorHandle ? <input type="hidden" name="author" value={authorHandle} /> : null}
                <button className="h-9 rounded bg-primary px-3 text-sm text-primary-foreground">Search</button>
              </form>
              <form action="/blog/public" className="flex items-center gap-2">
                <select name="sort" defaultValue={sort} className="h-9 rounded border bg-background px-2 text-sm">
                  <option value="latest">Latest</option>
                  <option value="top">Top rated</option>
                </select>
                {c && c.length ? <input type="hidden" name="c" value={c.join(",")} /> : null}
                {q ? <input type="hidden" name="q" value={q} /> : null}
                {authorHandle ? <input type="hidden" name="author" value={authorHandle} /> : null}
                <button type="submit" className="h-9 rounded border bg-background px-3 text-sm">Apply</button>
              </form>
              {(q || (c && c.length) || (sort && sort !== "latest") || authorHandle) ? (
                <Link href="/blog/public" className="text-sm text-muted-foreground hover:underline">Clear filters</Link>
              ) : null}
              <Link href="/blog/rss" className="text-sm text-muted-foreground hover:underline">RSS</Link>
            </div>
          </header>

          {posts.length === 0 ? (
            <div className="rounded border p-6 text-sm text-muted-foreground">
              {dataUnavailable ? "Public blog is temporarily unavailable. Try again shortly." : "No posts found. Try clearing filters."}
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4">
              {posts.map((p) => {
                const date = p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "Draft";
                const authorInit = (p.authorName || "?")
                  .split(" ")
                  .map((part: string) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                /**
                 * The author, and where their name should lead: to their
                 * public page when they have one, and to their posts
                 * here when they do not.
                 */
                const postHandle = handles.get(p.id) ?? "creator";
                const postAuthor = authors.find((a) => a.handle === postHandle);
                const authorHrefForPost = postAuthor?.hasProfile
                  ? `/c/${postHandle}`
                  : authorHref(postHandle);
                const tags = catsMap.get(p.id) || [];
                const r = ratingMap.get(p.id) || { avg: 0, count: 0 };
                const rounded = Math.round(r.avg);
                return (
                  <li key={p.id}>
                    <Card className="transition-colors hover:bg-muted/40">
                      <CardContent className="p-5">
                        <Link
                            href={postPath(
                                handles.get(p.id) ?? "creator",
                                p.slug,
                            )}
                            className="block"
                        >
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
                            <Link
                              href={authorHrefForPost}
                              className="flex items-center gap-2 hover:underline"
                            >
                              <Avatar>
                                <AvatarImage src={p.authorImage || undefined} alt={p.authorName || "Author"} />
                                <AvatarFallback>{authorInit}</AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground">{p.authorName || "Unknown"}</span>
                            </Link>
                          </div>
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
                              {tags.length > 3 ? <span className="text-xs text-muted-foreground">+{tags.length - 3}</span> : null}
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

          {totalPages > 1 ? (
            <nav className="mt-8 flex items-center justify-between" aria-label="pagination">
              <Link href={makeHref(Math.max(1, page - 1))} aria-disabled={page === 1} className={`text-sm ${page === 1 ? "pointer-events-none opacity-50" : "hover:underline"}`}>
                ← Previous
              </Link>
              <div className="flex items-center gap-2 text-sm">
                {(() => {
                  const items = [] as React.ReactNode[];
                  let ellipsisShown = false;
                  for (let n = 1; n <= totalPages; n++) {
                    if (totalPages > 7) {
                      const show = n === 1 || n === totalPages || Math.abs(n - page) <= 1 || (page <= 4 && n <= 5) || (page >= totalPages - 3 && n >= totalPages - 4);
                      if (!show) {
                        if (!ellipsisShown && n > 1 && n < totalPages) {
                          items.push(<span key={`ellipsis-${n}`} className="px-2">…</span>);
                          ellipsisShown = true;
                        }
                        continue;
                      }
                    }
                    ellipsisShown = false;
                    const active = n === page;
                    items.push(
                      <Link key={n} href={makeHref(n)} className={`rounded px-2 py-1 ${active ? "bg-muted" : "hover:underline"}`} aria-current={active ? "page" : undefined}>
                        {n}
                      </Link>,
                    );
                  }
                  return items;
                })()}
              </div>
              <Link href={makeHref(Math.min(totalPages, page + 1))} aria-disabled={page === totalPages} className={`text-sm ${page === totalPages ? "pointer-events-none opacity-50" : "hover:underline"}`}>
                Next →
              </Link>
            </nav>
          ) : null}
        </main>
      </div>
      </div>
    </div>
  );
}
