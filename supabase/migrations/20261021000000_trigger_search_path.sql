-- Pin search_path on the two trigger functions (Supabase lint 0011).
-- Neither body references a table, so an empty path is enough: now() and
-- tg_table_name resolve through pg_catalog, which is always searched.
alter function forbid_mutation()  set search_path = '';
alter function touch_updated_at() set search_path = '';
