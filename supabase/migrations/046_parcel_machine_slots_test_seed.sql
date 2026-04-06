-- Optional demo row for admin parcel-machine picker (idempotent).
insert into public.parcel_machine_slots (machine_name, slot_label, location_text, sort_order, is_active)
values (
  '[TEST] Demo parcel machine',
  'SLOT-01',
  'Test compartment for development. Customer-facing text example: corner of Example Square, locker bank next to entrance. Replace or delete in production. Passcode is entered by you when approving an order.',
  0,
  true
)
on conflict (machine_name, slot_label) do nothing;
