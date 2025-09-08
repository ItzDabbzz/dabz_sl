CREATE TABLE "fertility_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"avatar_key" varchar(64) NOT NULL,
	"cycle_day" integer,
	"cycle_length" integer,
	"status" varchar(32),
	"ovulation_day" integer,
	"fertile_window_start" integer,
	"fertile_window_end" integer,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"avatar_key" varchar(64) NOT NULL,
	"linked" boolean,
	"partner_key" varchar(64),
	"shared_data" boolean,
	"permissions" jsonb,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pregnancy_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"avatar_key" varchar(64) NOT NULL,
	"pregnant" boolean,
	"conception_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"trimester" integer,
	"weeks" integer,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"avatar_key" varchar(64) NOT NULL,
	"fertility_enabled" boolean,
	"cycle_length" integer,
	"privacy_mode" varchar(32),
	"timestamp" timestamp with time zone DEFAULT now()
);
