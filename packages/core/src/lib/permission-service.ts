import { db } from "@/lib/db";
import { and, eq, inArray } from "drizzle-orm";
import { member } from "@/schemas/auth-schema";
import {
    rbacMemberRoles,
    rbacRolePermissions,
    rbacUserPermissionOverrides,
} from "@/schemas/rbac";

export interface PermissionSnapshot {
    allows: Set<string>;
    denies: Set<string>;
    ts: number; // epoch ms
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, PermissionSnapshot>();

function cacheKey(userId: string, orgId: string) {
    return `${userId}:${orgId}`;
}

function isSuperAdmin(userId: string | null | undefined): boolean {
    const admins = (process.env.BETTER_AUTH_ADMIN_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return !!userId && admins.includes(userId);
}

async function isOwner(userId: string, orgId: string): Promise<boolean> {
    const rows = await db
        .select()
        .from(member)
        .where(
            and(
                eq(member.userId as any, userId as any) as any,
                eq(member.organizationId as any, orgId as any) as any,
            ),
        );
    const m = rows[0] as any;
    return !!m && m.role === "owner";
}

async function loadSnapshot(
    userId: string,
    orgId: string,
): Promise<PermissionSnapshot> {
    // member -> roles
    const mRows = await db
        .select({ id: member.id })
        .from(member)
        .where(
            and(
                eq(member.userId as any, userId as any) as any,
                eq(member.organizationId as any, orgId as any) as any,
            ),
        );
    if (!mRows.length)
        return { allows: new Set(), denies: new Set(), ts: Date.now() };
    const mId = (mRows[0] as any).id as string;

    const mrRows = await db
        .select({ roleId: rbacMemberRoles.roleId })
        .from(rbacMemberRoles)
        .where(eq(rbacMemberRoles.memberId as any, mId as any) as any);
    const roleIds = mrRows.map((r: any) => r.roleId);
    if (!roleIds.length)
        return { allows: new Set(), denies: new Set(), ts: Date.now() };

    const rpRows = await db
        .select({
            key: rbacRolePermissions.permissionKey,
            effect: rbacRolePermissions.effect,
        })
        .from(rbacRolePermissions)
        .where(
            inArray(rbacRolePermissions.roleId as any, roleIds as any) as any,
        );

    const allows = new Set<string>();
    const denies = new Set<string>();
    for (const r of rpRows as any[]) {
        if (r.effect === "deny") denies.add(r.key);
        else if (r.effect === "allow") allows.add(r.key);
    }

    // overrides (deny > allow)
    const ovRows = await db
        .select({
            key: rbacUserPermissionOverrides.permissionKey,
            effect: rbacUserPermissionOverrides.effect,
        })
        .from(rbacUserPermissionOverrides)
        .where(
            and(
                eq(
                    rbacUserPermissionOverrides.userId as any,
                    userId as any,
                ) as any,
                eq(
                    rbacUserPermissionOverrides.organizationId as any,
                    orgId as any,
                ) as any,
            ),
        );
    for (const r of ovRows as any[]) {
        if (r.effect === "deny") {
            denies.add(r.key);
            allows.delete(r.key);
        } else if (r.effect === "allow") {
            if (!denies.has(r.key)) allows.add(r.key);
        }
    }

    return { allows, denies, ts: Date.now() };
}

export const PermissionService = {
    async hasPermission(
        userId: string,
        orgId: string,
        key: string,
    ): Promise<boolean> {
        if (!userId) return false;
        if (isSuperAdmin(userId)) return true;
        if (!orgId) return false;
        if (await isOwner(userId, orgId)) return true;

        const ck = cacheKey(userId, orgId);
        const snap = cache.get(ck);
        if (snap && Date.now() - snap.ts < CACHE_TTL_MS) {
            return snap.denies.has(key) ? false : snap.allows.has(key);
        }

        const fresh = await loadSnapshot(userId, orgId);
        cache.set(ck, fresh);
        return fresh.denies.has(key) ? false : fresh.allows.has(key);
    },

    async listUserPermissions(
        userId: string,
        orgId: string,
    ): Promise<string[]> {
        if (isSuperAdmin(userId)) return ["*:"];
        if (await isOwner(userId, orgId)) return ["*:"];
        const ck = cacheKey(userId, orgId);
        let snap = cache.get(ck);
        if (!snap || Date.now() - snap.ts >= CACHE_TTL_MS) {
            snap = await loadSnapshot(userId, orgId);
            cache.set(ck, snap);
        }
        return [...snap.allows].filter((k) => !snap!.denies.has(k));
    },

    invalidate(userId?: string, orgId?: string) {
        if (!userId || !orgId) {
            cache.clear();
            return;
        }
        cache.delete(cacheKey(userId, orgId));
    },
};
