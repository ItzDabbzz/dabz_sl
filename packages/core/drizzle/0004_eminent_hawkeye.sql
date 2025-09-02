CREATE TABLE "sl_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid,
	"scope_type" text NOT NULL,
	"scope_id" uuid,
	"event_type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sl_config_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"source_config_id" uuid NOT NULL,
	"label" text,
	"diff_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sl_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_sl_uuid" text NOT NULL,
	"master_object_id" uuid NOT NULL,
	"source" text NOT NULL,
	"proof_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sl_master_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_user_id" uuid,
	"org_id" uuid,
	"team_id" uuid,
	"current_version" integer DEFAULT 1 NOT NULL,
	"config_schema_json" jsonb,
	"default_config_json" jsonb,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sl_object_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"master_object_id" uuid NOT NULL,
	"owner_sl_uuid" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"instance_token_hash" text,
	"token_expires_at" timestamp with time zone,
	"token_version" integer DEFAULT 1 NOT NULL,
	"device_fingerprint" text,
	"region" text,
	"version" integer DEFAULT 1 NOT NULL,
	"active_config_id" uuid,
	"current_config_hash" text,
	"owner_user_id" uuid,
	"org_id" uuid,
	"team_id" uuid,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sl_object_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"master_object_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"changelog" text,
	"migration_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sl_user_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"version_tag" text,
	"config_json" jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sl_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"target_url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "sl_object" CASCADE;--> statement-breakpoint
CREATE INDEX "sl_audit_logs_created_idx" ON "sl_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sl_audit_logs_scope_idx" ON "sl_audit_logs" USING btree ("scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "sl_config_snapshots_instance_idx" ON "sl_config_snapshots" USING btree ("instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sl_entitlements_owner_master_uniq" ON "sl_entitlements" USING btree ("owner_sl_uuid","master_object_id");--> statement-breakpoint
CREATE INDEX "sl_master_objects_owner_idx" ON "sl_master_objects" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "sl_master_objects_org_idx" ON "sl_master_objects" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sl_master_objects_team_idx" ON "sl_master_objects" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "sl_object_instances_master_idx" ON "sl_object_instances" USING btree ("master_object_id");--> statement-breakpoint
CREATE INDEX "sl_object_instances_owner_idx" ON "sl_object_instances" USING btree ("owner_sl_uuid");--> statement-breakpoint
CREATE INDEX "sl_object_instances_scope_idx" ON "sl_object_instances" USING btree ("org_id","team_id","owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sl_object_instances_owner_master_uniq" ON "sl_object_instances" USING btree ("owner_sl_uuid","master_object_id");--> statement-breakpoint
CREATE INDEX "sl_object_versions_master_idx" ON "sl_object_versions" USING btree ("master_object_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sl_object_versions_master_version_uniq" ON "sl_object_versions" USING btree ("master_object_id","version");--> statement-breakpoint
CREATE INDEX "sl_user_configs_instance_idx" ON "sl_user_configs" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "sl_user_configs_instance_created_idx" ON "sl_user_configs" USING btree ("instance_id","created_at");--> statement-breakpoint
CREATE INDEX "sl_webhooks_scope_idx" ON "sl_webhooks" USING btree ("scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "sl_webhooks_active_idx" ON "sl_webhooks" USING btree ("active");