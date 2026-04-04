import { auth } from "@/lib/auth";
import { PermissionService } from "@/lib/permission-service";

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

    // Superadmin bypass (wildcard perms from .env allowlist)
    if (isSuperAdmin(user.id)) {
        return { userId: user.id, organizationId: orgId ?? "__superadmin__" };
    }

    if (!orgId) throw new Error("no_active_org");

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
