-- Honey Well — run in Supabase SQL editor
-- Enable extensions
create extension if not exists "pgcrypto";

-- Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text check (category in ('flower', 'vitamin')),
  price_regular numeric not null,
  price_team_member numeric not null,
  stock_quantity integer not null default 0,
  image_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_token text not null,
  product_id uuid references public.products(id),
  quantity integer not null,
  total_price numeric not null,
  user_type text check (user_type in ('team_member', 'guest')),
  payment_method text,
  status text default 'payment_pending',
  pickup_photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists orders_customer_token_idx on public.orders (customer_token);
create index if not exists orders_status_idx on public.orders (status);

-- Announcements
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Settings (key/value)
create table if not exists public.settings (
  key text primary key,
  value text not null
);

-- Telegram: map username -> user_id after user sends /verify to bot
create table if not exists public.telegram_verifications (
  telegram_username text primary key,
  telegram_user_id bigint not null,
  verified_at timestamptz default now()
);

-- Atomic order creation + stock decrement (price computed server-side in DB)
create or replace function public.create_order_atomic(
  p_customer_token text,
  p_product_id uuid,
  p_quantity int,
  p_user_type text,
  p_payment_method text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_stock int;
  v_unit numeric;
  v_total numeric;
begin
  if p_quantity < 1 then
    raise exception 'invalid_quantity';
  end if;

  select stock_quantity,
    case when p_user_type = 'team_member' then price_team_member else price_regular end
  into v_stock, v_unit
  from products
  where id = p_product_id and is_active = true
  for update;

  if v_stock is null then
    raise exception 'product_not_found';
  end if;
  if v_stock < p_quantity then
    raise exception 'insufficient_stock';
  end if;

  v_total := v_unit * p_quantity;

  update products
  set stock_quantity = v_stock - p_quantity
  where id = p_product_id;

  insert into orders (
    customer_token,
    product_id,
    quantity,
    total_price,
    user_type,
    payment_method,
    status
  ) values (
    p_customer_token,
    p_product_id,
    p_quantity,
    v_total,
    p_user_type,
    p_payment_method,
    'payment_pending'
  )
  returning id into v_order_id;

  return v_order_id;
end;
$$;

create or replace function public.restore_product_stock(p_product_id uuid, p_quantity int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update products
  set stock_quantity = stock_quantity + p_quantity
  where id = p_product_id;
end;
$$;

-- RLS: adjust for your security model. Service role bypasses RLS.
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.announcements enable row level security;
alter table public.settings enable row level security;
alter table public.telegram_verifications enable row level security;

-- Public read products (active only)
drop policy if exists "public_read_active_products" on public.products;
create policy "public_read_active_products"
  on public.products for select
  using (is_active = true);

-- Public read announcements
drop policy if exists "public_read_announcements" on public.announcements;
create policy "public_read_announcements"
  on public.announcements for select
  using (is_active = true);

-- Authenticated users full access (single admin account)
drop policy if exists "auth_all_products" on public.products;
create policy "auth_all_products"
  on public.products for all
  to authenticated
  using (true) with check (true);

drop policy if exists "auth_all_orders" on public.orders;
create policy "auth_all_orders"
  on public.orders for all
  to authenticated
  using (true) with check (true);

drop policy if exists "auth_all_announcements" on public.announcements;
create policy "auth_all_announcements"
  on public.announcements for all
  to authenticated
  using (true) with check (true);

drop policy if exists "auth_all_settings" on public.settings;
create policy "auth_all_settings"
  on public.settings for all
  to authenticated
  using (true) with check (true);

drop policy if exists "auth_all_telegram" on public.telegram_verifications;
create policy "auth_all_telegram"
  on public.telegram_verifications for all
  to authenticated
  using (true) with check (true);

grant usage on schema public to authenticated;
grant execute on function public.restore_product_stock to authenticated;

-- Storage: create bucket "products" and "pickup-proofs" in dashboard; policies as needed.
