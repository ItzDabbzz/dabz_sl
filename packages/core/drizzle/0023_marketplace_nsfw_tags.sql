ALTER TABLE "sl_mp_items"
ADD COLUMN IF NOT EXISTS "is_nsfw" boolean DEFAULT false NOT NULL;
