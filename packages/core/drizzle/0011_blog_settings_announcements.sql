CREATE TABLE IF NOT EXISTS "blog_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "hero_category_id" uuid,
  "featured_category_id" uuid,
  "seo_title_suffix" text,
  "seo_default_description" text,
  "seo_og_image_url" text,
  "enable_ratings_summary" boolean NOT NULL DEFAULT true,
  "enable_email_on_publish" boolean NOT NULL DEFAULT false,
  "email_template_subject" text,
  "email_template_html" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_settings_created_idx" ON "blog_settings" USING btree ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_post_announcements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL,
  "sent_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blog_post_announcements_post_uniq" ON "blog_post_announcements" USING btree ("post_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_post_announcements_post_idx" ON "blog_post_announcements" USING btree ("post_id");
