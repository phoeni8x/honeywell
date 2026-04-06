-- Saved parcel machine compartments for admin: pick a slot when approving orders or issuing lockers.

create table if not exists public.parcel_machine_slots (
  id uuid primary key default gen_random_uuid(),
  machine_name text not null,
  slot_label text not null,
  location_text text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint parcel_machine_slots_machine_slot_unique unique (machine_name, slot_label)
);

comment on table public.parcel_machine_slots is 'Admin-managed parcel machine slots; location_text is copied to customer-facing order locker fields.';
comment on column public.parcel_machine_slots.machine_name is 'Machine or station name for admin grouping';
comment on column public.parcel_machine_slots.slot_label is 'Compartment or slot id, e.g. A12';
comment on column public.parcel_machine_slots.location_text is 'Full customer-facing location: address, map links, instructions';

create index if not exists parcel_machine_slots_active_sort_idx
  on public.parcel_machine_slots (is_active, sort_order, machine_name);

alter table public.parcel_machine_slots enable row level security;
-- No policies: only service_role (admin API) bypasses RLS. Dashboard may use cookie gate without Supabase JWT.

grant select, insert, update, delete on public.parcel_machine_slots to service_role;
