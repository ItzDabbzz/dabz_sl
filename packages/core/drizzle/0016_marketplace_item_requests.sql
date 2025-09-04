-- Create table for public marketplace item requests
CREATE TABLE IF NOT EXISTS "sl_mp_item_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "requested_by_user_id" text,
  "requester_email" text,
  "url" text NOT NULL,
  "title" text NOT NULL,
  "version" text,
  "images" jsonb,
  "price" text NOT NULL,
  "creator" jsonb,
  "store" text NOT NULL,
  "permissions" jsonb,
  "description" text NOT NULL,
  "features" jsonb,
  "contents" jsonb,
  "updated_on" text,
  "category_ids" jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "approved_by_user_id" text,
  "rejected_by_user_id" text,
  "reject_reason" text,
  "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sl_mp_item_requests_status_idx" ON "sl_mp_item_requests" ("status");
CREATE INDEX IF NOT EXISTS "sl_mp_item_requests_requested_by_idx" ON "sl_mp_item_requests" ("requested_by_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sl_mp_item_requests_url_uniq" ON "sl_mp_item_requests" ("url");
