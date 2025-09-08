import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { PermissionService } from "@/lib/permission-service";

export async function getBlogEditorUser() {
    const ses = await auth.api
        .getSession({ headers: await headers() })
        .catch(() => null as any);
    const user = (ses as any)?.user || (ses as any)?.session?.user || null;
    const orgId = (ses as any)?.session?.activeOrganizationId || null;
    if (!user || !orgId) return null;

    const canWrite = await PermissionService.hasPermission(
        user.id,
        orgId,
        "blog.write",
    );
    const canSettings = await PermissionService.hasPermission(
        user.id,
        orgId,
        "blog.settings.update",
    );
    return canWrite || canSettings ? user : null;
}
