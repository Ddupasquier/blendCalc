insert into public.app_issue_codes (code, kind, domain, description)
values (
	'FOOD_INTRINSIC_ALLERGEN',
	'warning',
	'compatibility',
	'An authoritative generic food identity is itself a selected allergen.'
)
on conflict (code) do update
set
	kind = excluded.kind,
	domain = excluded.domain,
	description = excluded.description,
	enabled = true,
	updated_at = now();

update public.shared_products
set food = jsonb_set(food, '{foodIdentityType}', '"packaged"'::jsonb, true)
where coalesce(food ->> 'foodIdentityType', '') = '';

update public.shared_product_submissions
set food = jsonb_set(food, '{foodIdentityType}', '"packaged"'::jsonb, true)
where coalesce(food ->> 'foodIdentityType', '') = '';

alter table public.custom_foods disable trigger prepare_custom_food_record;

update public.custom_foods
set food = jsonb_set(
	food,
	'{foodIdentityType}',
	to_jsonb(
		case
			when lower(coalesce(food ->> 'customFood', 'false')) = 'true'
				then 'private-custom'
			when lower(coalesce(food ->> 'dataType', '')) in (
				'foundation',
				'generic',
				'sr legacy',
				'survey (fndds)'
			) then 'generic'
			else 'packaged'
		end
	),
	true
)
where coalesce(food ->> 'foodIdentityType', '') = '';

alter table public.custom_foods enable trigger prepare_custom_food_record;

update public.user_food_list_items
set food = jsonb_set(
	food,
	'{foodIdentityType}',
	to_jsonb(
		case
			when lower(coalesce(food ->> 'customFood', 'false')) = 'true'
				then 'private-custom'
			when lower(coalesce(food ->> 'dataType', '')) in (
				'foundation',
				'generic',
				'sr legacy',
				'survey (fndds)'
			) then 'generic'
			else 'packaged'
		end
	),
	true
)
where coalesce(food ->> 'foodIdentityType', '') = '';

alter table public.food_compatibility_match_rules
	drop constraint if exists food_compatibility_match_rules_field_name_check,
	drop constraint if exists food_compatibility_match_rules_fact_type_check,
	drop constraint if exists food_compatibility_match_rules_source_type_check;

alter table public.food_compatibility_match_rules
	add constraint food_compatibility_match_rules_field_name_check
		check (field_name in ('ingredients', 'generic_food_identity')),
	add constraint food_compatibility_match_rules_fact_type_check
		check (fact_type in ('ingredient_present', 'contains')),
	add constraint food_compatibility_match_rules_source_type_check
		check (
			source_type in ('label_ingredient_field', 'food_identity_taxonomy')
		);

alter table public.product_compatibility_facts
	drop constraint if exists product_compatibility_facts_source_type_check;

alter table public.product_compatibility_facts
	add constraint product_compatibility_facts_source_type_check
	check (
		source_type in (
			'shared_product_metadata',
			'shared_observation_metadata',
			'shared_submission_metadata',
			'label_allergen_field',
			'label_trace_field',
			'label_dietary_field',
			'label_ingredient_field',
			'food_identity_taxonomy'
		)
	);

with rule_values (
	tag_slug,
	match_pattern,
	exclude_pattern,
	priority
) as (
	values
		(
			'milk',
			'\b(?:milk|buttermilk|yogurt|yoghurt|cheese|whey)\b',
			'\b(?:almond|coconut|oat|rice|soy)\s+milk\b',
			210
		),
		('peanut', '\bpeanuts?\b', null, 220),
		(
			'tree-nut',
			'\b(?:almonds?|cashews?|hazelnuts?|pecans?|pistachios?|walnuts?|macadamias?|brazil nuts?|tree nuts?)\b',
			null,
			230
		),
		('soy', '\b(?:soy|soya|soybeans?|tofu|tempeh|edamame)\b', null, 240),
		('egg', '\beggs?\b', '\beggplants?\b', 250),
		('wheat', '\bwheat\b', null, 260),
		(
			'fish',
			'\b(?:fish|anchovy|cod|salmon|tuna|trout|haddock|pollock|sardine|tilapia|halibut|mackerel)\b',
			null,
			270
		),
		(
			'shellfish',
			'\b(?:shellfish|shrimp|prawn|crab|lobster|crayfish|crawfish|crustaceans?|mollusks?|molluscs?|clam|mussel|oyster|scallop)\b',
			null,
			280
		),
		('sesame', '\b(?:sesame|tahini)\b', null, 290)
)
insert into public.food_compatibility_match_rules (
	tag_id,
	source_key,
	field_name,
	match_pattern,
	exclude_pattern,
	fact_type,
	source_type,
	confidence,
	priority
)
select
	tag.id,
	null,
	'generic_food_identity',
	rule.match_pattern,
	rule.exclude_pattern,
	'contains',
	'food_identity_taxonomy',
	'confirmed',
	rule.priority
from rule_values rule
join public.compatibility_tags tag
	on tag.slug = rule.tag_slug
on conflict (
	tag_id,
	source_key,
	field_name,
	match_pattern,
	fact_type
) do update
set
	exclude_pattern = excluded.exclude_pattern,
	source_type = excluded.source_type,
	confidence = excluded.confidence,
	priority = excluded.priority,
	enabled = true,
	updated_at = now();

create or replace function public.refresh_shared_product_compatibility_match_facts(
	p_shared_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_product public.shared_products%rowtype;
begin
	select *
	into v_product
	from public.shared_products
	where id = p_shared_product_id;

	delete from public.product_compatibility_facts
	where shared_product_id = p_shared_product_id
		and source_type in (
			'label_ingredient_field',
			'food_identity_taxonomy'
		);

	if v_product.id is null
		or v_product.food is null
		or jsonb_typeof(v_product.food) <> 'object' then
		return;
	end if;

	insert into public.product_compatibility_facts (
		shared_product_id,
		tag_id,
		fact_type,
		source_type,
		source_text,
		confidence
	)
	select distinct
		v_product.id,
		rule.tag_id,
		rule.fact_type,
		rule.source_type,
		match.source_text,
		rule.confidence
	from public.food_compatibility_match_rules rule
	cross join lateral (
		select case
			when rule.field_name = 'ingredients'
				and rule.source_type = 'label_ingredient_field'
				then v_product.food ->> 'ingredients'
			when rule.field_name = 'generic_food_identity'
				and rule.source_type = 'food_identity_taxonomy'
				and v_product.food ->> 'foodIdentityType' = 'generic'
				then concat_ws(
					' | ',
					nullif(v_product.food ->> 'description', ''),
					nullif(v_product.food ->> 'scientificName', ''),
					nullif(v_product.food ->> 'alternateDescription', ''),
					nullif(v_product.food ->> 'foodCategory', ''),
					nullif(v_product.food ->> 'preparation', '')
				)
			else null
		end as field_value
	) source
	cross join lateral (
		select public.compatibility_first_regex_match(
			source.field_value,
			rule.match_pattern
		) as source_text
	) match
	where rule.enabled
		and source.field_value is not null
		and match.source_text is not null
		and (
			rule.exclude_pattern is null
			or public.compatibility_first_regex_match(
				source.field_value,
				rule.exclude_pattern
			) is null
		)
		and (
			rule.source_key is null
			or rule.source_key = coalesce(
				nullif(v_product.food ->> 'sourceKey', ''),
				nullif(v_product.source, '')
			)
		);
end;
$$;

select public.refresh_shared_product_compatibility_match_facts(product.id)
from public.shared_products product
where product.status = 'active';

comment on table public.food_compatibility_match_rules is
	'Reviewed ingredient-statement and authoritative generic-food identity rules. Packaged product names and categories are never warning evidence.';

revoke all on function public.refresh_shared_product_compatibility_match_facts(uuid)
	from public, anon, authenticated;
grant execute on function public.refresh_shared_product_compatibility_match_facts(uuid)
	to service_role;

drop function if exists public.search_generic_food_records(text, integer);

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
	nutrients jsonb,
	measures jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
	with normalized_query as (
		select lower(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) as value
	),
	query_terms as (
		select term
		from normalized_query query
		cross join lateral regexp_split_to_table(query.value, '\s+') as term
		where term <> ''
	),
	ranked as (
		select
			record.application_food_id,
			record.dataset_key,
			record.source_food_key,
			record.description,
			record.alternate_description,
			record.food_group_name,
			record.scientific_name,
			record.preparation,
			record.external_reference,
			record.source_updated_at,
			dataset.source_key,
			source.display_name as source_display_name,
			dataset.display_name as dataset_display_name,
			dataset.version as dataset_version,
			dataset.source_url,
			dataset.license_name,
			dataset.license_url,
			dataset.attribution_text,
			record.metadata,
			case
				when lower(record.description) = query.value then 0
				when strpos(lower(record.description), query.value) = 1 then 1
				when not exists (
					select 1
					from query_terms
					where strpos(
						array_to_string(
							(regexp_split_to_array(lower(record.description), '\s+'))[1:3],
							' '
						),
						query_terms.term
					) = 0
				) then 2
				else 3
			end as relevance_tier,
			public.similarity(lower(record.description), query.value) as similarity_score
		from public.generic_food_records record
		join public.generic_food_datasets dataset
			on dataset.key = record.dataset_key
		join public.product_data_sources source
			on source.key = dataset.source_key
		cross join normalized_query query
		where query.value <> ''
			and dataset.active
			and dataset.import_enabled
			and source.enabled
			and record.measurement_basis = 'per_100g'
			and not exists (
				select 1
				from query_terms
				where strpos(record.search_text, query_terms.term) = 0
			)
		order by
			relevance_tier,
			similarity_score desc,
			length(record.description),
			record.description,
			record.application_food_id
		limit least(greatest(coalesce(p_limit, 100), 1), 100)
	)
	select
		ranked.application_food_id,
		ranked.dataset_key,
		ranked.source_food_key,
		ranked.description,
		ranked.alternate_description,
		ranked.food_group_name,
		ranked.scientific_name,
		ranked.preparation,
		ranked.external_reference,
		ranked.source_updated_at,
		ranked.source_key,
		ranked.source_display_name,
		ranked.dataset_display_name,
		ranked.dataset_version,
		ranked.source_url,
		ranked.license_name,
		ranked.license_url,
		ranked.attribution_text,
		ranked.metadata,
		coalesce(nutrients.rows, '[]'::jsonb) as nutrients,
		coalesce(measures.rows, '[]'::jsonb) as measures
	from ranked
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
				'metadata', nutrient.metadata
			)
			order by nutrient.nutrient_id, nutrient.source_nutrient_key
		) as rows
		from public.generic_food_nutrients nutrient
		where nutrient.dataset_key = ranked.dataset_key
			and nutrient.source_food_key = ranked.source_food_key
			and nutrient.mapping_status = 'canonical'
			and nutrient.nutrient_id is not null
			and nutrient.value_status = 'measured'
			and nutrient.amount_per_100g is not null
	) nutrients on true
	left join lateral (
		select jsonb_agg(
			jsonb_build_object(
				'sourceMeasureKey', measure.source_measure_key,
				'measureType', measure.measure_type,
				'description', measure.description,
				'gramWeight', measure.gram_weight,
				'sourceUpdatedAt', measure.source_updated_at,
				'metadata', measure.metadata
			)
			order by measure.gram_weight, measure.description
		) as rows
		from public.generic_food_measures measure
		where measure.dataset_key = ranked.dataset_key
			and measure.source_food_key = ranked.source_food_key
			and measure.is_household_measure
			and measure.gram_weight > 0
	) measures on true;
$$;

revoke all on function public.search_generic_food_records(text, integer)
	from public, anon;
grant execute on function public.search_generic_food_records(text, integer)
	to authenticated, service_role;
