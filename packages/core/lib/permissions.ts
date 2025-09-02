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
  // Add more permissions for member if needed
});

// Example: custom role
export const myCustomRole = ac.newRole({
  team: ["create", "update"],
  // Add more permissions for this custom role
});
