-- RBAC core tables
CREATE TABLE IF NOT EXISTS rbac_permissions (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text,
  description text,
  area text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rbac_roles (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rbac_roles_org_slug_unique ON rbac_roles (organization_id, slug);

CREATE TABLE IF NOT EXISTS rbac_role_permissions (
  id text PRIMARY KEY,
  role_id text NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES rbac_permissions(key) ON DELETE CASCADE,
  effect text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rbac_role_permissions_unique ON rbac_role_permissions (role_id, permission_key);

CREATE TABLE IF NOT EXISTS rbac_member_roles (
  id text PRIMARY KEY,
  member_id text NOT NULL REFERENCES "member"(id) ON DELETE CASCADE,
  organization_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  role_id text NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rbac_member_role_unique ON rbac_member_roles (member_id, role_id);

CREATE TABLE IF NOT EXISTS rbac_user_permission_overrides (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  organization_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES rbac_permissions(key) ON DELETE CASCADE,
  effect text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rbac_user_override_unique ON rbac_user_permission_overrides (user_id, organization_id, permission_key);

-- Seed permission keys (use key as id to avoid extension requirements)
INSERT INTO rbac_permissions (id, key, label, description, area, created_at) VALUES
  ('org.view','org.view', 'View Organization', 'View organization basics', 'org', now()),
  ('org.delete','org.delete', 'Delete Organization', 'Delete organization', 'org', now()),
  ('dashboard.view','dashboard.view', 'View Dashboard', 'Access dashboard overview', 'core', now()),
  ('settings.view','settings.view', 'View Settings', 'Access personal/org settings', 'core', now()),
  ('apikey.manage','apikey.manage', 'Manage API Keys', 'Create and manage API keys', 'core', now()),
  ('marketplace.view','marketplace.view', 'View Marketplace', 'View marketplace dashboard', 'mp', now()),
  ('marketplace.edit','marketplace.edit', 'Edit Marketplace', 'Edit marketplace items and categories', 'mp', now()),
  ('marketplace.moderate','marketplace.moderate', 'Moderate Marketplace', 'Moderation capabilities', 'mp', now()),
  ('marketplace.admin','marketplace.admin', 'Marketplace Admin', 'Administrative actions for marketplace', 'mp', now()),
  ('sldb.view','sldb.view', 'View SLDB', 'View Second Life DB', 'sldb', now()),
  ('sldb.edit','sldb.edit', 'Edit SLDB', 'Edit Second Life DB', 'sldb', now()),
  ('sldb.admin','sldb.admin', 'SLDB Admin', 'Administrative actions for SLDB', 'sldb', now()),
  ('blog.view','blog.view', 'View Blog', 'Read blog content', 'blog', now()),
  ('blog.write','blog.write', 'Write Blog', 'Create and edit posts', 'blog', now()),
  ('blog.settings.update','blog.settings.update', 'Update Blog Settings', 'Modify blog settings', 'blog', now()),
  ('wardrobe.view','wardrobe.view', 'View Wardrobe', 'View wardrobe', 'wardrobe', now()),
  ('wardrobe.edit','wardrobe.edit', 'Edit Wardrobe', 'Edit wardrobe content', 'wardrobe', now()),
  ('rbac.manage','rbac.manage', 'Manage Permissions', 'Manage roles, grants, and overrides', 'security', now())
ON CONFLICT (key) DO NOTHING;
