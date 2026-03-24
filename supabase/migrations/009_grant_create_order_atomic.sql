grant execute on function public.create_order_atomic(
  text, uuid, int, text, text,
  text, uuid, uuid, text, text, text, text,
  numeric, numeric, numeric, integer
) to anon, authenticated, service_role;
