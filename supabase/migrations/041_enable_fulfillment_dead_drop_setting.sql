-- Turn parcel locker / dead-drop checkout on for customers (one-time when migration runs).
-- Toggle off again anytime in Admin → Settings → Parcel locker checkout, if needed.

insert into public.settings (key, value)
values ('fulfillment_dead_drop_enabled', '1')
on conflict (key) do update set value = '1';
