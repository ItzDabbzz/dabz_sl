import { getBlogEditorUser } from "@/lib/blog-auth";
import { db } from "@/lib/db";
import { blogCategories } from "@/schemas/blog";
import { desc, eq, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { revalidatePath } from "next/cache";

function slugify(v: string) {
    return v
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}

export async function createCategory(formData: FormData) {
    "use server";
    const user = await getBlogEditorUser();
    if (!user) return;
    const name = String(formData.get("name") || "").trim();
    const slug = slugify(String(formData.get("slug") || name));
    const description = String(formData.get("description") || "").trim();
    if (!name || !slug) return;
    try {
        await db.insert(blogCategories).values({ name, slug, description });
    } catch {}
    revalidatePath("/dashboard/blog/categories");
}

export async function updateCategory(formData: FormData) {
    "use server";
    const user = await getBlogEditorUser();
    if (!user) return;
    const id = String(formData.get("id") || "");
    const name = String(formData.get("name") || "").trim();
    const rawSlug = String(formData.get("slug") || "").trim();
    const description = String(formData.get("description") || "").trim();
    if (!id) return;
    const nextSlug = rawSlug ? slugify(rawSlug) : undefined;
    try {
        await db
            .update(blogCategories)
            .set({
                ...(name && { name }),
                ...(nextSlug && { slug: nextSlug }),
                description,
            })
            .where(eq(blogCategories.id, id));
    } catch {}
    revalidatePath("/dashboard/blog/categories");
}

export async function deleteCategory(formData: FormData) {
    "use server";
    const user = await getBlogEditorUser();
    if (!user) return;
    const id = String(formData.get("id") || "");
    if (!id) return;
    try {
        await db.delete(blogCategories).where(eq(blogCategories.id, id));
    } catch {}
    revalidatePath("/dashboard/blog/categories");
}

export default async function BlogCategoriesPage() {
    const user = await getBlogEditorUser();
    if (!user)
        return (
            <div className="p-6 text-sm text-red-500">
                You do not have access.
            </div>
        );

    const categories = await db
        .select()
        .from(blogCategories)
        .orderBy(desc(blogCategories.createdAt));
    const [[{ count } = { count: 0 }]] = (await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(blogCategories),
    ])) as any;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Categories</h1>
                    <p className="text-sm text-muted-foreground">
                        {count} total
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">New Category</CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        action={createCategory}
                        className="grid gap-3 sm:grid-cols-3"
                    >
                        <Input name="name" placeholder="Name" required />
                        <Input name="slug" placeholder="Slug (optional)" />
                        <div className="sm:col-span-2">
                            <Input
                                name="description"
                                placeholder="Description (optional)"
                            />
                        </div>
                        <div className="sm:col-span-1 flex sm:justify-end">
                            <Button type="submit">Create</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">All Categories</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Slug</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="w-0"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell className="font-medium">
                                            <form
                                                action={updateCategory}
                                                className="flex gap-2"
                                            >
                                                <input
                                                    type="hidden"
                                                    name="id"
                                                    value={c.id}
                                                />
                                                <Input
                                                    name="name"
                                                    defaultValue={c.name}
                                                    className="w-48"
                                                />
                                                <Input
                                                    name="slug"
                                                    defaultValue={c.slug}
                                                    className="w-48"
                                                />
                                                <Input
                                                    name="description"
                                                    defaultValue={
                                                        c.description || ""
                                                    }
                                                    className="flex-1"
                                                />
                                                <Button
                                                    type="submit"
                                                    variant="secondary"
                                                >
                                                    Save
                                                </Button>
                                            </form>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground hidden" />
                                        <TableCell className="text-muted-foreground hidden" />
                                        <TableCell className="text-right">
                                            <details className="inline-block">
                                                <summary className="cursor-pointer text-destructive hover:underline list-none">
                                                    Delete
                                                </summary>
                                                <div className="mt-2">
                                                    <form action={deleteCategory}>
                                                        <input
                                                            type="hidden"
                                                            name="id"
                                                            value={c.id}
                                                        />
                                                        <Button
                                                            type="submit"
                                                            variant="destructive"
                                                        >
                                                            Confirm delete
                                                        </Button>
                                                    </form>
                                                </div>
                                            </details>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {categories.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="text-center text-sm text-muted-foreground"
                                        >
                                            No categories
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
