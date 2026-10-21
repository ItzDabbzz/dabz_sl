export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { requirePermission, getActiveOrgId } from "@/server/auth/guards";
import { rbacRoles } from "@/schemas/rbac";
import { and, asc, eq, ilike, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * The scope a role belongs to.
 *
 * A platform role belongs to the site - it is what staff hold. An
 * organization role belongs to a creator team. The two are kept apart:
 * a team must never be able to grant itself staff powers.
 */
function requestedScope(req: NextRequest): "platform" | "organization" {
    const { searchParams } = new URL(req.url);
    return searchParams.get("scope") === "platform"
        ? "platform"
        : "organization";
}

export async function GET(req: NextRequest) {
    await requirePermission("rbac.manage", await headers());
    const scope = requestedScope(req);
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    const scopeFilter =
        scope === "platform"
            ? isNull(rbacRoles.organizationId as any)
            : eq(
                  rbacRoles.organizationId as any,
                  ((await getActiveOrgId(await headers())) ?? "") as any,
              );

    const rows = await db
        .select()
        .from(rbacRoles)
        .where(
            q
                ? and(scopeFilter, ilike(rbacRoles.name as any, `%${q}%`) as any)
                : scopeFilter,
        )
        .orderBy(asc(rbacRoles.isSystem), asc(rbacRoles.name));

    return NextResponse.json({ roles: rows, scope });
}

export async function POST(req: NextRequest) {
    await requirePermission("rbac.manage", await headers());
    const scope = requestedScope(req);
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const slug = String(body?.slug || name.toLowerCase().replace(/\s+/g, "-")).trim();
    const description = (body?.description ?? null) as string | null;
    if (!name || !slug) return NextResponse.json({ error: "invalid" }, { status: 400 });

    // A platform role is not tied to an organization; an organization
    // role belongs to the team the admin is acting as.
    const organizationId =
        scope === "platform"
            ? null
            : ((await getActiveOrgId(await headers())) ?? null);

    const id = randomUUID();
    await db
        .insert(rbacRoles)
        .values({
            id,
            organizationId: organizationId as any,
            scope,
            name,
            slug,
            description: description as any,
            isSystem: false as any,
        })
        .onConflictDoNothing();

    return NextResponse.json({ ok: true, id, scope });
}
