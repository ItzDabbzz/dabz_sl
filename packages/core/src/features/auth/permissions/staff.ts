/**
 * Who counts as staff.
 *
 * Staff are the people who run the site. This is a platform-level thing
 * and is deliberately kept apart from organization permissions: an
 * organization is a creator team, and a creator team managing its own
 * members must never reach staff functions.
 *
 * The file lives in the features folder rather than under server/ so the
 * dashboard shell and the API guards can share one answer - if the two
 * drift, a page can hide what the API still allows.
 */

/** The platform roles that are staff. */
export const STAFF_ROLES = new Set([
    "owner",
    "developer",
    "dev",
    "admin",
    "mod",
    "moderator",
    "trusted",
]);

export function isStaffRole(role: string | undefined | null) {
    return typeof role === "string" && STAFF_ROLES.has(role);
}

/**
 * The ids that are always staff.
 *
 * Both names are read: the public one is what the browser can see, the
 * private one is what the server has.
 */
export function isConfiguredAdminId(id: string | undefined | null) {
    const admins = [
        ...(process.env.NEXT_PUBLIC_BETTER_AUTH_ADMIN_IDS || "").split(","),
        ...(process.env.BETTER_AUTH_ADMIN_IDS || "").split(","),
    ]
        .map((value) => value.trim())
        .filter(Boolean);

    return typeof id === "string" && admins.includes(id);
}

/**
 * Whether a user is staff.
 *
 * Takes the user record from the session, so the platform role and the
 * configured admin list are the only inputs.
 */
export function isStaffUser(user: unknown): boolean {
    const candidate = (user ?? {}) as {
        role?: string | null;
        id?: string | null;
    };
    return isStaffRole(candidate.role) || isConfiguredAdminId(candidate.id);
}
