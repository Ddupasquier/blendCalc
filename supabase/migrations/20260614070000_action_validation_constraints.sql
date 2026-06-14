alter table public.custom_foods
add column if not exists name_key text;

alter table public.custom_foods
drop constraint if exists custom_foods_name_key_not_blank;

alter table public.custom_foods
add constraint custom_foods_name_key_not_blank
check (name_key is null or btrim(name_key) <> '');

with ranked_names as (
  select
    id,
    lower(regexp_replace(btrim(food ->> 'description'), '\s+', ' ', 'g')) as normalized_name,
    row_number() over (
      partition by
        user_id,
        lower(regexp_replace(btrim(food ->> 'description'), '\s+', ' ', 'g'))
      order by created_at, id
    ) as duplicate_rank
  from public.custom_foods
  where nullif(btrim(food ->> 'description'), '') is not null
)
update public.custom_foods as custom_food
set name_key = ranked_names.normalized_name
from ranked_names
where custom_food.id = ranked_names.id
  and ranked_names.duplicate_rank = 1
  and custom_food.name_key is null;

create unique index if not exists custom_foods_user_name_key_unique
on public.custom_foods (user_id, name_key)
where name_key is not null;
