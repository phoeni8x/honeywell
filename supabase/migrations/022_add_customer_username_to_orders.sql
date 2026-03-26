-- Store customer username at order time for admin visibility.
alter table public.orders
  add column if not exists customer_username text;
