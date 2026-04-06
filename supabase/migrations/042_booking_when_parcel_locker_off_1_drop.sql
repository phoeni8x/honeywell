-- Booking flow for parcel locker off — part 1/3 (drop old overload). See _2 and _3.

drop function if exists public.create_order_atomic(
  text,
  uuid,
  int,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  text
);
