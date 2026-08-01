alter table public.food_nutrients
	add column if not exists value_status text not null default 'unknown',
	add column if not exists standard_error numeric,
	add column if not exists source_nutrient_key text,
	add column if not exists source_nutrient_code text,
	add column if not exists mapping_status text not null default 'unknown',
	add column if not exists mapping_method text,
	add column if not exists mapping_review_reference text,
	add column if not exists derivation_method text;

alter table public.food_nutrients
	drop constraint if exists food_nutrients_value_status_check,
	drop constraint if exists food_nutrients_standard_error_check,
	drop constraint if exists food_nutrients_mapping_status_check,
	drop constraint if exists food_nutrients_value_status_origin_check,
	drop constraint if exists food_nutrients_source_nutrient_key_check,
	drop constraint if exists food_nutrients_source_nutrient_code_check,
	drop constraint if exists food_nutrients_mapping_method_check,
	drop constraint if exists food_nutrients_mapping_review_reference_check,
	drop constraint if exists food_nutrients_derivation_method_check;

alter table public.food_nutrients
	add constraint food_nutrients_value_status_check check (
		value_status in ('reported', 'reported-zero', 'derived', 'trace', 'present-unquantified', 'missing', 'invalid', 'unknown')
	),
	add constraint food_nutrients_standard_error_check check (
		standard_error is null or standard_error >= 0
	),
	add constraint food_nutrients_mapping_status_check check (
		mapping_status in ('canonical', 'unmapped', 'excluded', 'unknown')
	),
	add constraint food_nutrients_value_status_origin_check check (
		(value_status = 'reported-zero' and value_origin = 'reported' and amount_per_100g = 0)
		or (value_status = 'reported' and value_origin = 'reported')
		or (value_status = 'derived' and value_origin = 'derived')
		or value_status in ('trace', 'present-unquantified', 'missing', 'invalid', 'unknown')
	),
	add constraint food_nutrients_source_nutrient_key_check check (
		source_nutrient_key is null or btrim(source_nutrient_key) <> ''
	),
	add constraint food_nutrients_source_nutrient_code_check check (
		source_nutrient_code is null or btrim(source_nutrient_code) <> ''
	),
	add constraint food_nutrients_mapping_method_check check (
		mapping_method is null or btrim(mapping_method) <> ''
	),
	add constraint food_nutrients_mapping_review_reference_check check (
		mapping_review_reference is null or btrim(mapping_review_reference) <> ''
	),
	add constraint food_nutrients_derivation_method_check check (
		derivation_method is null or btrim(derivation_method) <> ''
	);

create or replace function private.apply_food_nutrient_uncertainty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_food jsonb;
	v_nutrient jsonb;
	v_explicit_status text;
	v_mapping_status text;
begin
	if new.user_food_list_item_id is not null then
		select food into v_food
		from public.user_food_list_items
		where id = new.user_food_list_item_id;
	elsif new.custom_food_id is not null then
		select food into v_food
		from public.custom_foods
		where id = new.custom_food_id;
	elsif new.shared_product_submission_id is not null then
		select food into v_food
		from public.shared_product_submissions
		where id = new.shared_product_submission_id;
	elsif new.shared_product_id is not null then
		select food into v_food
		from public.shared_products
		where id = new.shared_product_id;
	elsif new.shared_product_revision_id is not null then
		select food into v_food
		from public.shared_product_revisions
		where id = new.shared_product_revision_id;
	elsif new.shared_product_observation_id is not null then
		select normalized_food into v_food
		from public.shared_product_observations
		where id = new.shared_product_observation_id;
	end if;

	if jsonb_typeof(v_food -> 'foodNutrients') = 'array' then
		select nutrient.value into v_nutrient
		from jsonb_array_elements(v_food -> 'foodNutrients') nutrient(value)
		where jsonb_typeof(nutrient.value) = 'object'
			and jsonb_typeof(nutrient.value -> 'nutrientId') = 'number'
			and (nutrient.value ->> 'nutrientId')::bigint = new.nutrient_id
		limit 1;
	end if;

	v_explicit_status := nullif(btrim(v_nutrient ->> 'valueStatus'), '');
	new.value_status := case
		when v_explicit_status in ('reported', 'reported-zero', 'derived', 'trace', 'present-unquantified', 'missing', 'invalid', 'unknown')
			then v_explicit_status
		when new.value_origin = 'derived' then 'derived'
		when new.value_origin = 'reported' and new.amount_per_100g = 0 then 'reported-zero'
		when new.value_origin = 'reported' then 'reported'
		else 'unknown'
	end;

	if new.value_status = 'reported-zero' and new.amount_per_100g <> 0 then
		new.value_status := case
			when new.value_origin = 'derived' then 'derived'
			else 'reported'
		end;
	end if;

	new.standard_error := case
		when jsonb_typeof(v_nutrient -> 'standardError') = 'number'
			and (v_nutrient ->> 'standardError')::numeric >= 0
			then (v_nutrient ->> 'standardError')::numeric
		else null
	end;
	new.source_nutrient_key := nullif(btrim(v_nutrient ->> 'sourceNutrientKey'), '');
	new.source_nutrient_code := nullif(btrim(v_nutrient ->> 'sourceNutrientCode'), '');
	v_mapping_status := nullif(btrim(v_nutrient ->> 'mappingStatus'), '');
	new.mapping_status := case
		when v_mapping_status in ('canonical', 'unmapped', 'excluded', 'unknown')
			then v_mapping_status
		else 'unknown'
	end;
	new.mapping_method := nullif(btrim(v_nutrient ->> 'mappingMethod'), '');
	new.mapping_review_reference := nullif(
		btrim(v_nutrient ->> 'mappingReviewReference'),
		''
	);
	new.derivation_method := nullif(btrim(v_nutrient ->> 'derivationMethod'), '');

	return new;
end;
$$;

drop trigger if exists apply_food_nutrient_uncertainty on public.food_nutrients;
create trigger apply_food_nutrient_uncertainty
	before insert or update of
		amount_per_100g,
		value_origin,
		nutrient_id,
		user_food_list_item_id,
		custom_food_id,
		shared_product_submission_id,
		shared_product_id,
		shared_product_revision_id,
		shared_product_observation_id
	on public.food_nutrients
	for each row execute function private.apply_food_nutrient_uncertainty();

update public.food_nutrients
set amount_per_100g = amount_per_100g;

comment on column public.food_nutrients.value_status is
	'Exact status of the accepted numeric value. Reported zero is distinct from missing, trace, derived, and unknown source facts.';
comment on column public.food_nutrients.standard_error is
	'Optional source-reported standard error. It is review metadata and never changes amount_per_100g.';
comment on column public.food_nutrients.mapping_review_reference is
	'Internal reference for the mapping decision used by moderator and data-quality review.';
comment on column public.food_nutrients.derivation_method is
	'Optional exact method supplied for a derived value; null means the method was not retained.';

alter function public.search_generic_food_records(text, integer)
	set schema private;

revoke all on function private.search_generic_food_records(text, integer)
	from public, anon, authenticated;

create function public.search_generic_food_records(
	p_query text,
	p_limit integer default 100
)
returns table (
	application_food_id bigint,
	dataset_key text,
	source_food_key text,
	description text,
	alternate_description text,
	food_group_name text,
	scientific_name text,
	preparation text,
	external_reference text,
	source_updated_at date,
	source_key text,
	source_display_name text,
	dataset_display_name text,
	dataset_version text,
	source_url text,
	license_name text,
	license_url text,
	attribution_text text,
	metadata jsonb,
	source_identifiers jsonb,
	nutrients jsonb,
	measures jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
	select
		base.application_food_id,
		base.dataset_key,
		base.source_food_key,
		base.description,
		base.alternate_description,
		base.food_group_name,
		base.scientific_name,
		base.preparation,
		base.external_reference,
		base.source_updated_at,
		base.source_key,
		base.source_display_name,
		base.dataset_display_name,
		base.dataset_version,
		base.source_url,
		base.license_name,
		base.license_url,
		base.attribution_text,
		base.metadata,
		base.source_identifiers,
		coalesce(nutrients.rows, '[]'::jsonb),
		base.measures
	from private.search_generic_food_records(p_query, p_limit) base
	left join lateral (
		select jsonb_agg(
			jsonb_build_object(
				'nutrientId', nutrient.nutrient_id,
				'nutrientNumber', nutrient.source_nutrient_key,
				'nutrientName', nutrient.source_nutrient_name,
				'unitName', nutrient.unit_name,
				'value', nutrient.amount_per_100g,
				'standardError', nutrient.standard_error,
				'observationCount', nutrient.observation_count,
				'sourceUpdatedAt', nutrient.source_updated_at,
				'sourceNutrientKey', nutrient.source_nutrient_key,
				'sourceNutrientCode', nutrient.nutrient_source_code,
				'mappingStatus', nutrient.mapping_status,
				'valueStatus', nutrient.value_status,
				'mappingMethod', source_mapping.mapping_method,
				'mappingReviewReference', source_mapping.review_reference,
				'derivationMethod', nutrient.metadata ->> 'derivationMethod',
				'metadata', nutrient.metadata
			)
			order by
				nutrient.nutrient_id nulls last,
				nutrient.source_nutrient_key
		) as rows
		from public.generic_food_nutrients nutrient
		left join lateral (
			select
				mapping.mapping_method,
				mapping.review_reference
			from public.nutrient_source_mappings mapping
			where mapping.source_key = base.source_key
				and mapping.source_nutrient_key = nutrient.source_nutrient_key
				and mapping.source_unit_name in ('', nutrient.unit_name)
				and mapping.enabled
			order by
				(mapping.review_status = 'approved') desc,
				mapping.priority,
				mapping.nutrient_id
			limit 1
		) source_mapping on true
		where nutrient.dataset_key = base.dataset_key
			and nutrient.source_food_key = base.source_food_key
	) nutrients on true;
$$;

revoke all on function public.search_generic_food_records(text, integer)
	from public, anon;
grant execute on function public.search_generic_food_records(text, integer)
	to authenticated, service_role;
