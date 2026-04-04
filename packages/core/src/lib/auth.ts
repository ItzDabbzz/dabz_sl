import { betterAuth } from "better-auth";
import {
    bearer,
    admin,
    multiSession,
    organization,
    twoFactor,
    oneTap,
    oAuthProxy,
    openAPI,
    customSession,
    apiKey,
    haveIBeenPwned,
} from "better-auth/plugins";
import {
    ac,
    owner,
    admin as adminRole,
    member,
    myCustomRole,
} from "./permissions";
import { reactInvitationEmail } from "./email/invitation";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { reactResetPasswordEmail } from "./email/reset-password";
import { resend } from "./email/resend";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "better-auth/plugins/passkey";
import { db } from "./db";
import {
    user,
    session,
    account,
    verification,
    organization as orgSchema,
    member as memberSchema,
    invitation,
    twoFactor as tfSchema,
    passkey as passSchema,
    apiKey as apiKeySchema,
    team,
    teamMember,
} from "../schemas/auth-schema";

const from = process.env.BETTER_AUTH_EMAIL || "delivered@resend.dev";
const to = process.env.TEST_EMAIL || "";

const baseURL: string | undefined =
    process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

// Build trusted origins from baseURL to avoid hard-coding domains
const defaultTrusted = ["exp://", "https://www.sanctumrp.net", "https://sl.sanctumrp.net", "http://localhost:3000"] as string[];
const computedTrusted = [...defaultTrusted];
try {
    if (baseURL) {
        const origin = new URL(baseURL).origin;
        if (origin && !computedTrusted.includes(origin)) {
            computedTrusted.push(origin);
        }
    }
} catch {}

const cookieDomain: string | undefined = process.env.COOKIE_DOMAIN || undefined;

import {
    adminAccessControl,
    ownerAdminRole,
    developerAdminRole,
    adminAdminRole,
    modAdminRole,
    trustedAdminRole,
    creatorAdminRole,
    userAdminRole,
} from "./admin-access";

export const auth = betterAuth({
    appName: "Sanctum Realms Project",
    baseURL,
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: user,
            session: session,
            account: account,
            verification: verification,
            organization: orgSchema,
            member: memberSchema,
            invitation: invitation,
            twoFactor: tfSchema,
            passkey: passSchema,
            apikey: apiKeySchema, // Note: lowercase 'apikey' as expected by better-auth
            team: team,
            teamMember: teamMember,
        },
    }),
    emailVerification: {
        async sendVerificationEmail({ user, url }) {
            const res = await resend.emails.send({
                from,
                to: to || user.email,
                subject: "Verify your email address",
                html: `<a href="${url}">Verify your email address</a>`,
            });
            console.log(res, user.email);
        },
    },
    account: {
        accountLinking: {
            trustedProviders: ["google", "github", "discord"],
        },
    },
    emailAndPassword: {
        enabled: true,
        async sendResetPassword({ user, url }) {
            await resend.emails.send({
                from,
                to: user.email,
                subject: "Reset your password",
                react: reactResetPasswordEmail({
                    username: user.email,
                    resetLink: url,
                }),
            });
        },
    },
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID || "",
            clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
        },
        google: {
            clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        },
        discord: {
            clientId: process.env.DISCORD_CLIENT_ID || "",
            clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
        },
    },
    plugins: [
        organization({
            ac,
            roles: {
                owner,
                admin: adminRole,
                member,
                myCustomRole,
            },
            teams: {
                enabled: true,
                maximumTeams: 10,
                allowRemovingAllTeams: false,
            },
            async sendInvitationEmail(data) {
                await resend.emails.send({
                    from,
                    to: data.email,
                    subject: "You've been invited to join an organization",
                    react: reactInvitationEmail({
                        username: data.email,
                        invitedByUsername: data.inviter.user.name,
                        invitedByEmail: data.inviter.user.email,
                        teamName: data.organization.name,
                        inviteLink:
                            process.env.NODE_ENV === "development"
                                ? `http://localhost:3000/accept-invitation/${data.id}`
                                : `${
                                      process.env.BETTER_AUTH_URL ||
                                      "https://sanctumrp.net"
                                  }/accept-invitation/${data.id}`,
                    }),
                });
            },
        }),
        twoFactor({
            otpOptions: {
                async sendOTP({ user, otp }) {
                    await resend.emails.send({
                        from,
                        to: user.email,
                        subject: "Your OTP",
                        html: `Your OTP is ${otp}`,
                    });
                },
            },
        }),
        passkey(),
        openAPI({
            disableDefaultReference: false,
        }),
        bearer(),
        admin({
            adminUserIds: (
                process.env.BETTER_AUTH_ADMIN_IDS ||
                "LgLi3oZ55MaSZGMsBndarJZSjMTw6FKR"
            )
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            // Map our desired roles to the Admin plugin
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
            adminRoles: ["owner", "developer", "admin"],
            defaultRole: "user",
        }),
        multiSession(),
        oAuthProxy(),
        nextCookies(),
        apiKey(),
        oneTap(),
        haveIBeenPwned(),
        customSession(async (session) => {
            return {
                ...session,
                user: {
                    ...session.user,
                    dd: "test",
                },
            };
        }),
    ],
    trustedOrigins: computedTrusted,
    advanced: {
        crossSubDomainCookies: {
            enabled: process.env.NODE_ENV === "production",
            domain: cookieDomain,
        },
    },
});
