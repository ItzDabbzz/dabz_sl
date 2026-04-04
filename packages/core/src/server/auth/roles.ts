const MARKETPLACE_PRIVILEGED_ROLES = new Set([
    "owner",
    "developer",
    "admin",
    "mod",
]);

export function isPrivilegedMarketplaceRole(
    role: string | undefined | null,
) {
    return typeof role === "string" && MARKETPLACE_PRIVILEGED_ROLES.has(role);
}

export function isConfiguredAdminId(id: string | undefined | null) {
    const admins = (process.env.BETTER_AUTH_ADMIN_IDS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

    return typeof id === "string" && admins.includes(id);
}
