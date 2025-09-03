-- Add visibility column to blog_categories for flexible access control
ALTER TABLE "blog_categories" ADD COLUMN IF NOT EXISTS "visibility" jsonb;

-- Optional index to query restricted categories faster by keys
CREATE INDEX IF NOT EXISTS "blog_categories_visibility_idx" ON "blog_categories" USING gin ((visibility));
