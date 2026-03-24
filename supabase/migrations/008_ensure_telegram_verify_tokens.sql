-- Idempotent: some deployments may not have applied 005_telegram_verify_tokens.sql
-- (duplicate 005_* version ordering). Ensures one-time link table exists.
create table if not exists public.telegram_verify_tokens (
  token text primary key,
  telegram_username text not null,
  expires_at timestamptz not null
);

create index if not exists telegram_verify_tokens_expires_idx on public.telegram_verify_tokens (expires_at);

alter table public.telegram_verify_tokens enable row level security;
