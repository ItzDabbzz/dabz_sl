import { getBlogEditorUser } from "@/lib/blog-auth";
import { db } from "@/lib/db";
import { blogCategories } from "@/schemas/blog";
import { desc, eq, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { revalidatePath } from "next/cache";
import { OrgTeamPicker } from "@/components/pickers/org-team-picker";
import { TeamPicker } from "@/components/pickers/team-picker";
import { UserPicker } from "@/components/pickers/user-picker";

function slugify(v: string) {
    return v
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}

function revalidateBlogSurfaces() {
    revalidatePath("/dashboard/blog/categories");
    revalidatePath("/blog");
    revalidatePath("/blog/public");
    revalidatePath("/blog/rss");
    revalidatePath("/sitemap.xml");
}

export async function createCategory(formData: FormData) {
    "use server";
    const user = await getBlogEditorUser();
    if (!user) return;
    const name = String(formData.get("name") || "").trim();
    const slug = slugify(String(formData.get("slug") || name));
    const description = String(formData.get("description") || "").trim();
    if (!name || !slug) return;

    // visibility inputs
    const visibilityMode = String(formData.get("visibilityMode") || "public");
    const roles = String(formData.get("roles") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const orgIds = String(formData.get("orgIds") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const teamIds = String(formData.get("teamIds") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const userIds = String(formData.get("userIds") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const emails = String(formData.get("emails") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const visibility = {
        mode: visibilityMode as "public" | "login" | "restricted",
        roles,
        orgIds,
        teamIds,
        userIds,
        emails,
    } as const;

    try {
        await db
            .insert(blogCategories)
            .values({ name, slug, description, visibility: visibility as any });
    } catch {}
    revalidateBlogSurfaces();
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

    const visibilityMode = String(formData.get("visibilityMode") || "public");
    const roles = String(formData.get("roles") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const orgIds = String(formData.get("orgIds") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const teamIds = String(formData.get("teamIds") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const userIds = String(formData.get("userIds") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const emails = String(formData.get("emails") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const visibility = {
        mode: visibilityMode as "public" | "login" | "restricted",
        roles,
        orgIds,
        teamIds,
        userIds,
        emails,
    } as const;

    try {
        await db
            .update(blogCategories)
            .set({
                ...(name && { name }),
                ...(nextSlug && { slug: nextSlug }),
                description,
                visibility: visibility as any,
            })
            .where(eq(blogCategories.id, id));
    } catch {}
    revalidateBlogSurfaces();
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
    revalidateBlogSurfaces();
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
                        className="grid gap-3"
                    >
                        <div className="grid gap-2 sm:grid-cols-3">
                            <Input name="name" placeholder="Name" required />
                            <Input name="slug" placeholder="Slug (optional)" />
                            <Input name="description" placeholder="Description (optional)" className="sm:col-span-3" />
                        </div>

                        <div className="grid gap-3 rounded border p-3">
                            <div className="text-sm font-medium">Visibility</div>
                            <div className="grid gap-3 lg:grid-cols-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">
                                        Mode
                                    </label>
                                    <select
                                        name="visibilityMode"
                                        className="w-full rounded border bg-background px-3 py-2"
                                    >
                                        <option value="public">Public</option>
                                        <option value="login">Logged-in only</option>
                                        <option value="restricted">
                                            Restricted (match any)
                                        </option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">
                                        Roles (comma-separated)
                                    </label>
                                    <Input
                                        name="roles"
                                        placeholder="owner,admin,developer"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <OrgTeamPicker labelOrg="Organizations" labelTeams="Teams" preferTeamPicker />
                                </div>
                                <div className="space-y-1">
                                    <UserPicker label="Whitelist users" name="userIds" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">
                                        Emails (whitelist)
                                    </label>
                                    <Input
                                        name="emails"
                                        placeholder="a@b.com, c@d.com"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                When Restricted, access is granted if any of the
                                lists match the viewer.
                            </p>
                        </div>

                        <div className="flex justify-end">
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
                    <div className="space-y-3">
                        {categories.map((c) => (
                            <div key={c.id} className="rounded-md border p-3">
                                <form action={updateCategory} className="grid gap-3">
                                    <input type="hidden" name="id" value={c.id} />

                                    <div className="grid gap-2 sm:grid-cols-3">
                                        <Input name="name" defaultValue={c.name} placeholder="Name" />
                                        <Input name="slug" defaultValue={c.slug} placeholder="Slug" />
                                        <Input name="description" defaultValue={c.description || ""} placeholder="Description (optional)" />
                                    </div>

                                    <details className="rounded border">
                                        <summary className="cursor-pointer list-none px-3 py-2 text-sm flex items-center justify-between">
                                            <span>Visibility: {((c as any).visibility?.mode || "public").toUpperCase()}</span>
                                            <span className="text-xs text-muted-foreground">
                                                roles: {(((c as any).visibility?.roles) || []).length} · org: {(((c as any).visibility?.orgIds) || []).length} · teams: {(((c as any).visibility?.teamIds) || []).length} · users: {(((c as any).visibility?.userIds) || []).length} · emails: {(((c as any).visibility?.emails) || []).length}
                                            </span>
                                        </summary>
                                        <div className="p-3 grid gap-3">
                                            <div className="grid gap-3 lg:grid-cols-3">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Mode</label>
                                                    <select name="visibilityMode" defaultValue={(c as any).visibility?.mode || "public"} className="w-full rounded border bg-background px-3 py-2">
                                                        <option value="public">Public</option>
                                                        <option value="login">Logged-in only</option>
                                                        <option value="restricted">Restricted (match any)</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Roles</label>
                                                    <Input name="roles" defaultValue={((c as any).visibility?.roles || []).join(", ")} placeholder="owner,admin,developer" />
                                                </div>
                                                <div className="space-y-1">
                                                    <OrgTeamPicker
                                                        defaultOrgIds={((c as any).visibility?.orgIds || [])}
                                                        defaultTeamIds={((c as any).visibility?.teamIds || [])}
                                                        preferTeamPicker
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <UserPicker label="Whitelist users" name="userIds" defaultUserIds={((c as any).visibility?.userIds || [])} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Emails</label>
                                                    <Input name="emails" defaultValue={((c as any).visibility?.emails || []).join(", ")} placeholder="a@b.com, c@d.com" />
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground">When Restricted, access is granted if any of the lists match the viewer.</p>
                                        </div>
                                    </details>

                                    <div className="flex items-center justify-between">
                                        <Button type="submit" variant="secondary">Save</Button>
                                        <details>
                                            <summary className="cursor-pointer text-destructive hover:underline list-none text-sm">Delete</summary>
                                            <div className="mt-2">
                                                <form action={deleteCategory}>
                                                    <input type="hidden" name="id" value={c.id} />
                                                    <Button type="submit" variant="destructive" size="sm">Confirm delete</Button>
                                                </form>
                                            </div>
                                        </details>
                                    </div>
                                </form>
                            </div>
                        ))}
                        {categories.length === 0 && (
                            <div className="text-center text-sm text-muted-foreground border rounded-md p-6">No categories</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
