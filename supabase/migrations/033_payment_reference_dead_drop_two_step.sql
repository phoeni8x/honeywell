-- Unique 6-char payment reference (3 letters A–Z except I/O + 3 digits 2–9).
-- Dead-drop orders: no dead_drop_id until admin confirms payment, then assigns via assign_dead_drop_for_order.

-- 1) Generator
create or replace function public.generate_payment_reference_code() returns text
language plpgsql
set search_path = public
as $$
declare
  letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  digits constant text := '23456789';
  attempt int := 0;
  candidate text;
begin
  while attempt < 200 loop
    candidate :=
      substr(letters, 1 + floor(random() * length(letters))::int, 1) ||
      substr(letters, 1 + floor(random() * length(letters))::int, 1) ||
      substr(letters, 1 + floor(random() * length(letters))::int, 1) ||
      substr(digits, 1 + floor(random() * length(digits))::int, 1) ||
      substr(digits, 1 + floor(random() * length(digits))::int, 1) ||
      substr(digits, 1 + floor(random() * length(digits))::int, 1);
    if not exists (select 1 from public.orders where payment_reference_code = candidate) then
      return candidate;
    end if;
    attempt := attempt + 1;
  end loop;
  raise exception 'payment_reference_exhausted';
end;
$$;

-- 2) Column + backfill
alter table public.orders add column if not exists payment_reference_code text;

update public.orders
set payment_reference_code = public.generate_payment_reference_code()
where payment_reference_code is null;

alter table public.orders alter column payment_reference_code set not null;

create unique index if not exists orders_payment_reference_code_uidx on public.orders (payment_reference_code);

-- 3) Immutable reference
create or replace function public.orders_payment_reference_immutable() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.payment_reference_code is distinct from old.payment_reference_code then
    raise exception 'payment_reference_code is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_payment_reference_immutable on public.orders;
create trigger orders_payment_reference_immutable
  before update on public.orders
  for each row execute function public.orders_payment_reference_immutable();

-- 4) Assign dead drop after admin confirmed payment (awaiting_dead_drop)
create or replace function public.assign_dead_drop_for_order(p_order_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_assigned_dead_drop_id uuid;
  v_customer_dead_drop_ids uuid[];
  v_customer_token text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.fulfillment_type <> 'dead_drop' then
    raise exception 'not_dead_drop_order';
  end if;
  if v_order.status <> 'awaiting_dead_drop' then
    raise exception 'not_awaiting_dead_drop';
  end if;
  if v_order.dead_drop_id is not null then
    raise exception 'dead_drop_already_assigned';
  end if;

  v_customer_token := v_order.customer_token;

  select coalesce(array_agg(s.dead_drop_id), '{}')
    into v_customer_dead_drop_ids
  from (
    select o.dead_drop_id, max(o.created_at) as last_used
    from public.orders o
    where o.customer_token = v_customer_token
      and o.fulfillment_type = 'dead_drop'
      and o.dead_drop_id is not null
    group by o.dead_drop_id
    order by max(o.created_at) desc
    limit 10
  ) s;

  if coalesce(array_length(v_customer_dead_drop_ids, 1), 0) >= 10 then
    select z.dead_drop_id
      into v_assigned_dead_drop_id
    from (
      select o.dead_drop_id, count(*) as usage_count
      from public.orders o
      where o.customer_token = v_customer_token
        and o.fulfillment_type = 'dead_drop'
        and o.dead_drop_id = any(v_customer_dead_drop_ids)
      group by o.dead_drop_id
      order by count(*) asc, min(o.created_at) asc
      limit 1
    ) z;
  else
    select d.id
      into v_assigned_dead_drop_id
    from public.dead_drops d
    where d.is_active = true
      and not exists (
        select 1
        from public.orders o
        where o.fulfillment_type = 'dead_drop'
          and o.dead_drop_id = d.id
      )
    order by d.created_at asc
    limit 1
    for update skip locked;

    if v_assigned_dead_drop_id is null and coalesce(array_length(v_customer_dead_drop_ids, 1), 0) > 0 then
      select z.dead_drop_id
        into v_assigned_dead_drop_id
      from (
        select o.dead_drop_id, count(*) as usage_count
        from public.orders o
        where o.customer_token = v_customer_token
          and o.fulfillment_type = 'dead_drop'
          and o.dead_drop_id = any(v_customer_dead_drop_ids)
        group by o.dead_drop_id
        order by count(*) asc, min(o.created_at) asc
        limit 1
      ) z;
    end if;
  end if;

  if v_assigned_dead_drop_id is null then
    raise exception 'dead_drop_unavailable';
  end if;

  update public.orders
  set
    dead_drop_id = v_assigned_dead_drop_id,
    status = 'confirmed',
    updated_at = now()
  where id = p_order_id;

  return v_assigned_dead_drop_id;
end;
$$;

grant execute on function public.assign_dead_drop_for_order(uuid) to service_role;

-- 5) create_order_atomic: dead-drop (non–pre-order) defers assignment; always set payment_reference_code
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
  p_points_used integer default 0,
  p_revolut_pay_timing text default null
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
  v_loc record;
  v_timing text;
  v_assigned_dead_drop_id uuid;
  v_customer_dead_drop_ids uuid[];
  v_allow_preorder boolean := false;
  v_is_preorder boolean := false;
  v_payment_ref text;
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

  if p_user_type = 'guest' and (v_pts_use > 0 or v_bees_use > 0) then
    raise exception 'guest_no_wallet_spend';
  end if;

  if p_payment_method not in ('revolut', 'crypto', 'bees', 'points') then
    raise exception 'invalid_payment_method';
  end if;
  if p_user_type = 'guest' and p_payment_method <> 'crypto' then
    raise exception 'guest_crypto_only';
  end if;

  select stock_quantity,
    case when p_user_type = 'team_member' then price_team_member else price_regular end,
    coalesce(allow_preorder, false)
  into v_stock, v_unit, v_allow_preorder
  from products
  where id = p_product_id and is_active = true
  for update;

  if v_stock is null then
    raise exception 'product_not_found';
  end if;
  if v_stock < p_quantity then
    if v_allow_preorder then
      v_is_preorder := true;
    else
      raise exception 'insufficient_stock';
    end if;
  end if;

  if p_fulfillment_type = 'dead_drop' then
    select coalesce(array_agg(s.dead_drop_id), '{}')
      into v_customer_dead_drop_ids
    from (
      select o.dead_drop_id, max(o.created_at) as last_used
      from orders o
      where o.customer_token = p_customer_token
        and o.fulfillment_type = 'dead_drop'
        and o.dead_drop_id is not null
      group by o.dead_drop_id
      order by max(o.created_at) desc
      limit 10
    ) s;

    if v_is_preorder then
      if coalesce(array_length(v_customer_dead_drop_ids, 1), 0) >= 10 then
        select z.dead_drop_id
          into v_assigned_dead_drop_id
        from (
          select o.dead_drop_id, count(*) as usage_count
          from orders o
          where o.customer_token = p_customer_token
            and o.fulfillment_type = 'dead_drop'
            and o.dead_drop_id = any(v_customer_dead_drop_ids)
          group by o.dead_drop_id
          order by count(*) asc, min(o.created_at) asc
          limit 1
        ) z;
      else
        select d.id
          into v_assigned_dead_drop_id
        from dead_drops d
        where d.is_active = true
          and not exists (
            select 1
            from orders o
            where o.fulfillment_type = 'dead_drop'
              and o.dead_drop_id = d.id
          )
        order by d.created_at asc
        limit 1
        for update skip locked;

        if v_assigned_dead_drop_id is null and coalesce(array_length(v_customer_dead_drop_ids, 1), 0) > 0 then
          select z.dead_drop_id
            into v_assigned_dead_drop_id
          from (
            select o.dead_drop_id, count(*) as usage_count
            from orders o
            where o.customer_token = p_customer_token
              and o.fulfillment_type = 'dead_drop'
              and o.dead_drop_id = any(v_customer_dead_drop_ids)
            group by o.dead_drop_id
            order by count(*) asc, min(o.created_at) asc
            limit 1
          ) z;
        end if;
      end if;

      if v_assigned_dead_drop_id is null then
        raise exception 'dead_drop_unavailable';
      end if;
    else
      v_assigned_dead_drop_id := null;
      if not exists (select 1 from dead_drops where is_active = true limit 1) then
        raise exception 'dead_drop_unavailable';
      end if;
    end if;
  elsif p_fulfillment_type = 'pickup' then
    if p_user_type <> 'team_member' then
      raise exception 'pickup_team_only';
    end if;
    if p_location_id is null then
      raise exception 'pickup_location_required';
    end if;
    select *
      into v_loc
    from shop_locations
    where id = p_location_id
      and is_active = true
      and coalesce(is_pickup_point, false) = true;
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

  v_total := v_unit * p_quantity;

  if v_pts_use > 0 and v_total < 50000 then
    raise exception 'points_min_order_total';
  end if;

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

  if v_total > 0.01 and p_payment_method not in ('revolut', 'crypto') then
    raise exception 'remainder_payment_invalid';
  end if;

  if v_total <= 0.01 then
    v_status := 'confirmed';
  end if;

  v_timing := null;
  if v_total > 0.01
     and p_payment_method = 'revolut'
     and p_fulfillment_type = 'delivery'
     and p_user_type = 'team_member'
     and not v_is_preorder then
    if p_revolut_pay_timing is not null and p_revolut_pay_timing not in ('pay_now', 'pay_on_delivery') then
      raise exception 'invalid_revolut_pay_timing';
    end if;
    v_timing := coalesce(nullif(trim(p_revolut_pay_timing), ''), 'pay_now');
    if v_timing = 'pay_on_delivery' then
      v_status := 'waiting';
    else
      v_status := 'payment_pending';
    end if;
  end if;

  if v_is_preorder and p_payment_method = 'revolut' and coalesce(p_revolut_pay_timing, 'pay_now') = 'pay_on_delivery' then
    raise exception 'preorder_pay_now_required';
  end if;

  if v_is_preorder then
    v_status := 'pre_ordered';
  end if;

  v_payment_ref := public.generate_payment_reference_code();

  if v_status <> 'payment_pending' and not v_is_preorder then
    update products
    set stock_quantity = v_stock - p_quantity
    where id = p_product_id;
  end if;

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
    points_used,
    revolut_pay_timing,
    pay_now_payment_confirmed,
    defer_stock_until_approval,
    payment_reference_code
  ) values (
    p_customer_token,
    p_product_id,
    p_quantity,
    greatest(v_total, 0),
    p_user_type,
    p_payment_method,
    v_status,
    p_fulfillment_type,
    case
      when p_fulfillment_type = 'dead_drop' and v_is_preorder then v_assigned_dead_drop_id
      when p_fulfillment_type = 'dead_drop' then null
      else null
    end,
    case when p_fulfillment_type = 'pickup' then p_location_id else null end,
    case when p_fulfillment_type = 'delivery' then p_delivery_address else null end,
    case when p_fulfillment_type = 'delivery' then p_delivery_apartment else null end,
    case when p_fulfillment_type = 'delivery' then p_delivery_notes else null end,
    case when p_fulfillment_type = 'delivery' then p_delivery_phone else null end,
    case when p_fulfillment_type = 'delivery' then p_delivery_lat else null end,
    case when p_fulfillment_type = 'delivery' then p_delivery_lon else null end,
    coalesce(v_bees_use, 0),
    coalesce(v_pts_use, 0),
    case
      when p_fulfillment_type = 'delivery' and p_payment_method = 'revolut' and p_user_type = 'team_member' and v_total > 0.01 and not v_is_preorder
      then v_timing
      else null
    end,
    false,
    case when v_status = 'payment_pending' or v_is_preorder then true else false end,
    v_payment_ref
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
  numeric, numeric, numeric, integer,
  text
) to anon, authenticated, service_role;
