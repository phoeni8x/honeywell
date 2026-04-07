-- Per-product pre-order: follow shop locker toggle, or force payment vs booking-only.

alter table public.products
  add column if not exists preorder_payment_mode text not null default 'shop_default'
    check (preorder_payment_mode in ('shop_default', 'payment', 'booking'));

comment on column public.products.preorder_payment_mode is
  'Pre-order checkout: shop_default follows fulfillment_dead_drop; payment = pay now; booking = request only.';
