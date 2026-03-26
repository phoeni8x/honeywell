-- Dynamic product categories (admin-manageable)

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_categories_is_active_idx
  on public.product_categories (is_active);

insert into public.product_categories (slug, name, is_active)
values
  ('flower', 'Flowers', true),
  ('vitamin', 'Vitamins', true)
on conflict (slug) do update
set name = excluded.name;

-- Remove old hardcoded category check so admins can add custom categories.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint pc
    join pg_class t on t.oid = pc.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'products'
      and pc.contype = 'c'
      and pg_get_constraintdef(pc.oid) ilike '%category%'
  loop
    execute format('alter table public.products drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.product_categories enable row level security;

drop policy if exists "public_read_active_product_categories" on public.product_categories;
create policy "public_read_active_product_categories"
  on public.product_categories for select
  using (is_active = true);

drop policy if exists "auth_all_product_categories" on public.product_categories;
create policy "auth_all_product_categories"
  on public.product_categories for all
  to authenticated
  using (true) with check (true);
