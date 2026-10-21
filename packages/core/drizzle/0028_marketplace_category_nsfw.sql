-- 0028 Marketplace categories: an NSFW flag
--
-- A category can be marked as holding adult material. The public
-- marketplace hides those categories - and the items inside them - unless
-- the visitor asks for them, which is the same rule the items themselves
-- already follow.
--
-- The flag lives on the row, not on the path, so renaming or moving a
-- category keeps its flag, and marking a parent covers everything beneath
-- it without touching the children.

ALTER TABLE "sl_mp_categories"
  ADD COLUMN IF NOT EXISTS "is_nsfw" boolean NOT NULL DEFAULT false;

-- A parent that is marked covers its whole branch.
UPDATE "sl_mp_categories" c
SET "is_nsfw" = true
WHERE c."is_nsfw" = false
  AND EXISTS (
    SELECT 1
    FROM "sl_mp_categories" p
    WHERE p."is_nsfw" = true
      AND c."path"[1:array_length(p."path", 1)] = p."path"
  );
