import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/organization/access";

/**
 * Single source of truth for all role-based permissions in the app.
 *
 * Structure: resource → actions[]
 * Permission keys map as:  "resource.action"  e.g. "marketplace.edit"
 *
 * Used by:
 *  - Better Auth admin plugin (user/session management)
 *  - requirePermission() guard via auth.api.userHasPermission (in-memory, no DB/org needed)
 *  - seed-org endpoint (ROLE_GRANTS in role-permissions.ts mirrors this for DB seeding)
 */
const adminStatements = {
    // --- Better Auth built-ins ---
    user: [
        "create",
        "list",
        "set-role",
        "ban",
        "impersonate",
        "delete",
        "set-password",
        "update",
    ] as const,
    session: ["list", "revoke", "delete"] as const,

    // --- App: Marketplace ---
    marketplace: [
        "view",
        "edit",
        "moderate",
        "admin",
        "requests",
    ] as const,

    // --- App: Blog ---
    blog: ["view", "write", "settings.update"] as const,

    // --- App: SL DB / Creator tools ---
    sldb: ["view", "edit", "admin"] as const,

    // --- App: Wardrobe ---
    wardrobe: ["view", "edit"] as const,

    // --- App: Dashboard / Settings / API keys ---
    dashboard: ["view"] as const,
    settings: ["view"] as const,
    apikey: ["manage"] as const,

    // --- App: RBAC management ---
    rbac: ["manage"] as const,

    // --- App: Org management ---
    org: ["view", "delete"] as const,
} as const;

export const adminAccessControl = createAccessControl(adminStatements);

// ── Superuser roles (full access) ──────────────────────────────────────────

const fullAppPerms = {
    marketplace: [...adminStatements.marketplace],
    blog: [...adminStatements.blog],
    sldb: [...adminStatements.sldb],
    wardrobe: [...adminStatements.wardrobe],
    dashboard: [...adminStatements.dashboard],
    settings: [...adminStatements.settings],
    apikey: [...adminStatements.apikey],
    rbac: [...adminStatements.rbac],
    org: [...adminStatements.org],
} as const;

const fullUserPerms = {
    user: [...adminStatements.user],
    session: [...adminStatements.session],
} as const;

export const ownerAdminRole = adminAccessControl.newRole({
    ...fullUserPerms,
    ...fullAppPerms,
});
export const developerAdminRole = adminAccessControl.newRole({
    ...fullUserPerms,
    ...fullAppPerms,
});
export const adminAdminRole = adminAccessControl.newRole({
    ...fullUserPerms,
    ...fullAppPerms,
});

// ── Moderator: full app access, no rbac.manage / org.delete, limited user mgmt ──

export const modAdminRole = adminAccessControl.newRole({
    user: ["list", "set-role", "ban", "impersonate"],
    session: ["list", "revoke", "delete"],
    marketplace: [...adminStatements.marketplace],
    blog: [...adminStatements.blog],
    sldb: [...adminStatements.sldb],
    wardrobe: [...adminStatements.wardrobe],
    dashboard: [...adminStatements.dashboard],
    settings: [...adminStatements.settings],
    apikey: [...adminStatements.apikey],
    org: ["view"],
    rbac: [],
});

// ── Trusted: marketplace edit + requests, no delete, no admin tools ──────────

export const trustedAdminRole = adminAccessControl.newRole({
    user: ["list"],
    session: ["list"],
    marketplace: ["view", "edit", "requests"],
    blog: [],
    sldb: [],
    wardrobe: [],
    dashboard: [],
    settings: [],
    apikey: [],
    org: [],
    rbac: [],
});

// ── Specialised roles ─────────────────────────────────────────────────────────

export const creatorAdminRole = adminAccessControl.newRole({
    user: ["list"],
    session: ["list"],
    sldb: ["view", "edit"],
    marketplace: [],
    blog: [],
    wardrobe: [],
    dashboard: [],
    settings: [],
    apikey: [],
    org: [],
    rbac: [],
});

export const bloggerAdminRole = adminAccessControl.newRole({
    user: ["list"],
    session: ["list"],
    blog: ["view", "write"],
    marketplace: [],
    sldb: [],
    wardrobe: [],
    dashboard: [],
    settings: [],
    apikey: [],
    org: [],
    rbac: [],
});

export const wardrobeAdminRole = adminAccessControl.newRole({
    user: ["list"],
    session: ["list"],
    wardrobe: ["view", "edit"],
    marketplace: [],
    blog: [],
    sldb: [],
    dashboard: [],
    settings: [],
    apikey: [],
    org: [],
    rbac: [],
});

// ── Default user ──────────────────────────────────────────────────────────────

export const userAdminRole = adminAccessControl.newRole({
    user: [],
    session: [],
    marketplace: ["view"],
    blog: ["view"],
    wardrobe: ["view"],
    dashboard: ["view"],
    settings: ["view"],
    apikey: ["manage"],
    sldb: [],
    org: [],
    rbac: [],
});

// ── Org plugin access control (org membership roles: owner / admin / member) ──
// Used by the organization plugin in core.ts and organizationClient() in client.ts.

const orgStatements = {
    ...defaultStatements,
    team: ["create", "update", "delete"],
} as const;

export const ac = createAccessControl(orgStatements);

export const owner = ac.newRole({
    ...adminAc.statements,
    team: ["create", "update", "delete"],
});

export const admin = ac.newRole({
    ...adminAc.statements,
    team: ["create", "update", "delete"],
});

export const member = ac.newRole({
    team: [],
});

// ── Category visibility helpers ───────────────────────────────────────────────

export type ViewerContext = {
    isLoggedIn: boolean;
    role?: string | null;
    orgId?: string | null;
    teamIds?: string[];
    userId?: string | null;
    email?: string | null;
};

export type CategoryVisibility = {
    mode?: "public" | "login" | "restricted";
    roles?: string[];
    orgIds?: string[];
    teamIds?: string[];
    userIds?: string[];
    emails?: string[];
};

export function canViewCategory(
    visibility: CategoryVisibility | null | undefined,
    viewer: ViewerContext,
): boolean {
    const v = visibility || { mode: "public" };
    const mode = v.mode || "public";
    if (mode === "public") return true;
    if (mode === "login") return !!viewer.isLoggedIn;
    // restricted: allow if any matcher hits
    const checks: boolean[] = [];
    if (v.roles?.length) checks.push(!!viewer.role && v.roles.includes(viewer.role!));
    if (v.orgIds?.length) checks.push(!!viewer.orgId && v.orgIds.includes(viewer.orgId!));
    if (v.teamIds?.length) checks.push((viewer.teamIds || []).some((t) => v.teamIds!.includes(t)));
    if (v.userIds?.length) checks.push(!!viewer.userId && v.userIds.includes(viewer.userId!));
    if (v.emails?.length) checks.push(!!viewer.email && v.emails.includes(viewer.email!));
    return checks.some(Boolean);
}
