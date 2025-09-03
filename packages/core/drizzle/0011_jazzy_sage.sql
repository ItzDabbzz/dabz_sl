CREATE TABLE "blog_post_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hero_category_id" uuid,
	"featured_category_id" uuid,
	"seo_title_suffix" text,
	"seo_default_description" text,
	"seo_og_image_url" text,
	"enable_ratings_summary" boolean DEFAULT true NOT NULL,
	"enable_email_on_publish" boolean DEFAULT false NOT NULL,
	"email_template_subject" text,
	"email_template_html" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_announcements_post_uniq" ON "blog_post_announcements" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "blog_post_announcements_post_idx" ON "blog_post_announcements" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "blog_settings_created_idx" ON "blog_settings" USING btree ("created_at");