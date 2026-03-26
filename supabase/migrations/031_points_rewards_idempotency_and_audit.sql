-- Harden points awarding against duplicate processing and duplicate tx rows.

alter table public.orders
  add column if not exists rewards_processed_at timestamptz;

-- Keep only earliest row for the same order-based points event.
with ranked as (
  select
    id,
    row_number() over (
      partition by customer_token, order_id, type
      order by created_at asc, id asc
    ) as rn
  from public.points_transactions
  where order_id is not null
    and type in ('earn', 'redeem', 'bonus')
)
delete from public.points_transactions pt
using ranked r
where pt.id = r.id
  and r.rn > 1;

create unique index if not exists points_tx_order_type_customer_unique_idx
  on public.points_transactions (customer_token, order_id, type)
  where order_id is not null
    and type in ('earn', 'redeem', 'bonus');
