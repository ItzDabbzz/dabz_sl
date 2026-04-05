import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/organization/access";

// Extend with your own resources/actions as needed
const statement = {
  ...defaultStatements,
  team: ["create", "update", "delete"], // Add team permissions
  // Add more custom resources/actions here
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  ...adminAc.statements,
  team: ["create", "update", "delete"],
  // Add more permissions for owner if needed
});

export const admin = ac.newRole({
  ...adminAc.statements,
  team: ["create", "update", "delete"],
  // Add more permissions for admin if needed
});

export const member = ac.newRole({
  // Members can only read teams by default
  team: [],
});

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

export function canViewCategory(visibility: CategoryVisibility | null | undefined, viewer: ViewerContext): boolean {
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
