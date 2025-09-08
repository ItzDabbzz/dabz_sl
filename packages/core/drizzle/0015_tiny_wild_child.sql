CREATE TABLE "rbac_member_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text,
	"description" text,
	"area" text,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "rbac_permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "rbac_role_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"permission_key" text NOT NULL,
	"effect" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac_user_permission_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"permission_key" text NOT NULL,
	"effect" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sl_mp_item_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by_user_id" text,
	"requester_email" text,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"version" text,
	"images" jsonb,
	"price" text NOT NULL,
	"creator" jsonb NOT NULL,
	"store" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"description" text NOT NULL,
	"features" jsonb,
	"contents" jsonb,
	"updated_on" text,
	"category_ids" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by_user_id" text,
	"rejected_by_user_id" text,
	"reject_reason" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rbac_member_roles" ADD CONSTRAINT "rbac_member_roles_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_member_roles" ADD CONSTRAINT "rbac_member_roles_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_member_roles" ADD CONSTRAINT "rbac_member_roles_role_id_rbac_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."rbac_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_role_permissions" ADD CONSTRAINT "rbac_role_permissions_role_id_rbac_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."rbac_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_role_permissions" ADD CONSTRAINT "rbac_role_permissions_permission_key_rbac_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."rbac_permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_roles" ADD CONSTRAINT "rbac_roles_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_permission_overrides" ADD CONSTRAINT "rbac_user_permission_overrides_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_permission_overrides" ADD CONSTRAINT "rbac_user_permission_overrides_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_permission_overrides" ADD CONSTRAINT "rbac_user_permission_overrides_permission_key_rbac_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."rbac_permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rbac_member_role_unique" ON "rbac_member_roles" USING btree ("member_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rbac_role_permissions_unique" ON "rbac_role_permissions" USING btree ("role_id","permission_key");--> statement-breakpoint
CREATE UNIQUE INDEX "rbac_roles_org_slug_unique" ON "rbac_roles" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "rbac_user_override_unique" ON "rbac_user_permission_overrides" USING btree ("user_id","organization_id","permission_key");--> statement-breakpoint
CREATE INDEX "sl_mp_item_requests_status_idx" ON "sl_mp_item_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sl_mp_item_requests_requested_by_idx" ON "sl_mp_item_requests" USING btree ("requested_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sl_mp_item_requests_url_uniq" ON "sl_mp_item_requests" USING btree ("url");