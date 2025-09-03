CREATE TABLE "blog_post_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" text,
	"score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "blog_post_ratings_post_idx" ON "blog_post_ratings" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "blog_post_ratings_user_idx" ON "blog_post_ratings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_ratings_post_user_uniq" ON "blog_post_ratings" USING btree ("post_id","user_id");