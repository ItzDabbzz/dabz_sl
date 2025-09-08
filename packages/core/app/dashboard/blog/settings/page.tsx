import { getBlogEditorUser } from "@/lib/blog-auth";
import { db } from "@/lib/db";
import { blogCategories, blogSettings, blogPostRatings } from "@/schemas/blog";
import { desc, eq, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { revalidatePath } from "next/cache";
import { EmailTemplateEditor } from "@/components/blog/email-template-editor";
import { requirePermission } from "@/lib/guards";
import { headers } from "next/headers";

export async function saveSettings(formData: FormData) {
    "use server";
    // Require explicit blog settings permission
    await requirePermission("blog.settings.update", await headers());

    const user = await getBlogEditorUser();
    if (!user) return;
    const heroCategoryId =
        String(formData.get("heroCategoryId") || "").trim() || null;
    const featuredCategoryId =
        String(formData.get("featuredCategoryId") || "").trim() || null;
    const seoTitleSuffix =
        String(formData.get("seoTitleSuffix") || "").trim() || null;
    const seoDefaultDescription =
        String(formData.get("seoDefaultDescription") || "").trim() || null;
    const seoOgImageUrl =
        String(formData.get("seoOgImageUrl") || "").trim() || null;
    const enableRatingsSummary = formData.get("enableRatingsSummary") === "on";
    const enableEmailOnPublish = formData.get("enableEmailOnPublish") === "on";
    const emailTemplateSubject =
        String(formData.get("emailTemplateSubject") || "").trim() || null;
    const emailTemplateHtml =
        String(formData.get("emailTemplateHtml") || "").trim() || null;

    const [existing] = await db.select().from(blogSettings).limit(1);
    if (existing) {
        await db
            .update(blogSettings)
            .set({
                heroCategoryId: heroCategoryId as any,
                featuredCategoryId: featuredCategoryId as any,
                seoTitleSuffix: seoTitleSuffix as any,
                seoDefaultDescription: seoDefaultDescription as any,
                seoOgImageUrl: seoOgImageUrl as any,
                enableRatingsSummary,
                enableEmailOnPublish,
                emailTemplateSubject: emailTemplateSubject as any,
                emailTemplateHtml: emailTemplateHtml as any,
                updatedAt: new Date(),
            })
            .where(eq(blogSettings.id, (existing as any).id));
    } else {
        await db.insert(blogSettings).values({
            heroCategoryId: heroCategoryId as any,
            featuredCategoryId: featuredCategoryId as any,
            seoTitleSuffix: seoTitleSuffix as any,
            seoDefaultDescription: seoDefaultDescription as any,
            seoOgImageUrl: seoOgImageUrl as any,
            enableRatingsSummary,
            enableEmailOnPublish,
            emailTemplateSubject: emailTemplateSubject as any,
            emailTemplateHtml: emailTemplateHtml as any,
        });
    }

    // Revalidate settings page and public surfaces impacted by settings
    revalidatePath("/dashboard/blog/settings");
    revalidatePath("/blog");
    revalidatePath("/blog/public");
    revalidatePath("/blog/rss");
    revalidatePath("/sitemap.xml");
}

export default async function BlogSettingsPage() {
    // Only users with blog.settings.update may access this page
    try {
        await requirePermission("blog.settings.update", await headers());
    } catch {
        return (
            <div className="p-6 text-sm text-red-500">
                You do not have access.
            </div>
        );
    }

    const categories = await db
        .select()
        .from(blogCategories)
        .orderBy(desc(blogCategories.createdAt));
    const [settings] = await db.select().from(blogSettings).limit(1);
    const [ratingSummary] = await db
        .select({
            count: sql<number>`count(*)::int`,
            avg: sql<number>`coalesce(avg(score),0)::float`,
        })
        .from(blogPostRatings);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Blog Settings</h1>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Publishing & Featured
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        action={saveSettings}
                        className="grid gap-4 sm:grid-cols-2"
                    >
                        <div className="space-y-2 sm:col-span-1">
                            <label className="text-sm font-medium">
                                Hero Category
                            </label>
                            <select
                                name="heroCategoryId"
                                defaultValue={settings?.heroCategoryId || ""}
                                className="w-full rounded border bg-background px-3 py-2"
                            >
                                <option value="">None</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2 sm:col-span-1">
                            <label className="text-sm font-medium">
                                Featured Category
                            </label>
                            <select
                                name="featuredCategoryId"
                                defaultValue={
                                    settings?.featuredCategoryId || ""
                                }
                                className="w-full rounded border bg-background px-3 py-2"
                            >
                                <option value="">None</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                            <label className="text-sm font-medium">
                                Enable Ratings Summary
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="enableRatingsSummary"
                                    defaultChecked={
                                        settings?.enableRatingsSummary ?? true
                                    }
                                />
                                <span className="text-sm text-muted-foreground">
                                    Show ratings averages/counts on blog
                                </span>
                            </div>
                        </div>

                        <div className="sm:col-span-2 border-t pt-4" />

                        <div className="space-y-2 sm:col-span-2">
                            <label className="text-sm font-medium">
                                SEO Title Suffix
                            </label>
                            <Input
                                name="seoTitleSuffix"
                                defaultValue={settings?.seoTitleSuffix || ""}
                                placeholder=" | My Site"
                            />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <label className="text-sm font-medium">
                                Default Description
                            </label>
                            <Input
                                name="seoDefaultDescription"
                                defaultValue={
                                    settings?.seoDefaultDescription || ""
                                }
                                placeholder="Default meta description for blog pages"
                            />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <label className="text-sm font-medium">
                                Default Open Graph Image URL
                            </label>
                            <Input
                                name="seoOgImageUrl"
                                defaultValue={settings?.seoOgImageUrl || ""}
                                placeholder="https://.../og.png"
                            />
                        </div>

                        <div className="sm:col-span-2 border-t pt-4" />

                        <div className="space-y-2 sm:col-span-2">
                            <label className="text-sm font-medium">
                                Email on First Publish
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="enableEmailOnPublish"
                                    defaultChecked={
                                        settings?.enableEmailOnPublish ?? false
                                    }
                                />
                                <span className="text-sm text-muted-foreground">
                                    Allow sending a one-time announcement per
                                    post
                                </span>
                            </div>
                        </div>

                        {/* Email template editor with live preview */}
                        <div className="sm:col-span-2">
                            <EmailTemplateEditor
                                initialSubject={
                                    settings?.emailTemplateSubject ||
                                    "New post: {{title}}"
                                }
                                initialHtml={settings?.emailTemplateHtml || ""}
                            />
                        </div>

                        <div className="sm:col-span-2 flex justify-end">
                            <Button type="submit">Save Settings</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Ratings Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground">
                        Total ratings:{" "}
                        <span className="text-foreground font-medium">
                            {ratingSummary?.count ?? 0}
                        </span>{" "}
                        · Average score:{" "}
                        <span className="text-foreground font-medium">
                            {(ratingSummary?.avg ?? 0).toFixed(2)}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
