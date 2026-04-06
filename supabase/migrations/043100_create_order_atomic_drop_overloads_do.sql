-- Ensure exactly ONE public.create_order_atomic (18 args incl. booking flag).
-- Part 1/3: drop all overloads.


do $drop_overloads$
declare
  r record;
begin
  for r in
    select pg_catalog.pg_get_function_identity_arguments(p.oid) as args
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_order_atomic'
  loop
    execute format('drop function if exists public.create_order_atomic(%s) cascade', r.args);
  end loop;
end
$drop_overloads$;
