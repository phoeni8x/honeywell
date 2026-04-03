-- Manual dead drop assignment: checkout never reserves a slot or requires active drops.
-- Payment approval (payment_pending): deduct product stock only, status -> awaiting_dead_drop.
-- assign_dead_drop_for_order (awaiting_dead_drop): pick an active drop, status -> confirmed, no second stock deduct.
-- Drops are reusable: assignment picks any active row for the product (no "slot already used" exclusion).

create or replace function public.dead_drop_finalize_from_admin(
  p_order_id uuid,
  p_require_status text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_assigned_dead_drop_id uuid;
  v_stock int;
begin
  if p_require_status not in ('payment_pending', 'awaiting_dead_drop') then
    raise exception 'invalid_dead_drop_finalize_status';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status is distinct from p_require_status then
    raise exception 'wrong_order_status';
  end if;
  if v_order.fulfillment_type <> 'dead_drop' then
    raise exception 'not_dead_drop_order';
  end if;
  if v_order.dead_drop_id is not null then
    raise exception 'dead_drop_already_assigned';
  end if;

  if p_require_status = 'payment_pending' then
    select stock_quantity into v_stock from public.products where id = v_order.product_id for update;
    if v_stock is null then
      raise exception 'product_not_found';
    end if;
    if v_stock < v_order.quantity then
      raise exception 'insufficient_stock';
    end if;

    update public.products
    set stock_quantity = stock_quantity - v_order.quantity
    where id = v_order.product_id;

    update public.orders
    set
      status = 'awaiting_dead_drop',
      updated_at = now(),
      defer_stock_until_approval = false
    where id = p_order_id;

    return null;
  end if;

  -- awaiting_dead_drop: assign slot only (stock already deducted on payment confirm)
  select d.id
    into v_assigned_dead_drop_id
  from public.dead_drops d
  where d.is_active = true
    and (d.product_id = v_order.product_id or d.product_id is null)
  order by d.created_at asc
  limit 1
  for update;

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
    perform 1;
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
    if coalesce(p_fulfillment_type, '') = 'dead_drop' and not v_is_preorder then
      v_status := 'payment_pending';
    else
      v_status := 'confirmed';
    end if;
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

  if v_status <> 'payment_pending' and not v_is_preorder
     and coalesce(p_fulfillment_type, '') <> 'dead_drop' then
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
    null,
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
