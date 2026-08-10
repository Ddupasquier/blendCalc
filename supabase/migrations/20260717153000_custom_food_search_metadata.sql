alter table public.custom_foods
	add column if not exists search_text text;

create or replace function public.set_custom_food_search_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
	new.search_text = lower(concat_ws(
		' ',
		new.barcode,
		new.name_key,
		public.food_metadata_search_text(new.food)
	));
	return new;
end;
$$;

drop trigger if exists set_custom_food_search_text on public.custom_foods;

create trigger set_custom_food_search_text
	before insert or update of barcode, name_key, food
	on public.custom_foods
	for each row execute function public.set_custom_food_search_text();

update public.custom_foods
set search_text = lower(concat_ws(
	' ',
	barcode,
	name_key,
	public.food_metadata_search_text(food)
));

alter table public.custom_foods
	alter column search_text set not null;

alter table public.custom_foods
	drop constraint if exists custom_foods_search_text_not_blank;

alter table public.custom_foods
	add constraint custom_foods_search_text_not_blank
	check (btrim(search_text) <> '');

create index if not exists custom_foods_search_trgm_idx
	on public.custom_foods using gin (search_text gin_trgm_ops);
