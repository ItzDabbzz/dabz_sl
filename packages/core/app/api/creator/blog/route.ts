import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
    blogPosts,
    blogCategories,
    blogPostCategories,
    blogPostAnnouncements,
    blogSettings,
} from "@/schemas/blog";
import { getBlogEditorUser } from "@/lib/blog-auth";
import { eq } from "drizzle-orm";
import { resend } from "@/lib/email/resend";
import { absoluteUrl } from "@/lib/absolute-url";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/guards";

export async function POST(req: NextRequest) {
    const user = await getBlogEditorUser();
    if (!user) return new Response("forbidden", { status: 403 });
    await requirePermission("blog.write", req.headers as any);
    const body = await req.json();
    const {
        title,
        slug,
        excerpt,
        contentMd,
        categories,
        published,
        sendAnnouncement,
    } = body || {};
    if (!title || !contentMd) return new Response("missing", { status: 400 });
    const postSlug = (slug || title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
    const [post] = await db
        .insert(blogPosts)
        .values({
            title,
            slug: postSlug,
            excerpt,
            contentMd,
            authorUserId: user.id,
            published: !!published,
            publishedAt: published ? new Date() : null,
        })
        .returning();
    if (Array.isArray(categories) && categories.length) {
        const catRows = await Promise.all(
            categories.map(async (slug: string) => {
                const [c] = await db
                    .select()
                    .from(blogCategories)
                    .where(eq(blogCategories.slug, slug))
                    .limit(1);
                if (c) return c;
                const [nc] = await db
                    .insert(blogCategories)
                    .values({ slug, name: slug })
                    .returning();
                return nc;
            }),
        );
        for (const c of catRows) {
            await db
                .insert(blogPostCategories)
                .values({ postId: post.id, categoryId: c.id })
                .onConflictDoNothing();
        }
    }
    if (published && sendAnnouncement) {
        await trySendPublishAnnouncement(post.id, postSlug, title, excerpt);
    }
    revalidatePath("/dashboard/blog/manage");
    revalidatePath("/blog");
    revalidatePath("/blog/public");
    revalidatePath("/blog/rss");
    revalidatePath("/sitemap.xml");
    if (post.slug && post.published) revalidatePath(`/blog/${post.slug}`);
    return Response.json({ id: post.id, slug: post.slug });
}

export async function PUT(req: NextRequest) {
    const user = await getBlogEditorUser();
    if (!user) return new Response("forbidden", { status: 403 });
    await requirePermission("blog.write", req.headers as any);
    const body = await req.json();
    const {
        id,
        title,
        slug,
        excerpt,
        contentMd,
        categories,
        published,
        sendAnnouncement,
    } = body || {};
    if (!id) return new Response("missing_id", { status: 400 });
    const [prev] = await db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.id, id))
        .limit(1);
    await db
        .update(blogPosts)
        .set({
            ...(title ? { title } : {}),
            ...(slug ? { slug } : {}),
            ...(excerpt ? { excerpt } : {}),
            ...(typeof contentMd === "string" ? { contentMd } : {}),
            ...(typeof published === "boolean"
                ? { published, publishedAt: published ? new Date() : null }
                : {}),
            updatedAt: new Date(),
        })
        .where(eq(blogPosts.id, id));
    if (Array.isArray(categories)) {
        await db
            .delete(blogPostCategories)
            .where(eq(blogPostCategories.postId, id));
        const catRows = await Promise.all(
            categories.map(async (slug: string) => {
                const [c] = await db
                    .select()
                    .from(blogCategories)
                    .where(eq(blogCategories.slug, slug))
                    .limit(1);
                if (c) return c;
                const [nc] = await db
                    .insert(blogCategories)
                    .values({ slug, name: slug })
                    .returning();
                return nc;
            }),
        );
        for (const c of catRows) {
            await db
                .insert(blogPostCategories)
                .values({ postId: id, categoryId: c.id })
                .onConflictDoNothing();
        }
    }
    if (sendAnnouncement && published && !prev?.published) {
        const effectiveSlug = slug || prev?.slug;
        const effectiveTitle = title || prev?.title;
        await trySendPublishAnnouncement(
            id,
            effectiveSlug,
            effectiveTitle,
            excerpt || prev?.excerpt,
        );
    }
    revalidatePath("/dashboard/blog/manage");
    revalidatePath("/blog");
    revalidatePath("/blog/public");
    revalidatePath("/blog/rss");
    revalidatePath("/sitemap.xml");
    if (prev?.slug) revalidatePath(`/blog/${prev.slug}`);
    const newSlug = slug || prev?.slug;
    if (newSlug) revalidatePath(`/blog/${newSlug}`);
    return new Response("ok");
}

async function trySendPublishAnnouncement(
    postId: string,
    slug: string,
    title?: string,
    excerpt?: string,
) {
    const [settings] = await db.select().from(blogSettings).limit(1);
    if (!settings?.enableEmailOnPublish) return;
    const [existing] = await db
        .select()
        .from(blogPostAnnouncements)
        .where(eq(blogPostAnnouncements.postId, postId))
        .limit(1);
    if (existing) return;
    const base = absoluteUrl(new Headers());
    const url = `${base}/blog/${slug}`;
    const subject =
        settings.emailTemplateSubject || `New post: ${title ?? slug}`;
    const html =
        settings.emailTemplateHtml ||
        `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;padding:16px">
          <h2 style="margin:0 0 8px 0">${title ?? slug}</h2>
          <p style="color:#555;margin:0 0 12px 0">${excerpt || ""}</p>
          <p style="margin:0 0 16px 0"><a href="${url}">Read the post →</a></p>
        </div>`;
    try {
        await resend.emails.send({
            from: process.env.NEXT_PUBLIC_EMAIL_FROM || "noreply@itzdabbzz.me",
            to: (
                process.env.NEXT_PUBLIC_EMAIL_TO || "devnull@itzdabbzz.me"
            ).split(","),
            subject,
            html,
        });
        await db.insert(blogPostAnnouncements).values({ postId });
    } catch (e) {
        console.error("announce-send-failed", e);
    }
}

export async function GET(req: NextRequest) {
    const user = await getBlogEditorUser();
    if (!user) return new Response("forbidden", { status: 403 });
    await requirePermission("blog.write", req.headers as any);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return new Response("missing_id", { status: 400 });
    const [post] = await db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.id, id))
        .limit(1);
    if (!post) return new Response("not_found", { status: 404 });
    const catRows = await db
        .select({ slug: blogCategories.slug })
        .from(blogPostCategories)
        .innerJoin(
            blogCategories,
            eq(blogPostCategories.categoryId, blogCategories.id),
        )
        .where(eq(blogPostCategories.postId, id));
    return Response.json({ ...post, categories: catRows.map((c) => c.slug) });
}

export async function DELETE(req: NextRequest) {
    const user = await getBlogEditorUser();
    if (!user) return new Response("forbidden", { status: 403 });
    await requirePermission("blog.write", req.headers as any);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return new Response("missing_id", { status: 400 });
    const [prev] = await db
        .select({ slug: blogPosts.slug })
        .from(blogPosts)
        .where(eq(blogPosts.id, id))
        .limit(1);
    await db
        .delete(blogPostCategories)
        .where(eq(blogPostCategories.postId, id));
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
    revalidatePath("/dashboard/blog/manage");
    revalidatePath("/blog");
    revalidatePath("/blog/public");
    revalidatePath("/blog/rss");
    revalidatePath("/sitemap.xml");
    if (prev?.slug) revalidatePath(`/blog/${prev.slug}`);
    return new Response("ok");
}
