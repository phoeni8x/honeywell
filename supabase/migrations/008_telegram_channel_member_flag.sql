-- Whether this Telegram user was in the team channel last time we checked (bot /start or verify link).
do $migration$
begin
  execute $sql$
    alter table public.telegram_verifications
      add column if not exists is_channel_member boolean;
  $sql$;
  execute $sql$
    comment on column public.telegram_verifications.is_channel_member is 'true = in TELEGRAM_CHANNEL_ID, false = not in channel (Telegram guest), null = not checked or channel not configured.';
  $sql$;
end;
$migration$;
