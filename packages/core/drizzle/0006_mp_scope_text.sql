-- Convert marketplace scope columns from uuid to text to match Better Auth IDs

-- sl_mp_categories
ALTER TABLE "sl_mp_categories"
  ALTER COLUMN "owner_user_id" TYPE text USING "owner_user_id"::text,
  ALTER COLUMN "org_id" TYPE text USING "org_id"::text,
  ALTER COLUMN "team_id" TYPE text USING "team_id"::text;

-- sl_mp_items
ALTER TABLE "sl_mp_items"
  ALTER COLUMN "owner_user_id" TYPE text USING "owner_user_id"::text,
  ALTER COLUMN "org_id" TYPE text USING "org_id"::text,
  ALTER COLUMN "team_id" TYPE text USING "team_id"::text;
