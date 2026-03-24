do $m$
begin
  execute 'alter table public.ticket_messages add column if not exists is_read boolean default false';
  execute 'alter table public.ticket_messages add column if not exists read_at timestamptz';
end;
$m$;
