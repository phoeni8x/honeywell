-- Whether this Telegram user was in the team channel last time we checked (bot /start or verify link).
-- Site-only "Continue as Guest" users never appear here — they are not stored server-side.
alter table public.telegram_verifications
  add column if not exists is_channel_member boolean;

comment on column public.telegram_verifications.is_channel_member is 'true = in TELEGRAM_CHANNEL_ID, false = not in channel (Telegram guest), null = not checked or channel not configured.';
