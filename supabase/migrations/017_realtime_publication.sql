-- Enable Postgres Realtime for tickets (admin dashboard uses authenticated Supabase session).
alter publication supabase_realtime add table public.ticket_messages;
alter publication supabase_realtime add table public.tickets;
