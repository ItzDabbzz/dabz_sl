-- 0021 Marketplace category third-level (sub2) + backfill
-- Adds sub2 column with default 'All' and updates unique index.

ALTER TABLE "sl_mp_categories" ADD COLUMN IF NOT EXISTS "sub2" text DEFAULT 'All' NOT NULL;

-- Drop old unique index if exists
DO $$ BEGIN
  DROP INDEX IF EXISTS "sl_mp_categories_uniq";
EXCEPTION WHEN undefined_object THEN
  -- ignore
END $$;

-- Create new unique index including sub2
CREATE UNIQUE INDEX IF NOT EXISTS "sl_mp_categories_uniq" ON "sl_mp_categories" ("primary", "sub", "sub2", "org_id", "team_id", "owner_user_id");

-- Backfill existing NULL / empty values just in case
UPDATE "sl_mp_categories" SET "sub2" = 'All' WHERE "sub2" IS NULL OR length(trim("sub2")) = 0;
