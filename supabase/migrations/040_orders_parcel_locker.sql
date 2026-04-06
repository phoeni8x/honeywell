-- Parcel locker fulfillment: admin issues carrier (GLS, Packeta, etc.), machine location text, and locker passcode.
-- Reuses fulfillment_type = dead_drop and status flow; dead_drop_id stays null for this path.

alter table public.orders
  add column if not exists locker_provider text,
  add column if not exists locker_location_text text,
  add column if not exists locker_passcode text;

comment on column public.orders.locker_provider is 'Parcel network key, e.g. gls, packeta, foxpost, other';
comment on column public.orders.locker_location_text is 'Admin-issued locker address, machine ID, map link, or instructions';
comment on column public.orders.locker_passcode is 'One-time or pickup passcode for the parcel locker';

create or replace function public.issue_locker_for_dead_drop_order(
  p_order_id uuid,
  p_locker_provider text,
  p_locker_location_text text,
  p_locker_passcode text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_loc text;
  v_code text;
  v_prov text;
begin
  v_loc := trim(coalesce(p_locker_location_text, ''));
  v_code := trim(coalesce(p_locker_passcode, ''));
  if length(v_loc) < 3 then
    raise exception 'locker_location_required';
  end if;
  if length(v_code) < 2 then
    raise exception 'locker_passcode_required';
  end if;
  v_prov := nullif(trim(coalesce(p_locker_provider, '')), '');

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status is distinct from 'awaiting_dead_drop' then
    raise exception 'not_awaiting_dead_drop';
  end if;
  if v_order.fulfillment_type <> 'dead_drop' then
    raise exception 'not_dead_drop_order';
  end if;
  if v_order.dead_drop_id is not null then
    raise exception 'dead_drop_already_assigned';
  end if;
  if v_order.locker_passcode is not null and trim(v_order.locker_passcode) <> '' then
    raise exception 'locker_already_issued';
  end if;

  update public.orders
  set
    locker_provider = v_prov,
    locker_location_text = v_loc,
    locker_passcode = v_code,
    status = 'confirmed',
    updated_at = now()
  where id = p_order_id;
end;
$$;

grant execute on function public.issue_locker_for_dead_drop_order(uuid, text, text, text) to service_role;
