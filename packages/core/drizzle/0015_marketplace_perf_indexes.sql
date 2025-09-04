-- Marketplace performance indexes
CREATE INDEX IF NOT EXISTS "sl_mp_items_owner_created_idx" ON "sl_mp_items" USING btree ("owner_user_id","created_at");
CREATE INDEX IF NOT EXISTS "sl_mp_items_rating_idx" ON "sl_mp_items" USING btree ("rating_count","rating_avg");
-- Note: sl_mp_item_categories already has indexes on (item_id) and (category_id) from initial creation
