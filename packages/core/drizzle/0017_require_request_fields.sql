-- Enforce required fields for marketplace item requests
ALTER TABLE "sl_mp_item_requests" ALTER COLUMN "creator" SET NOT NULL;
ALTER TABLE "sl_mp_item_requests" ALTER COLUMN "permissions" SET NOT NULL;
ALTER TABLE "sl_mp_item_requests" ALTER COLUMN "category_ids" SET NOT NULL;

-- Validate creator has non-empty name and link
ALTER TABLE "sl_mp_item_requests"
  ADD CONSTRAINT "sl_mp_item_requests_creator_chk"
  CHECK (
    jsonb_typeof("creator") = 'object'
    AND ("creator" ? 'name')
    AND length(btrim("creator"->>'name')) > 0
    AND ("creator" ? 'link')
    AND length(btrim("creator"->>'link')) > 0
  );

-- Validate permissions object has non-empty copy/modify/transfer
ALTER TABLE "sl_mp_item_requests"
  ADD CONSTRAINT "sl_mp_item_requests_permissions_chk"
  CHECK (
    jsonb_typeof("permissions") = 'object'
    AND ("permissions" ? 'copy')
    AND length(btrim("permissions"->>'copy')) > 0
    AND ("permissions" ? 'modify')
    AND length(btrim("permissions"->>'modify')) > 0
    AND ("permissions" ? 'transfer')
    AND length(btrim("permissions"->>'transfer')) > 0
  );

-- Validate category_ids is a non-empty array
ALTER TABLE "sl_mp_item_requests"
  ADD CONSTRAINT "sl_mp_item_requests_category_ids_chk"
  CHECK (
    jsonb_typeof("category_ids") = 'array'
    AND jsonb_array_length("category_ids") > 0
  );
