create or replace function private.enforce_reviewed_food_nutrient_lineage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_canonical_unit_name text;
	v_source_nutrient_code text;
begin
	if new.mapping_method in ('api_taxonomy_match', 'api_observation_match') then
		new.mapping_status := 'unmapped';
		new.mapping_review_reference := null;
		return new;
	end if;

	if new.source = 'usda'
		and nullif(btrim(new.source_reference), '') is not null
		and new.mapping_status in ('canonical', 'unmapped', 'unknown')
		and coalesce(nullif(btrim(new.mapping_method), ''), 'source-identifier') = 'source-identifier'
		and (
			nullif(btrim(new.source_nutrient_key), '') is null
			or btrim(new.source_nutrient_key) = new.nutrient_id::text
		)
	then
		select
			upper(definition.default_unit_name),
			nullif(btrim(definition.nutrient_number), '')
		into v_canonical_unit_name, v_source_nutrient_code
		from public.nutrient_definitions definition
		where definition.nutrient_id = new.nutrient_id;

		if found and upper(btrim(new.unit_name)) = v_canonical_unit_name then
			new.source_nutrient_key := new.nutrient_id::text;
			new.source_nutrient_code := coalesce(
				nullif(btrim(new.source_nutrient_code), ''),
				v_source_nutrient_code
			);
			new.mapping_status := 'canonical';
			new.mapping_method := 'source-identifier';
		end if;
	end if;

	return new;
end;
$$;

drop trigger if exists enforce_reviewed_food_nutrient_lineage
	on public.food_nutrients;
create trigger enforce_reviewed_food_nutrient_lineage
	before insert or update on public.food_nutrients
	for each row execute function private.enforce_reviewed_food_nutrient_lineage();

drop trigger if exists enforce_reviewed_food_nutrient_lineage
	on public.food_nutrient_measurements;
create trigger enforce_reviewed_food_nutrient_lineage
	before insert or update on public.food_nutrient_measurements
	for each row execute function private.enforce_reviewed_food_nutrient_lineage();

revoke all on function private.enforce_reviewed_food_nutrient_lineage()
	from public, anon, authenticated;

update public.food_nutrients nutrient
set
	source_nutrient_key = nutrient.nutrient_id::text,
	source_nutrient_code = coalesce(
		nullif(btrim(nutrient.source_nutrient_code), ''),
		nullif(btrim(definition.nutrient_number), '')
	),
	mapping_status = 'canonical',
	mapping_method = 'source-identifier',
	updated_at = now()
from public.nutrient_definitions definition
where nutrient.nutrient_id = definition.nutrient_id
	and nutrient.source = 'usda'
	and nullif(btrim(nutrient.source_reference), '') is not null
	and upper(btrim(nutrient.unit_name)) = upper(definition.default_unit_name)
	and nutrient.mapping_status in ('canonical', 'unmapped', 'unknown')
	and coalesce(nullif(btrim(nutrient.mapping_method), ''), 'source-identifier') = 'source-identifier'
	and (
		nullif(btrim(nutrient.source_nutrient_key), '') is null
		or btrim(nutrient.source_nutrient_key) = nutrient.nutrient_id::text
	);

update public.food_nutrient_measurements measurement
set
	source_nutrient_key = measurement.nutrient_id::text,
	source_nutrient_code = coalesce(
		nullif(btrim(measurement.source_nutrient_code), ''),
		nullif(btrim(definition.nutrient_number), '')
	),
	mapping_status = 'canonical',
	mapping_method = 'source-identifier',
	updated_at = now()
from public.nutrient_definitions definition
where measurement.nutrient_id = definition.nutrient_id
	and measurement.source = 'usda'
	and nullif(btrim(measurement.source_reference), '') is not null
	and upper(btrim(measurement.unit_name)) = upper(definition.default_unit_name)
	and measurement.mapping_status in ('canonical', 'unmapped', 'unknown')
	and coalesce(nullif(btrim(measurement.mapping_method), ''), 'source-identifier') = 'source-identifier'
	and (
		nullif(btrim(measurement.source_nutrient_key), '') is null
		or btrim(measurement.source_nutrient_key) = measurement.nutrient_id::text
	);

comment on function private.enforce_reviewed_food_nutrient_lineage() is
	'Keeps semantic nutrient candidates noncanonical and restores canonical lineage only when an exact USDA nutrient identifier and its canonical unit agree.';
