alter table public.custom_foods
add column if not exists barcode text;

alter table public.custom_foods
drop constraint if exists custom_foods_barcode_format;

alter table public.custom_foods
add constraint custom_foods_barcode_format
check (barcode is null or barcode ~ '^[0-9]{14}$');

with ranked_barcodes as (
  select
    id,
    lpad(food ->> 'barcode', 14, '0') as normalized_barcode,
    row_number() over (
      partition by user_id, lpad(food ->> 'barcode', 14, '0')
      order by created_at, id
    ) as duplicate_rank
  from public.custom_foods
  where food ->> 'barcode' ~ '^[0-9]{8,14}$'
)
update public.custom_foods as custom_food
set barcode = ranked_barcodes.normalized_barcode
from ranked_barcodes
where custom_food.id = ranked_barcodes.id
  and ranked_barcodes.duplicate_rank = 1
  and custom_food.barcode is null;

create unique index if not exists custom_foods_user_barcode_unique
on public.custom_foods (user_id, barcode)
where barcode is not null;
