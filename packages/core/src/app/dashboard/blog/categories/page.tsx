import { getBlogEditorUser } from "@/lib/blog-auth";
import { db } from "@/lib/db";
import { blogCategories } from "@/schemas/blog";
import { desc, sql } from "drizzle-orm";
import { CategoriesClient } from "./categories-client";

export default async function BlogCategoriesPage() {
    const user = await getBlogEditorUser();
    if (!user) {
        return <div className="p-6 text-sm text-red-500">You do not have access.</div>;
    }
    const categories = await db.select().from(blogCategories).orderBy(desc(blogCategories.createdAt));
    const [[{ count } = { count: 0 }]] = (await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(blogCategories),
    ])) as any;
    return <CategoriesClient categories={categories as any} count={count} />;
}
