-- Run in Supabase → SQL Editor (Honey Well health checks)
-- 1) Storage buckets — names must match app code: "products", "pickup-proofs"
select id, name, public
from storage.buckets
order by name;

-- 2) Realtime — shop needs "products"; tracking needs "admin_location"
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
order by tablename;
