-- Honey Well Part 2 — run after 001_schema.sql

-- Bees
create table if not exists public.bees_wallets (
  id uuid primary key default gen_random_uuid(),
  customer_token text unique not null,
  balance_bees numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bees_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_token text not null,
  type text check (type in ('purchase', 'spend', 'refund', 'bonus')),
  amount_bees numeric not null,
  amount_huf numeric,
  payment_method text,
  reference text,
  created_at timestamptz default now()
);

-- Points
create table if not exists public.points_wallets (
  id uuid primary key default gen_random_uuid(),
  customer_token text unique not null,
  balance_points integer default 0,
  lifetime_points integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.points_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_token text not null,
  type text check (type in ('earn', 'redeem', 'expire', 'bonus')),
  points integer not null,
  order_id uuid references public.orders(id),
  created_at timestamptz default now()
);

-- Locations
create table if not exists public.shop_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude numeric not null,
  longitude numeric not null,
  google_maps_url text,
  apple_maps_url text,
  admin_message text,
  photo_url text,
  video_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.product_location_stock (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  location_id uuid references public.shop_locations(id) on delete cascade,
  stock_quantity integer default 0,
  is_taken boolean default false,
  taken_at timestamptz,
  taken_by_order_id uuid references public.orders(id),
  unique(product_id, location_id)
);

-- Orders extensions (ignore errors if columns already exist)
alter table public.orders add column if not exists location_id uuid references public.shop_locations(id);
alter table public.orders add column if not exists bees_used numeric default 0;
alter table public.orders add column if not exists points_used integer default 0;
alter table public.orders add column if not exists crypto_expected_amount numeric;
alter table public.orders add column if not exists crypto_tx_hash text;
alter table public.orders add column if not exists arrival_lat numeric;
alter table public.orders add column if not exists arrival_lon numeric;
alter table public.orders add column if not exists arrived_at timestamptz;
alter table public.orders add column if not exists arrival_distance_meters numeric;
alter table public.orders add column if not exists pickup_media_url text;
alter table public.orders add column if not exists pickup_flagged boolean default false;
alter table public.orders add column if not exists pickup_flag_reason text;
alter table public.orders add column if not exists customer_arrived boolean default false;

-- RLS for new tables (mirror Part 1: public read where needed; auth full access)
alter table public.bees_wallets enable row level security;
alter table public.bees_transactions enable row level security;
alter table public.points_wallets enable row level security;
alter table public.points_transactions enable row level security;
alter table public.shop_locations enable row level security;
alter table public.product_location_stock enable row level security;

drop policy if exists "auth_all_bees_wallets" on public.bees_wallets;
create policy "auth_all_bees_wallets" on public.bees_wallets for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_bees_tx" on public.bees_transactions;
create policy "auth_all_bees_tx" on public.bees_transactions for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_points_wallets" on public.points_wallets;
create policy "auth_all_points_wallets" on public.points_wallets for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_points_tx" on public.points_transactions;
create policy "auth_all_points_tx" on public.points_transactions for all to authenticated using (true) with check (true);

drop policy if exists "public_read_locations" on public.shop_locations;
create policy "public_read_locations" on public.shop_locations for select using (is_active = true);

drop policy if exists "auth_all_locations" on public.shop_locations;
create policy "auth_all_locations" on public.shop_locations for all to authenticated using (true) with check (true);

drop policy if exists "public_read_pls" on public.product_location_stock;
create policy "public_read_pls" on public.product_location_stock for select using (true);

drop policy if exists "auth_all_pls" on public.product_location_stock;
create policy "auth_all_pls" on public.product_location_stock for all to authenticated using (true) with check (true);
