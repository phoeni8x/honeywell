-- Part 36: Dead drops media + warning + max active pool
-- Adds:
-- - location_video_url
-- - location_photo_url_2 / location_photo_url_3
-- - dig_up_when_alone_warning
-- - Trigger to cap max active dead drops (default: 200) for safety/perf.

alter table public.dead_drops add column if not exists location_video_url text;
alter table public.dead_drops add column if not exists location_photo_url_2 text;
alter table public.dead_drops add column if not exists location_photo_url_3 text;
alter table public.dead_drops add column if not exists dig_up_when_alone_warning text;

create or replace function public.ensure_max_active_dead_drops()
returns trigger
language plpgsql
as $$
declare
  v_max int := 200;
  v_active_count int;
begin
  if new.is_active = true then
    select count(*)
      into v_active_count
      from public.dead_drops
     where is_active = true
       and (new.id is null or id <> new.id);

    if v_active_count >= v_max then
      raise exception 'max_active_dead_drops_reached';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_max_active_dead_drops on public.dead_drops;
create trigger ensure_max_active_dead_drops
before insert or update on public.dead_drops
for each row
execute function public.ensure_max_active_dead_drops();

