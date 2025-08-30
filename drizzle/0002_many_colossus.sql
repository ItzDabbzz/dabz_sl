ALTER TABLE "api_key" RENAME TO "apiKey";--> statement-breakpoint
ALTER TABLE "apiKey" DROP CONSTRAINT "api_key_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "apiKey" ADD CONSTRAINT "apiKey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;