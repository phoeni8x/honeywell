alter table public.ticket_messages drop constraint if exists ticket_messages_sender_check;

alter table public.ticket_messages
  add constraint ticket_messages_sender_check
  check (sender in ('customer', 'admin', 'admin_internal'));
