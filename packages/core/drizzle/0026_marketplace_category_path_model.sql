-- 0026 Marketplace categories: the path model
--
-- Replaces the fixed level columns (primary, sub, sub2..sub5) with a single
-- `path text[]` column holding the full path from the root.
--
-- Why: the depth of the tree is a product decision, not a schema fact. The
-- marketplace's own tree is four levels deep and a category here can subdivide
-- past that. With one column per level, every extra level is a migration, and
-- moving or renaming a node is an N-column rewrite instead of one. With a
-- path, the depth is data.
--
-- The old unique index could never fire: it spanned org_id and team_id, which
-- are NULL on these rows, and Postgres treats NULLs as distinct in a unique
-- index. The new index is NULLS NOT DISTINCT so it actually constrains.

ALTER TABLE "sl_mp_categories"
  ADD COLUMN IF NOT EXISTS "path" text[] NOT NULL DEFAULT '{}'::text[];

-- Backfill from the level columns, dropping the 'All' padding sentinel.
UPDATE "sl_mp_categories" SET "path" = COALESCE((
  SELECT array_agg(s ORDER BY ord)
  FROM unnest(ARRAY["primary","sub","sub2","sub3","sub4","sub5"])
       WITH ORDINALITY AS t(s, ord)
  WHERE s IS NOT NULL AND s <> 'All'
), '{}'::text[]);

-- Merge rows that collapse onto the same path: move the item links onto the
-- keeper, then delete the emptied rows. Without this the unique index below
-- would fail to build.
DO $$
DECLARE
  rec RECORD;
  keeper UUID;
BEGIN
  FOR rec IN
    SELECT path, array_agg(id) AS ids
    FROM "sl_mp_categories"
    GROUP BY path
    HAVING count(*) > 1
  LOOP
    -- The keeper is the row with the most item links, then the oldest.
    SELECT c.id INTO keeper
    FROM "sl_mp_categories" c
    WHERE c.id = ANY(rec.ids)
    ORDER BY (
      SELECT count(*) FROM "sl_mp_item_categories" ic WHERE ic.category_id = c.id
    ) DESC, c.created_at ASC, c.id ASC
    LIMIT 1;

    -- Drop links that would collide with a link the keeper already has.
    DELETE FROM "sl_mp_item_categories" ic
    USING "sl_mp_item_categories" kl
    WHERE ic.category_id = ANY(rec.ids)
      AND ic.category_id <> keeper
      AND kl.item_id = ic.item_id
      AND kl.category_id = keeper;

    UPDATE "sl_mp_item_categories" ic
    SET category_id = keeper
    WHERE ic.category_id = ANY(rec.ids)
      AND ic.category_id <> keeper;

    DELETE FROM "sl_mp_categories"
    WHERE id = ANY(rec.ids) AND id <> keeper;
  END LOOP;
END $$;

-- Drop item links whose category no longer exists.
DELETE FROM "sl_mp_item_categories" ic
WHERE NOT EXISTS (
  SELECT 1 FROM "sl_mp_categories" c WHERE c.id = ic.category_id
);

-- Rebuild uniqueness so the constraint actually fires.
DROP INDEX IF EXISTS "sl_mp_categories_uniq";
CREATE UNIQUE INDEX "sl_mp_categories_uniq"
  ON "sl_mp_categories" ("path", "org_id", "team_id", "owner_user_id")
  NULLS NOT DISTINCT;

-- The level columns are no longer used.
ALTER TABLE "sl_mp_categories" DROP COLUMN IF EXISTS "primary";
ALTER TABLE "sl_mp_categories" DROP COLUMN IF EXISTS "sub";
ALTER TABLE "sl_mp_categories" DROP COLUMN IF EXISTS "sub2";
ALTER TABLE "sl_mp_categories" DROP COLUMN IF EXISTS "sub3";
ALTER TABLE "sl_mp_categories" DROP COLUMN IF EXISTS "sub4";
ALTER TABLE "sl_mp_categories" DROP COLUMN IF EXISTS "sub5";
