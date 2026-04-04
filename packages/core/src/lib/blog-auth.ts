import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { PermissionService } from "@/lib/permission-service";

// Allowed high-level roles that can always access blog editor features.
const ALLOW_ROLES = new Set(["owner", "developer", "dev", "admin", "mod", "moderator"]);

export async function getBlogEditorUser() {
    const ses = await auth.api
        .getSession({ headers: await headers() })
        .catch(() => null as any);

    const user = (ses as any)?.user || (ses as any)?.session?.user || null;
    if (!user) return null;

    const roleRaw = ((ses as any)?.user as any)?.role as string | undefined;
    const role = roleRaw?.toLowerCase();

    // Fast-path: global role grants access regardless of org membership.
    if (role && ALLOW_ROLES.has(role)) return user;

    // Otherwise require active org + permissions.
    const orgId = (ses as any)?.session?.activeOrganizationId || null;
    if (!orgId) return null;

    const [canWrite, canSettings] = await Promise.all([
        PermissionService.hasPermission(user.id, orgId, "blog.write"),
        PermissionService.hasPermission(user.id, orgId, "blog.settings.update"),
    ]);

    return (canWrite || canSettings) ? user : null;
}
