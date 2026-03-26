-- Category ordering for admin drag-and-drop

alter table public.product_categories
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.product_categories
)
update public.product_categories pc
set sort_order = ranked.rn
from ranked
where pc.id = ranked.id
  and coalesce(pc.sort_order, 0) = 0;
