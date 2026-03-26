-- Admin moderation + pickup point availability windows

alter table public.shop_locations
  add column if not exists pickup_available_from timestamptz null,
  add column if not exists pickup_available_until timestamptz null;

create table if not exists public.customer_moderation (
  customer_token text primary key,
  is_banned boolean not null default false,
  ban_reason text null,
  banned_at timestamptz null,
  banned_by text null,
  unbanned_at timestamptz null,
  unbanned_by text null,
  channel_kicked boolean not null default false,
  channel_kicked_at timestamptz null,
  channel_unbanned_at timestamptz null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists customer_moderation_is_banned_idx
  on public.customer_moderation (is_banned);

create index if not exists customer_moderation_channel_kicked_idx
  on public.customer_moderation (channel_kicked);
