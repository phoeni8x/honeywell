-- Opt in/out of admin broadcast DMs (default: receive broadcasts)
do $migration$
begin
  execute $sql$
    alter table public.telegram_verifications
      add column if not exists broadcast_opt_in boolean not null default true;
  $sql$;
  execute $sql$
    comment on column public.telegram_verifications.broadcast_opt_in is 'If true, user receives /broadcast announcements from the bot.';
  $sql$;
end;
$migration$;
