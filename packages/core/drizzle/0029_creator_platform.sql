-- 0029 The creator platform: platform-scoped permissions, creator
-- profiles, and blog ownership.
--
-- 1. Permissions get a scope. A role with no organization is a role of
--    the site itself; a role with one belongs to a creator team. The
--    staff screens manage the first kind, the organization settings
--    manage the second.
-- 2. Creator profiles give a person or a team a public page with their
--    posts, their products and the Second Life accounts they have proven
--    they own.
-- 3. A blog post can belong to a team as well as a person.

-- ── 1. Platform scope for permissions ──────────────────────────────────────

ALTER TABLE "rbac_roles"
  ALTER COLUMN "organization_id" DROP NOT NULL;

ALTER TABLE "rbac_roles"
  ADD COLUMN IF NOT EXISTS "scope" text NOT NULL DEFAULT 'organization';

-- Roles that already exist are organization roles.
UPDATE "rbac_roles" SET "scope" = 'organization' WHERE "organization_id" IS NOT NULL;
UPDATE "rbac_roles" SET "scope" = 'platform' WHERE "organization_id" IS NULL;

-- A platform role is named by its slug alone.
CREATE UNIQUE INDEX IF NOT EXISTS "rbac_roles_platform_slug_unique"
  ON "rbac_roles" (slug)
  WHERE "organization_id" IS NULL;

-- The platform roles a user holds.
CREATE TABLE IF NOT EXISTS "rbac_user_roles" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role_id" text NOT NULL REFERENCES "rbac_roles"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "rbac_user_role_unique"
  ON "rbac_user_roles" ("user_id", "role_id");
CREATE INDEX IF NOT EXISTS "rbac_user_roles_role_idx"
  ON "rbac_user_roles" ("role_id");

-- An override with no organization applies platform-wide.
ALTER TABLE "rbac_user_permission_overrides"
  ALTER COLUMN "organization_id" DROP NOT NULL;

-- The old unique index covered a NOT NULL column, so it is replaced by
-- one that also covers the platform case.
DROP INDEX IF EXISTS "rbac_user_override_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "rbac_user_override_unique"
  ON "rbac_user_permission_overrides" ("user_id", "organization_id", "permission_key");

-- ── 2. Creator profiles ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "creator_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_type" text NOT NULL,
  "owner_id" text NOT NULL,
  "slug" text NOT NULL,
  "display_name" text NOT NULL,
  "tagline" text,
  "bio" text,
  "avatar_url" text,
  "banner_url" text,
  "website_url" text,
  "locations" text,
  "published" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "creator_profiles_slug_uniq"
  ON "creator_profiles" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "creator_profiles_owner_uniq"
  ON "creator_profiles" ("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "creator_profiles_owner_idx"
  ON "creator_profiles" ("owner_type", "owner_id");

-- The Second Life accounts a creator has claimed, and whether they have
-- been proven.
CREATE TABLE IF NOT EXISTS "creator_sl_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL REFERENCES "creator_profiles"("id") ON DELETE CASCADE,
  "sl_account_name" text NOT NULL,
  "sl_account_uuid" text,
  "verified" boolean NOT NULL DEFAULT false,
  "verified_at" timestamptz,
  "verification_method" text,
  "verification_code" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "creator_sl_accounts_profile_name_uniq"
  ON "creator_sl_accounts" ("profile_id", "sl_account_name");
CREATE INDEX IF NOT EXISTS "creator_sl_accounts_profile_idx"
  ON "creator_sl_accounts" ("profile_id");
CREATE INDEX IF NOT EXISTS "creator_sl_accounts_uuid_idx"
  ON "creator_sl_accounts" ("sl_account_uuid");

-- The products a creator lists on their page.
CREATE TABLE IF NOT EXISTS "creator_profile_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL REFERENCES "creator_profiles"("id") ON DELETE CASCADE,
  "item_id" uuid NOT NULL,
  "featured" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "creator_profile_items_uniq"
  ON "creator_profile_items" ("profile_id", "item_id");
CREATE INDEX IF NOT EXISTS "creator_profile_items_profile_idx"
  ON "creator_profile_items" ("profile_id");
CREATE INDEX IF NOT EXISTS "creator_profile_items_item_idx"
  ON "creator_profile_items" ("item_id");

-- ── 3. A blog post can belong to a team ────────────────────────────────────

ALTER TABLE "blog_posts"
  ADD COLUMN IF NOT EXISTS "author_organization_id" text;

CREATE INDEX IF NOT EXISTS "blog_posts_author_idx"
  ON "blog_posts" ("author_user_id");
CREATE INDEX IF NOT EXISTS "blog_posts_author_org_idx"
  ON "blog_posts" ("author_organization_id");
