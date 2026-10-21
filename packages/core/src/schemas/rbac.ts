import { pgTable, text, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, member, user } from "./auth-schema";

export const rbacPermissions = pgTable("rbac_permissions", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label"),
  description: text("description"),
  area: text("area"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
});

export const rbacRoles = pgTable("rbac_roles", {
  id: text("id").primaryKey(),
  /**
   * The organization the role belongs to.
   *
   * Null for a platform role: a role that belongs to nobody's team is a
   * role of the site itself, and it is what the staff screens manage.
   */
  organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
  /** "platform" or "organization". */
  scope: text("scope").default("organization").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false).notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
}, (tbl) => ({
  orgSlugUnique: uniqueIndex("rbac_roles_org_slug_unique").on(tbl.organizationId, tbl.slug),
  platformSlugUnique: uniqueIndex("rbac_roles_platform_slug_unique").on(tbl.slug).where(sql`${tbl.organizationId} is null`),
}));

export const rbacRolePermissions = pgTable("rbac_role_permissions", {
  id: text("id").primaryKey(),
  roleId: text("role_id").notNull().references(() => rbacRoles.id, { onDelete: "cascade" }),
  permissionKey: text("permission_key").notNull().references(() => rbacPermissions.key, { onDelete: "cascade" }),
  effect: text("effect").notNull(), // "allow" | "deny"
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
}, (tbl) => ({
  rolePermUnique: uniqueIndex("rbac_role_permissions_unique").on(tbl.roleId, tbl.permissionKey),
}));

export const rbacMemberRoles = pgTable("rbac_member_roles", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => member.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  roleId: text("role_id").notNull().references(() => rbacRoles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
}, (tbl) => ({
  memberRoleUnique: uniqueIndex("rbac_member_role_unique").on(tbl.memberId, tbl.roleId),
}));

export const rbacUserPermissionOverrides = pgTable("rbac_user_permission_overrides", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  /**
   * The organization the override applies in.
   *
   * Null for a platform override, which applies everywhere the user is
   * not already limited by an organization.
   */
  organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
  permissionKey: text("permission_key").notNull().references(() => rbacPermissions.key, { onDelete: "cascade" }),
  effect: text("effect").notNull(), // "allow" | "deny"
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
}, (tbl) => ({
  userOverrideUnique: uniqueIndex("rbac_user_override_unique").on(tbl.userId, tbl.organizationId, tbl.permissionKey),
}));

/**
 * The platform roles a user holds.
 *
 * Organization roles are held by a member of that organization
 * (`rbacMemberRoles`). A platform role belongs to the site, so it is
 * held by the user directly - this is the table the staff screens use.
 */
export const rbacUserRoles = pgTable("rbac_user_roles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  roleId: text("role_id").notNull().references(() => rbacRoles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
}, (tbl) => ({
  userRoleUnique: uniqueIndex("rbac_user_role_unique").on(tbl.userId, tbl.roleId),
  byRole: index("rbac_user_roles_role_idx").on(tbl.roleId),
}));
