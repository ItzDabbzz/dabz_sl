-- 0031 Keep a record of a claim that was turned down.
--
-- A staff member can refuse a creator's claim on a Second Life account.
-- Deleting the row lost the decision and left the creator with nothing
-- but a missing account, so a refusal is now kept: when it happened and
-- why. The claim keeps its row so the creator can read the reason and
-- try again with a fresh code.

ALTER TABLE "creator_sl_accounts"
  ADD COLUMN IF NOT EXISTS "rejected_at" timestamp with time zone;

ALTER TABLE "creator_sl_accounts"
  ADD COLUMN IF NOT EXISTS "rejection_reason" text;
