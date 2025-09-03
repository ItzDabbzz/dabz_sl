import { createAccessControl } from "better-auth/plugins/access";

// Explicit Admin statements for strong typing
const adminStatements = {
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
} as const;

export const adminAccessControl = createAccessControl(adminStatements);

// Full permissions (use mutable arrays via spread to satisfy SubArray typing)
export const ownerAdminRole = adminAccessControl.newRole({
    user: [...adminStatements.user],
    session: [...adminStatements.session],
});
export const developerAdminRole = adminAccessControl.newRole({
    user: [...adminStatements.user],
    session: [...adminStatements.session],
});
export const adminAdminRole = adminAccessControl.newRole({
    user: [...adminStatements.user],
    session: [...adminStatements.session],
});

// Moderator: cannot create users, delete users, or set passwords
export const modAdminRole = adminAccessControl.newRole({
    user: ["list", "set-role", "ban", "impersonate"],
    session: ["list", "revoke", "delete"],
});

// Trusted/Creator: limited visibility (list only)
export const trustedAdminRole = adminAccessControl.newRole({
    user: ["list"],
    session: ["list"],
});
export const creatorAdminRole = adminAccessControl.newRole({
    user: ["list"],
    session: ["list"],
});

type AdminResources = keyof typeof adminStatements; // "user" | "session"

// Default user: no admin permissions
export const userAdminRole = adminAccessControl.newRole({
    user: [],
    session: [],
});
