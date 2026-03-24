create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_token text not null unique,
  subscription jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.admin_push_subscription (
  id integer primary key default 1,
  subscription jsonb,
  updated_at timestamptz default now()
);

insert into public.admin_push_subscription (id) values (1) on conflict (id) do nothing;

alter table public.push_subscriptions enable row level security;
alter table public.admin_push_subscription enable row level security;
