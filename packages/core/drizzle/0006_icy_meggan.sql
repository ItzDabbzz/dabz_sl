CREATE TABLE "sl_mp_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"org_id" uuid,
	"team_id" uuid,
	"primary" text NOT NULL,
	"sub" text DEFAULT 'All' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sl_mp_item_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sl_mp_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"org_id" uuid,
	"team_id" uuid,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"version" text,
	"images" jsonb,
	"price" text,
	"creator" jsonb,
	"store" text,
	"permissions" jsonb,
	"description" text,
	"features" jsonb,
	"contents" jsonb,
	"updated_on" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sl_mp_categories_scope_idx" ON "sl_mp_categories" USING btree ("org_id","team_id","owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sl_mp_categories_uniq" ON "sl_mp_categories" USING btree ("primary","sub","org_id","team_id","owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sl_mp_item_categories_uniq" ON "sl_mp_item_categories" USING btree ("item_id","category_id");--> statement-breakpoint
CREATE INDEX "sl_mp_item_categories_item_idx" ON "sl_mp_item_categories" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "sl_mp_item_categories_category_idx" ON "sl_mp_item_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "sl_mp_items_scope_idx" ON "sl_mp_items" USING btree ("org_id","team_id","owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sl_mp_items_url_uniq" ON "sl_mp_items" USING btree ("url","org_id","team_id","owner_user_id");