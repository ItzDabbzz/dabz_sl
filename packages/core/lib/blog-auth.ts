import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const ROLE_ALLOW = new Set(["owner", "developer", "admin"]);

export async function getBlogEditorUser() {
    const ses = await auth.api.getSession({ headers: await headers() }).catch(() => null as any);
    const user = (ses as any)?.user || (ses as any)?.session?.user || null;
    if (!user) return null;
    const allowIds = (process.env.BLOG_EDITOR_ALLOW_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const role = (user as any).role;
    const allowed = ROLE_ALLOW.has(role) || allowIds.includes(user.id);
    return allowed ? user : null;
}
