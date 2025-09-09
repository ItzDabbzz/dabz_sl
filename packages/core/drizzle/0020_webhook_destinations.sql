-- Add transport + destination reference to deliveries
ALTER TABLE "sl_webhook_deliveries" ADD COLUMN IF NOT EXISTS "destination_id" uuid;
ALTER TABLE "sl_webhook_deliveries" ADD COLUMN IF NOT EXISTS "transport" text;
CREATE INDEX IF NOT EXISTS "sl_webhook_deliveries_destination_idx" ON "sl_webhook_deliveries" ("destination_id");

-- Create webhook destinations table
CREATE TABLE IF NOT EXISTS "sl_webhook_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"events" jsonb NOT NULL,
	"config_json" jsonb NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "sl_webhook_destinations_webhook_idx" ON "sl_webhook_destinations" ("webhook_id");
CREATE INDEX IF NOT EXISTS "sl_webhook_destinations_enabled_idx" ON "sl_webhook_destinations" ("enabled");
