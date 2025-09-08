import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rbacPermissions } from "@/schemas/rbac";
import { requirePermission } from "@/lib/guards";
import { desc } from "drizzle-orm";
import { headers } from "next/headers";

// List all permission keys (for pickers/UI). Guarded by rbac.manage.
export async function GET() {
  await requirePermission("rbac.manage", await headers());
  const rows = await db.select().from(rbacPermissions).orderBy(desc(rbacPermissions.createdAt));
  return NextResponse.json({ permissions: rows });
}
