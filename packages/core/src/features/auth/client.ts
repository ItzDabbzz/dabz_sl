import { createAuthClient } from "better-auth/react";
import {
    organizationClient,
    twoFactorClient,
    adminClient,
    multiSessionClient,
    oneTapClient,
    oidcClient,
    genericOAuthClient,
} from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { apiKeyClient } from "@better-auth/api-key/client";
import {
    ac,
    owner,
    admin as adminRole,
    member,
    myCustomRole,
} from "@/features/auth/permissions/access-control";
import { toast } from "sonner";
import {
    adminAccessControl,
    ownerAdminRole,
    developerAdminRole,
    adminAdminRole,
    modAdminRole,
    trustedAdminRole,
    creatorAdminRole,
    userAdminRole,
} from "@/features/auth/permissions/admin-access";

export const client = createAuthClient({
    plugins: [
        organizationClient({
            ac,
            roles: {
                owner,
                admin: adminRole,
                member,
                myCustomRole,
            },
            teams: {
                enabled: true,
            },
        }),
        twoFactorClient({
            onTwoFactorRedirect() {
                window.location.href = "/two-factor";
            },
        }),
        passkeyClient(),
        adminClient({
            ac: adminAccessControl,
            roles: {
                owner: ownerAdminRole,
                developer: developerAdminRole,
                admin: adminAdminRole,
                mod: modAdminRole,
                trusted: trustedAdminRole,
                creator: creatorAdminRole,
                user: userAdminRole,
            },
        }),
        multiSessionClient(),
        oneTapClient({
            clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
            promptOptions: {
                maxAttempts: 1,
            },
        }),
        oidcClient(),
        genericOAuthClient(),
        apiKeyClient(),
    ],
    fetchOptions: {
        onError(e) {
            if (e.error.status === 429) {
                toast.error("Too many requests. Please try again later.");
            }
        },
    },
});

export const {
    signUp,
    signIn,
    signOut,
    useSession,
    organization,
    useListOrganizations,
    useActiveOrganization,
} = client;
