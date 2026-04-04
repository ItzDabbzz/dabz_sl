import { pgTable, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false).notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
}, (tbl) => ({
  orgSlugUnique: uniqueIndex("rbac_roles_org_slug_unique").on(tbl.organizationId, tbl.slug),
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
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  permissionKey: text("permission_key").notNull().references(() => rbacPermissions.key, { onDelete: "cascade" }),
  effect: text("effect").notNull(), // "allow" | "deny"
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
}, (tbl) => ({
  userOverrideUnique: uniqueIndex("rbac_user_override_unique").on(tbl.userId, tbl.organizationId, tbl.permissionKey),
}));
