export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { requirePermission, getActiveOrgId } from "@/lib/guards";
import { member, user } from "@/schemas/auth-schema";
import { and, asc, eq, ilike, or } from "drizzle-orm";

// Search members by name/email for pickers (current org only)
export async function GET(req: NextRequest) {
  await requirePermission("rbac.manage", await headers());
  const orgId = (await getActiveOrgId(await headers()))!;
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  const rows = await db
    .select({ memberId: member.id, userId: member.userId, role: member.role, name: user.name, email: user.email })
    .from(member)
    .leftJoin(user, eq(user.id as any, member.userId as any) as any)
    .where(and(eq(member.organizationId as any, orgId as any) as any, q ? or(ilike(user.name as any, `%${q}%`) as any, ilike(user.email as any, `%${q}%`) as any) : ({} as any)) as any)
    .orderBy(asc(user.name));

  return NextResponse.json({ members: rows });



}
