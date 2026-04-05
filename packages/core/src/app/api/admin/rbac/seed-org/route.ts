import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { and, eq } from "drizzle-orm";
import { member } from "@/schemas/auth-schema";
import {
    rbacRoles,
    rbacRolePermissions,
    rbacMemberRoles,
    rbacPermissions,
} from "@/schemas/rbac";
import { randomUUID } from "crypto";
import { auth } from "@/server/auth/core";
import { ROLE_GRANTS } from "@/server/auth/role-permissions";

const ROLE_DEFS: Array<{
    slug: string;
    name: string;
    description?: string;
    isSystem?: boolean;
}> = [
    { slug: "owner", name: "Owner", isSystem: true },
    { slug: "developer", name: "Developer", isSystem: true },
    { slug: "admin", name: "Admin", isSystem: true },
    { slug: "mod", name: "Moderator" },
    { slug: "trusted", name: "Trusted" },
    { slug: "creator", name: "Creator" },
    { slug: "blogger", name: "Blogger" },
    { slug: "wardrobe", name: "Wardrobe" },
    { slug: "user", name: "User" },
];

// Default grants per role are imported from @/server/auth/role-permissions (ROLE_GRANTS).
// The seed endpoint writes them into the DB for orgs that want per-member overrides.

export async function POST(req: NextRequest) {
    try {
        const ses = await auth.api.getSession({ headers: req.headers as any });
        if (!ses?.user)
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        if (!isAdminId(ses.user.id))
            return NextResponse.json({ error: "forbidden" }, { status: 403 });

        const body = await req.json();
        const orgId = (body?.organizationId ||
            (ses as any)?.session?.activeOrganizationId) as string | undefined;
        if (!orgId)
            return NextResponse.json({ error: "no_org" }, { status: 400 });

        // Ensure roles exist
        const created: Record<string, string> = {};
        for (const def of ROLE_DEFS) {
            const id = randomUUID();
            const [row] = await db
                .insert(rbacRoles)
                .values({
                    id,
                    organizationId: orgId as any,
                    name: def.name,
                    slug: def.slug,
                    description: def.description || (null as any),
                    isSystem: !!def.isSystem as any,
                })
                .onConflictDoNothing()
                .returning({ id: rbacRoles.id, slug: rbacRoles.slug });
            if (row?.id) created[def.slug] = row.id;
            if (!row?.id) {
                const existing = await db
                    .select({ id: rbacRoles.id })
                    .from(rbacRoles)
                    .where(
                        and(
                            eq(
                                rbacRoles.organizationId as any,
                                orgId as any,
                            ) as any,
                            eq(rbacRoles.slug as any, def.slug as any) as any,
                        ),
                    );
                if (existing[0]?.id) created[def.slug] = existing[0].id;
            }
        }

        // Ensure permissions exist for all keys referenced in ROLE_GRANTS
        const permKeys = Array.from(
            new Set(Object.values(ROLE_GRANTS).flatMap((arr) => arr)),
        );
        if (permKeys.length > 0) {
            await db
                .insert(rbacPermissions)
                .values(
                    permKeys.map((k) => ({
                        id: k as any,
                        key: k as any,
                        label: null as any,
                        description: null as any,
                        area: null as any,
                    })),
                )
                .onConflictDoNothing();
        }

        // Apply grants
        for (const [slug, keys] of Object.entries(ROLE_GRANTS)) {
            const roleId = created[slug];
            if (!roleId) continue;
            for (const key of keys) {
                await db
                    .insert(rbacRolePermissions)
                    .values({
                        id: randomUUID(),
                        roleId: roleId as any,
                        permissionKey: key as any,
                        effect: "allow",
                    })
                    .onConflictDoNothing();
            }
        }

        // Ensure the org owner member also has the owner role assigned
        const owners = await db
            .select()
            .from(member)
            .where(
                and(
                    eq(member.organizationId as any, orgId as any) as any,
                    eq(member.role as any, "owner" as any) as any,
                ),
            );
        const ownerRoleId = created["owner"];
        for (const m of owners as any[]) {
            await db
                .insert(rbacMemberRoles)
                .values({
                    id: randomUUID(),
                    memberId: (m as any).id as any,
                    organizationId: orgId as any,
                    roleId: ownerRoleId as any,
                })
                .onConflictDoNothing();
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

function isAdminId(id: string | undefined | null) {
    const admins = (process.env.BETTER_AUTH_ADMIN_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return !!id && admins.includes(id);



}
