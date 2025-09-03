import { db } from "@/lib/db";
import { blogPosts, blogPostCategories, blogCategories } from "@/schemas/blog";
import { desc } from "drizzle-orm";
import { headers } from "next/headers";
import { absoluteUrl } from "@/lib/absolute-url";
import { sql } from "drizzle-orm";

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const h = await headers();
  const base = absoluteUrl(h);

  // Publicly visible posts: published and in at least one public category
  const posts = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      excerpt: blogPosts.excerpt,
      publishedAt: blogPosts.publishedAt,
      createdAt: blogPosts.createdAt,
    })
    .from(blogPosts)
    .innerJoin(blogPostCategories, sql`${blogPostCategories.postId} = ${blogPosts.id}`)
    .innerJoin(blogCategories, sql`${blogPostCategories.categoryId} = ${blogCategories.id}`)
    .where(sql`
      ${blogPosts.published} = true
      AND (${blogCategories.visibility} ->> 'mode') = 'public'
    `)
    .groupBy(blogPosts.id, blogPosts.title, blogPosts.slug, blogPosts.excerpt, blogPosts.publishedAt, blogPosts.createdAt)
    .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt))
    .limit(50);

  const channelTitle = "sl.itzdabbzz.me Blog";
  const channelLink = `${base}/blog`;
  const channelDesc = "Latest posts, guides, and updates.";
  const lastBuildDate = new Date(posts[0]?.publishedAt || Date.now()).toUTCString();

  const items = posts
    .map((p) => {
      const link = `${base}/blog/${p.slug}`;
      const pubDate = new Date(p.publishedAt || p.createdAt || Date.now()).toUTCString();
      return `\n    <item>
      <title>${escapeXml(p.title || "Untitled")}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(p.excerpt || "")}</description>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${channelLink}</link>
    <description>${escapeXml(channelDesc)}</description>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
