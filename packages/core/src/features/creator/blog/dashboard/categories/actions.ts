"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { blogCategories } from "@/schemas/blog";
import { eq } from "drizzle-orm";
import { getBlogEditorUser } from "@/lib/blog-auth";

// Local helper (not exported) to avoid Next.js server actions export rule.
function slugifyLocal(v: string) {
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
  const user = await getBlogEditorUser();
  if (!user) return;
  const name = String(formData.get("name") || "").trim();
  const slug = slugifyLocal(String(formData.get("slug") || name));
  const description = String(formData.get("description") || "").trim();
  if (!name || !slug) return;

  const visibilityMode = String(formData.get("visibilityMode") || "public");
  const roles = String(formData.get("roles") || "").split(",").map(s=>s.trim()).filter(Boolean);
  const orgIds = String(formData.get("orgIds") || "").split(",").map(s=>s.trim()).filter(Boolean);
  const teamIds = String(formData.get("teamIds") || "").split(",").map(s=>s.trim()).filter(Boolean);
  const userIds = String(formData.get("userIds") || "").split(",").map(s=>s.trim()).filter(Boolean);
  const emails = String(formData.get("emails") || "").split(",").map(s=>s.trim()).filter(Boolean);

  const visibility = { mode: visibilityMode as any, roles, orgIds, teamIds, userIds, emails };
  try {
    await db.insert(blogCategories).values({ name, slug, description, visibility: visibility as any });
  } catch {}
  revalidateBlogSurfaces();
}

export async function updateCategory(formData: FormData) {
  const user = await getBlogEditorUser();
  if (!user) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const name = String(formData.get("name") || "").trim();
  const rawSlug = String(formData.get("slug") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const nextSlug = rawSlug ? slugifyLocal(rawSlug) : undefined;

  const visibilityMode = String(formData.get("visibilityMode") || "public");
  const roles = String(formData.get("roles") || "").split(",").map(s=>s.trim()).filter(Boolean);
  const orgIds = String(formData.get("orgIds") || "").split(",").map(s=>s.trim()).filter(Boolean);
  const teamIds = String(formData.get("teamIds") || "").split(",").map(s=>s.trim()).filter(Boolean);
  const userIds = String(formData.get("userIds") || "").split(",").map(s=>s.trim()).filter(Boolean);
  const emails = String(formData.get("emails") || "").split(",").map(s=>s.trim()).filter(Boolean);
  const visibility = { mode: visibilityMode as any, roles, orgIds, teamIds, userIds, emails };
  try {
    await db.update(blogCategories).set({ ...(name && { name }), ...(nextSlug && { slug: nextSlug }), description, visibility: visibility as any }).where(eq(blogCategories.id, id));
  } catch {}
  revalidateBlogSurfaces();
}

export async function deleteCategory(formData: FormData) {
  const user = await getBlogEditorUser();
  if (!user) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  try {
    await db.delete(blogCategories).where(eq(blogCategories.id, id));
  } catch {}
  revalidateBlogSurfaces();
}
