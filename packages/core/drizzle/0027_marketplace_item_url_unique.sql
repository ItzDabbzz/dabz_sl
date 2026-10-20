-- 0027 Marketplace item URL uniqueness
--
-- The unique index on the item URL spans org_id and team_id, which are NULL
-- on every one of these rows, and Postgres treats NULLs as distinct in a
-- unique index. The constraint therefore never fired: importing the same
-- file twice minted a second row for every item rather than updating the
-- one that was already there.
--
-- NULLS NOT DISTINCT makes the index apply to rows with a null scope, so a
-- URL can only be imported once.

DROP INDEX IF EXISTS "sl_mp_items_url_uniq";

CREATE UNIQUE INDEX "sl_mp_items_url_uniq"
  ON "sl_mp_items" ("url", "org_id", "team_id", "owner_user_id")
  NULLS NOT DISTINCT;
