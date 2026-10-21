-- 0030 Remember the Second Life account that sold an item.
--
-- The scraper already reads the seller's avatar name off the item page
-- and the API accepted it, but the insert dropped it. Without it there is
-- no way to tell whose products are whose, which is what a creator's page
-- is built from.

ALTER TABLE "sl_mp_items"
  ADD COLUMN IF NOT EXISTS "sold_by" text;

-- Backfill what is already known: the store name is the closest thing
-- for items scraped before this column existed.
UPDATE "sl_mp_items"
SET "sold_by" = "creator"->>'name'
WHERE "sold_by" IS NULL
  AND "creator"->>'name' IS NOT NULL;

CREATE INDEX IF NOT EXISTS "sl_mp_items_sold_by_idx"
  ON "sl_mp_items" ("sold_by");
