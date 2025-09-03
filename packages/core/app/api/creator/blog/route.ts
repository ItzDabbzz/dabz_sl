import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { blogPosts, blogCategories, blogPostCategories } from "@/schemas/blog";
import { getBlogEditorUser } from "@/lib/blog-auth";
import { and, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
    const user = await getBlogEditorUser();
    if (!user) return new Response("forbidden", { status: 403 });
    const body = await req.json();
    const { title, slug, excerpt, contentMd, categories, published } =
        body || {};
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

    return Response.json({ id: post.id, slug: post.slug });
}

export async function PUT(req: NextRequest) {
    const user = await getBlogEditorUser();
    if (!user) return new Response("forbidden", { status: 403 });
    const body = await req.json();
    const { id, title, slug, excerpt, contentMd, categories, published } =
        body || {};
    if (!id) return new Response("missing_id", { status: 400 });

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
        await db.delete(blogPostCategories).where(eq(blogPostCategories.postId, id));
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

    return new Response("ok");
}

export async function GET(req: NextRequest) {
    const user = await getBlogEditorUser();
    if (!user) return new Response("forbidden", { status: 403 });
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
        .innerJoin(blogCategories, eq(blogPostCategories.categoryId, blogCategories.id))
        .where(eq(blogPostCategories.postId, id));
    return Response.json({ ...post, categories: catRows.map((c) => c.slug) });
}

export async function DELETE(req: NextRequest) {
    const user = await getBlogEditorUser();
    if (!user) return new Response("forbidden", { status: 403 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return new Response("missing_id", { status: 400 });
    await db.delete(blogPostCategories).where(eq(blogPostCategories.postId, id));
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
    return new Response("ok");
}
