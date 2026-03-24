do $m$
begin
  execute 'alter table public.orders add column if not exists revolut_pay_timing text';
  execute 'alter table public.orders add column if not exists pay_now_payment_confirmed boolean not null default false';
end;
$m$;
