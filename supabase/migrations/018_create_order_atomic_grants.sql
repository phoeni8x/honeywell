-- Ensure the 17-arg create_order_atomic (Revolut delivery timing) is executable by API roles.
-- Safe to re-run if grants were missing after a partial deploy.
grant execute on function public.create_order_atomic(
  text, uuid, int, text, text,
  text, uuid, uuid, text, text, text, text,
  numeric, numeric, numeric, integer,
  text
) to anon, authenticated, service_role;
