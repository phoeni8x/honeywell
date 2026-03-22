-- Honey Well Part 4 — fulfillment, dead drops, delivery tracking
-- Run after 003_part3_cx.sql

create table if not exists public.dead_drops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude numeric not null,
  longitude numeric not null,
  google_maps_url text,
  apple_maps_url text,
  instructions text,
  location_photo_url text,
  active_from timestamptz,
  active_until timestamptz,
  is_active boolean default false,
  created_at timestamptz default now()
);

create or replace function public.deactivate_other_dead_drops()
returns trigger
language plpgsql
as $$
begin
  if new.is_active = true then
    update public.dead_drops set is_active = false where id != new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_single_active_dead_drop on public.dead_drops;
create trigger ensure_single_active_dead_drop
  before insert or update on public.dead_drops
  for each row
  execute function public.deactivate_other_dead_drops();

alter table public.shop_locations add column if not exists is_pickup_point boolean default false;

create table if not exists public.admin_location (
  id integer primary key default 1,
  latitude numeric,
  longitude numeric,
  updated_at timestamptz default now(),
  is_sharing boolean default false
);

insert into public.admin_location (id, is_sharing) values (1, false)
  on conflict (id) do nothing;

alter table public.orders add column if not exists fulfillment_type text;
alter table public.orders add column if not exists dead_drop_id uuid references public.dead_drops(id);
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists delivery_apartment text;
alter table public.orders add column if not exists delivery_notes text;
alter table public.orders add column if not exists delivery_phone text;
alter table public.orders add column if not exists delivery_lat numeric;
alter table public.orders add column if not exists delivery_lon numeric;

alter table public.dead_drops enable row level security;
drop policy if exists "auth_all_dead_drops" on public.dead_drops;
create policy "auth_all_dead_drops" on public.dead_drops for all to authenticated using (true) with check (true);
drop policy if exists "public_read_active_dead_drops" on public.dead_drops;
create policy "public_read_active_dead_drops" on public.dead_drops for select using (is_active = true);

alter table public.admin_location enable row level security;
drop policy if exists "public_read_admin_location" on public.admin_location;
create policy "public_read_admin_location" on public.admin_location for select using (true);
drop policy if exists "auth_write_admin_location" on public.admin_location;
create policy "auth_write_admin_location" on public.admin_location for all to authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.admin_location;
exception
  when duplicate_object then null;
end $$;

create or replace function public.create_order_atomic(
  p_customer_token text,
  p_product_id uuid,
  p_quantity int,
  p_user_type text,
  p_payment_method text,
  p_fulfillment_type text default null,
  p_dead_drop_id uuid default null,
  p_location_id uuid default null,
  p_delivery_address text default null,
  p_delivery_apartment text default null,
  p_delivery_notes text default null,
  p_delivery_phone text default null,
  p_delivery_lat numeric default null,
  p_delivery_lon numeric default null,
  p_bees_used numeric default 0,
  p_points_used integer default 0
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
  v_status text := 'payment_pending';
  v_bees_bal numeric;
  v_pts_bal int;
  v_pts_use int := greatest(coalesce(p_points_used, 0), 0);
  v_bees_use numeric := greatest(coalesce(p_bees_used, 0), 0);
  v_dd record;
  v_loc record;
begin
  if p_quantity < 1 then
    raise exception 'invalid_quantity';
  end if;

  if p_user_type = 'guest' and p_fulfillment_type is not null and p_fulfillment_type in ('pickup', 'delivery') then
    raise exception 'guest_fulfillment_invalid';
  end if;
  if p_user_type = 'guest' and p_payment_method = 'revolut' then
    raise exception 'guest_revolut_forbidden';
  end if;

  if p_fulfillment_type = 'dead_drop' then
    if p_dead_drop_id is null then
      raise exception 'dead_drop_required';
    end if;
    select * into v_dd from dead_drops where id = p_dead_drop_id and is_active = true;
    if not found then
      raise exception 'dead_drop_inactive';
    end if;
  elsif p_fulfillment_type = 'pickup' then
    if p_user_type <> 'team_member' then
      raise exception 'pickup_team_only';
    end if;
    if p_location_id is null then
      raise exception 'pickup_location_required';
    end if;
    select * into v_loc from shop_locations where id = p_location_id and is_active = true and coalesce(is_pickup_point, false) = true;
    if not found then
      raise exception 'invalid_pickup_point';
    end if;
  elsif p_fulfillment_type = 'delivery' then
    if p_user_type <> 'team_member' then
      raise exception 'delivery_team_only';
    end if;
    if p_delivery_address is null or trim(p_delivery_address) = '' then
      raise exception 'delivery_address_required';
    end if;
  end if;

  if p_payment_method not in ('revolut', 'crypto', 'bees', 'points') then
    raise exception 'invalid_payment_method';
  end if;
  if p_user_type = 'guest' and p_payment_method not in ('crypto', 'bees', 'points') then
    raise exception 'guest_payment_invalid';
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

  if v_pts_use > 0 or v_bees_use > 0 then
    select balance_points into v_pts_bal from points_wallets where customer_token = p_customer_token for update;
    select balance_bees into v_bees_bal from bees_wallets where customer_token = p_customer_token for update;
    if v_pts_use > 0 and v_pts_bal is null then
      raise exception 'points_wallet_missing';
    end if;
    if v_bees_use > 0 and v_bees_bal is null then
      raise exception 'bees_wallet_missing';
    end if;
  end if;

  if v_pts_use > 0 then
    v_pts_use := least(v_pts_use, coalesce(v_pts_bal, 0));
    v_pts_use := least(v_pts_use, floor(v_total)::int);
    if v_pts_use > 0 then
      v_total := v_total - v_pts_use;
    else
      v_pts_use := 0;
    end if;
  end if;

  if v_bees_use > 0 then
    v_bees_use := least(v_bees_use, coalesce(v_bees_bal, 0));
    if v_bees_use * 10000 > v_total then
      v_bees_use := ceil(v_total / 10000.0);
    end if;
    if v_bees_use > coalesce(v_bees_bal, 0) then
      raise exception 'insufficient_bees';
    end if;
    if v_bees_use > 0 then
      v_total := v_total - (v_bees_use * 10000);
    else
      v_bees_use := 0;
    end if;
  end if;

  -- Remaining balance must be paid with Revolut or Crypto (not bees/points alone)
  if v_total > 0.01 and p_payment_method not in ('revolut', 'crypto') then
    raise exception 'remainder_payment_invalid';
  end if;

  if v_total <= 0.01 then
    v_status := 'confirmed';
  end if;

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
    status,
    fulfillment_type,
    dead_drop_id,
    location_id,
    delivery_address,
    delivery_apartment,
    delivery_notes,
    delivery_phone,
    delivery_lat,
    delivery_lon,
    bees_used,
    points_used
  ) values (
    p_customer_token,
    p_product_id,
    p_quantity,
    greatest(v_total, 0),
    p_user_type,
    p_payment_method,
    v_status,
    p_fulfillment_type,
    case when p_fulfillment_type = 'dead_drop' then p_dead_drop_id else null end,
    case when p_fulfillment_type = 'pickup' then p_location_id else null end,
    case when p_fulfillment_type = 'delivery' then p_delivery_address else null end,
    case when p_fulfillment_type = 'delivery' then p_delivery_apartment else null end,
    case when p_fulfillment_type = 'delivery' then p_delivery_notes else null end,
    case when p_fulfillment_type = 'delivery' then p_delivery_phone else null end,
    case when p_fulfillment_type = 'delivery' then p_delivery_lat else null end,
    case when p_fulfillment_type = 'delivery' then p_delivery_lon else null end,
    coalesce(v_bees_use, 0),
    coalesce(v_pts_use, 0)
  )
  returning id into v_order_id;

  if v_pts_use > 0 then
    update points_wallets
    set balance_points = balance_points - v_pts_use, updated_at = now()
    where customer_token = p_customer_token;
    insert into points_transactions (customer_token, type, points, order_id)
    values (p_customer_token, 'redeem', v_pts_use, v_order_id);
  end if;

  if v_bees_use > 0 then
    update bees_wallets
    set balance_bees = balance_bees - v_bees_use, updated_at = now()
    where customer_token = p_customer_token;
    insert into bees_transactions (customer_token, type, amount_bees, amount_huf, payment_method, reference)
    values (p_customer_token, 'spend', v_bees_use, v_bees_use * 10000, 'order', v_order_id::text);
  end if;

  return v_order_id;
end;
$$;

grant execute on function public.create_order_atomic(
  text, uuid, int, text, text,
  text, uuid, uuid, text, text, text, text,
  numeric, numeric, numeric, integer
) to anon, authenticated, service_role;
