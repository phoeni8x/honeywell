-- One-time tokens for t.me/bot?start=hw_<token> (links website username → Telegram user id)
-- Wrapped in a single statement so remote migration runner accepts it.
do $migration$
begin
  execute $sql$
    create table if not exists public.telegram_verify_tokens (
      token text primary key,
      telegram_username text not null,
      expires_at timestamptz not null
    );
  $sql$;
  execute $sql$
    create index if not exists telegram_verify_tokens_expires_idx on public.telegram_verify_tokens (expires_at);
  $sql$;
  execute $sql$alter table public.telegram_verify_tokens enable row level security$sql$;
end;
$migration$;
