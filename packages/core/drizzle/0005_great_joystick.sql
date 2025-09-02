CREATE TABLE "sl_webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid,
	"target_url" text NOT NULL,
	"event" text NOT NULL,
	"request_json" jsonb NOT NULL,
	"response_status" integer,
	"response_body" text,
	"error" text,
	"signature" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sl_entitlements" ALTER COLUMN "owner_sl_uuid" SET DATA TYPE uuid USING "owner_sl_uuid"::uuid;--> statement-breakpoint
CREATE INDEX "sl_webhook_deliveries_webhook_idx" ON "sl_webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "sl_webhook_deliveries_created_idx" ON "sl_webhook_deliveries" USING btree ("created_at");