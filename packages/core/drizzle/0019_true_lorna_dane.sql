CREATE TABLE "sl_webhook_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"events" jsonb NOT NULL,
	"config_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "sl_mp_categories_uniq";--> statement-breakpoint
ALTER TABLE "sl_mp_categories" ADD COLUMN "sub2" text DEFAULT 'All' NOT NULL;--> statement-breakpoint
ALTER TABLE "sl_webhook_deliveries" ADD COLUMN "destination_id" uuid;--> statement-breakpoint
ALTER TABLE "sl_webhook_deliveries" ADD COLUMN "transport" text;--> statement-breakpoint
CREATE INDEX "sl_webhook_destinations_webhook_idx" ON "sl_webhook_destinations" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "sl_webhook_destinations_enabled_idx" ON "sl_webhook_destinations" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "sl_webhook_deliveries_destination_idx" ON "sl_webhook_deliveries" USING btree ("destination_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sl_mp_categories_uniq" ON "sl_mp_categories" USING btree ("primary","sub","sub2","org_id","team_id","owner_user_id");