-- Optional labels for customer-facing Telegram dead-drop messages (city / area lines).
alter table public.dead_drops add column if not exists location_city text;
alter table public.dead_drops add column if not exists location_area text;
