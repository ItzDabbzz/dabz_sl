CREATE TABLE "blog_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_post_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"content_md" text NOT NULL,
	"author_user_id" text,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "blog_categories_slug_uniq" ON "blog_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_categories_created_idx" ON "blog_categories" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_categories_uniq" ON "blog_post_categories" USING btree ("post_id","category_id");--> statement-breakpoint
CREATE INDEX "blog_post_categories_post_idx" ON "blog_post_categories" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "blog_post_categories_category_idx" ON "blog_post_categories" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_uniq" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_posts_published_idx" ON "blog_posts" USING btree ("published","published_at");--> statement-breakpoint
CREATE INDEX "blog_posts_created_idx" ON "blog_posts" USING btree ("created_at");