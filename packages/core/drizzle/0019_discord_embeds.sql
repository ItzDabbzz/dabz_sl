CREATE TABLE "sl_discord_embed_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"name" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sl_discord_embed_presets_scope_idx" ON "sl_discord_embed_presets" ("scope_type","scope_id");
--> statement-breakpoint
CREATE TABLE "sl_discord_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"name" text NOT NULL,
	"webhook_url" text NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sl_discord_channels_scope_idx" ON "sl_discord_channels" ("scope_type","scope_id");
