-- Part 8/9: optional column for UI; realtime for wallet polling alternatives.
alter table public.orders add column if not exists points_earned integer default 0;

do $$
begin
  alter publication supabase_realtime add table public.bees_wallets;
exception
  when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.points_wallets;
exception
  when others then null;
end $$;
