-- 0025 Marketplace category deep levels (sub3..sub5) + unique index rebuild
-- Adds three more hierarchy levels so a category path can be as deep as the
-- marketplace's own four-level tree (Apparel > Women's > Women's Footwear >
-- Women's Boots) and go further. Every level defaults to 'All', so existing
-- rows are unaffected and the tree simply gains three empty levels.

ALTER TABLE "sl_mp_categories"
  ADD COLUMN IF NOT EXISTS "sub3" text DEFAULT 'All' NOT NULL,
  ADD COLUMN IF NOT EXISTS "sub4" text DEFAULT 'All' NOT NULL,
  ADD COLUMN IF NOT EXISTS "sub5" text DEFAULT 'All' NOT NULL;

-- Drop the old unique index if it exists
DO $$ BEGIN
  DROP INDEX IF EXISTS "sl_mp_categories_uniq";
EXCEPTION WHEN undefined_object THEN
  -- ignore
END $$;

-- Rebuild uniqueness across the whole path.
--
-- NOTE: org_id and team_id are NULL for these rows, and Postgres treats NULLs
-- as distinct in a unique index, so this index cannot actually prevent a
-- duplicate path. The application resolves a path before inserting; this
-- index is a backstop for rows that do carry a scope.
CREATE UNIQUE INDEX IF NOT EXISTS "sl_mp_categories_uniq"
  ON "sl_mp_categories"
  ("primary", "sub", "sub2", "sub3", "sub4", "sub5", "org_id", "team_id", "owner_user_id");

-- Backfill any NULL / empty values just in case
UPDATE "sl_mp_categories" SET
  "sub"  = 'All' WHERE "sub"  IS NULL OR length(trim("sub"))  = 0,
  "sub2" = 'All' WHERE "sub2" IS NULL OR length(trim("sub2")) = 0,
  "sub3" = 'All' WHERE "sub3" IS NULL OR length(trim("sub3")) = 0,
  "sub4" = 'All' WHERE "sub4" IS NULL OR length(trim("sub4")) = 0,
  "sub5" = 'All' WHERE "sub5" IS NULL OR length(trim("sub5")) = 0;
