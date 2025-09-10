-- Functional index to speed up case-insensitive search on creator name (author filtering)
create index if not exists sl_mp_items_creator_name_lower_idx on sl_mp_items ((lower(creator->>'name')));
