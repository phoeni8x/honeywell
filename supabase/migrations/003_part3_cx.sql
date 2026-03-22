-- Honey Well Part 3 — run after 002_part2_advanced.sql

-- Order numbers
create sequence if not exists public.order_number_seq start with 1;

create or replace function public.generate_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'ORD-' || lpad(nextval('public.order_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists set_order_number on public.orders;
create trigger set_order_number
  before insert on public.orders
  for each row
  execute procedure public.generate_order_number();

alter table public.orders add column if not exists order_number text unique;
alter table public.orders add column if not exists referral_code_used text;

-- Tickets
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique,
  customer_token text not null,
  order_id uuid references public.orders(id),
  subject text not null,
  category text default 'other',
  status text default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create sequence if not exists public.ticket_number_seq start with 1;

create or replace function public.generate_ticket_number()
returns trigger
language plpgsql
as $$
begin
  if new.ticket_number is null or new.ticket_number = '' then
    new.ticket_number := 'TKT-' || lpad(nextval('public.ticket_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists set_ticket_number on public.tickets;
create trigger set_ticket_number
  before insert on public.tickets
  for each row
  execute procedure public.generate_ticket_number();

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete cascade,
  sender text not null check (sender in ('customer', 'admin')),
  message text,
  media_urls text[],
  created_at timestamptz default now()
);

create index if not exists ticket_messages_ticket_id_idx on public.ticket_messages (ticket_id);
create index if not exists tickets_customer_token_idx on public.tickets (customer_token);
create index if not exists tickets_status_idx on public.tickets (status);

-- Wallets: referral + levels
alter table public.bees_wallets add column if not exists referral_code text unique;
alter table public.points_wallets add column if not exists buyer_level integer default 1;
alter table public.points_wallets add column if not exists total_orders integer default 0;
alter table public.points_wallets add column if not exists total_spent_huf numeric default 0;

-- Referrals
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_token text not null,
  referee_token text not null,
  referral_code text not null,
  status text default 'pending'
    check (status in ('pending', 'rewarded', 'invalid')),
  first_order_id uuid references public.orders(id),
  reward_bees numeric,
  created_at timestamptz default now(),
  rewarded_at timestamptz
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_token);
create index if not exists referrals_referee_idx on public.referrals (referee_token);

-- RLS
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "auth_all_tickets" on public.tickets;
create policy "auth_all_tickets" on public.tickets for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_ticket_messages" on public.ticket_messages;
create policy "auth_all_ticket_messages" on public.ticket_messages for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_referrals" on public.referrals;
create policy "auth_all_referrals" on public.referrals for all to authenticated using (true) with check (true);
