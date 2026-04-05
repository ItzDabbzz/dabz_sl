import { auth } from "@/server/auth/core";
import { PermissionService } from "@/server/auth/permission-service";

function isSuperAdmin(userId: string | null | undefined): boolean {
    const admins = (process.env.BETTER_AUTH_ADMIN_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return !!userId && admins.includes(userId);
}

export async function getActiveOrgId(
    headers?: Headers,
): Promise<string | null> {
    const ses = await auth.api.getSession({
        headers: (headers as any) ?? ({} as any),
    });
    const orgId = (ses as any)?.session?.activeOrganizationId || null;
    return orgId;
}

export async function requirePermission(
    key: string,
    headers?: Headers,
): Promise<{ userId: string; organizationId: string }> {
    const ses = await auth.api.getSession({
        headers: (headers as any) ?? ({} as any),
    });
    const user = (ses as any)?.user;
    const orgId = (ses as any)?.session?.activeOrganizationId as string | undefined;
    if (!user) throw new Error("unauthorized");

    // 1. Superadmin bypass (wildcard perms from .env allowlist)
    if (isSuperAdmin(user.id)) {
        return { userId: user.id, organizationId: orgId ?? "__superadmin__" };
    }

    // 2. Better Auth in-memory role check — no DB or org required.
    //    Permission key "resource.action" maps to { resource: ["action"] }.
    //    Keys with multiple dots (e.g. "blog.settings.update") split on the
    //    first dot so resource="blog", action="settings.update".
    const dotIdx = key.indexOf(".");
    const resource = dotIdx === -1 ? key : key.slice(0, dotIdx);
    const action = dotIdx === -1 ? key : key.slice(dotIdx + 1);
    const roleCheck = await auth.api.userHasPermission({
        body: {
            role: (user as any).role as any,
            permissions: { [resource]: [action] },
        },
    });
    if ((roleCheck as any)?.success) {
        return { userId: user.id, organizationId: orgId ?? "__role__" };
    }

    // 3. Org-level RBAC DB check (custom per-member grants / overrides)
    if (!orgId) throw new Error("forbidden");
    const ok = await PermissionService.hasPermission(user.id, orgId, key);
    if (!ok) throw new Error("forbidden");
    return { userId: user.id, organizationId: orgId };
}

export async function can(key: string, headers?: Headers): Promise<boolean> {
    try {
        await requirePermission(key, headers);
        return true;
    } catch {
        return false;
    }
}
