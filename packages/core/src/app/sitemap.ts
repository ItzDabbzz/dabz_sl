import { MetadataRoute } from "next";
import { db } from "@/server/db/client";
import { blogPosts } from "@/schemas/blog";
import { eq } from "drizzle-orm";
import { resolveHandles, postPath } from "@/features/creator/blog/server/handle";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://sl.itzdabbzz.me";
  let posts: Array<{
    id: string;
    slug: string;
    authorUserId: string | null;
    authorOrganizationId: string | null;
    updatedAt: Date | null;
    publishedAt: Date | null;
  }> = [];

  try {
    posts = await db
      .select({
        id: blogPosts.id,
        slug: blogPosts.slug,
        authorUserId: blogPosts.authorUserId,
        authorOrganizationId: blogPosts.authorOrganizationId,
        updatedAt: blogPosts.updatedAt,
        publishedAt: blogPosts.publishedAt,
      })
      .from(blogPosts)
      .where(eq(blogPosts.published, true));
  } catch (error) {
    console.error("Failed to load sitemap posts", error);
  }

  // A post is addressed by the creator who wrote it.
  const handles = await resolveHandles(posts);

  // Derive a recent change date for blog index (optional)
  const latestPostDate = posts.reduce<Date | null>((acc, p) => {
    const d = (p.updatedAt as Date) || (p.publishedAt as Date) || null;
    if (!acc) return d;
    if (!d) return acc;
    return d > acc ? d : acc;
  }, null);

  const urls: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/blog`, changeFrequency: "daily", priority: 0.7, ...(latestPostDate ? { lastModified: latestPostDate.toISOString() } : {}) },
    { url: `${base}/blog/public`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/api-docs`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/marketplace`, changeFrequency: "weekly", priority: 0.5 },
    ...posts.map((p) => ({
      url: `${base}${postPath(handles.get(p.id) ?? "creator", p.slug)}`,
      lastModified: ((p.updatedAt as Date) || (p.publishedAt as Date) || new Date()).toISOString(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];

  return urls;
}
