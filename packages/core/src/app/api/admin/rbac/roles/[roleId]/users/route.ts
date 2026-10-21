export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { requirePermission } from "@/server/auth/guards";
import { rbacUserRoles, rbacRoles } from "@/schemas/rbac";
import { user } from "@/schemas/auth-schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * Who holds a platform role.
 *
 * A platform role belongs to the site, so it is held by users directly
 * rather than by the members of an organization. Only a role with no
 * organization can be assigned this way.
 */
async function getPlatformRole(roleId: string) {
    const [role] = await db
        .select()
        .from(rbacRoles)
        .where(
            and(
                eq(rbacRoles.id as any, roleId as any) as any,
                isNull(rbacRoles.organizationId as any) as any,
            ) as any,
        )
        .limit(1);
    return role ?? null;
}

export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ roleId: string }> },
) {
    await requirePermission("rbac.manage", await headers());
    const { roleId } = await ctx.params;
    const role = await getPlatformRole(roleId);
    if (!role) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const rows = await db
        .select({
            userId: rbacUserRoles.userId,
            name: user.name,
            email: user.email,
        })
        .from(rbacUserRoles)
        .leftJoin(user, eq(user.id, rbacUserRoles.userId))
        .where(eq(rbacUserRoles.roleId as any, roleId as any) as any)
        .orderBy(asc(user.name));

    return NextResponse.json({ users: rows });
}

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ roleId: string }> },
) {
    await requirePermission("rbac.manage", await headers());
    const { roleId } = await ctx.params;
    const role = await getPlatformRole(roleId);
    if (!role) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    if (!userId) {
        return NextResponse.json({ error: "invalid" }, { status: 400 });
    }

    const [target] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id as any, userId as any) as any)
        .limit(1);
    if (!target) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await db
        .insert(rbacUserRoles)
        .values({ id: randomUUID(), userId, roleId })
        .onConflictDoNothing();

    return NextResponse.json({ ok: true });
}

export async function DELETE(
    req: NextRequest,
    ctx: { params: Promise<{ roleId: string }> },
) {
    await requirePermission("rbac.manage", await headers());
    const { roleId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    if (!userId) {
        return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    await db
        .delete(rbacUserRoles)
        .where(
            and(
                eq(rbacUserRoles.roleId as any, roleId as any) as any,
                eq(rbacUserRoles.userId as any, userId as any) as any,
            ) as any,
        );
    return NextResponse.json({ ok: true });
}
