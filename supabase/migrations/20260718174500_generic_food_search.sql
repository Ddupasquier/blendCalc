alter table public.generic_food_records
	add column application_food_id bigint generated always as (
		-(
			(('x' || substr(md5(dataset_key || ':' || source_food_key), 1, 13))::bit(52)::bigint)
			+ 1
		)
	) stored;

create unique index generic_food_records_application_food_id_idx
	on public.generic_food_records (application_food_id);

create or replace function public.search_generic_food_records(
	p_query text,
	p_limit integer default 100
)
returns table (
	application_food_id bigint,
	dataset_key text,
	source_food_key text,
	description text,
	food_group_name text,
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
			record.food_group_name,
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
		ranked.food_group_name,
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

create or replace function public.food_source_key(p_food jsonb)
returns text
language sql
immutable
set search_path = public
as $$
	select case lower(coalesce(nullif(p_food ->> 'sourceKey', ''), ''))
		when 'usda' then 'usda'
		when 'fdc' then 'usda'
		when 'open-food-facts' then 'open-food-facts'
		when 'health-canada-cnf' then 'national-dataset'
		when 'uk-cofid' then 'national-dataset'
		when 'fsanz-afcd' then 'national-dataset'
		when 'national-dataset' then 'national-dataset'
		when 'shared-catalog' then 'shared-catalog'
		when 'community-reviewed' then 'shared-catalog'
		when 'community' then 'shared-catalog'
		when 'custom' then 'custom'
		else case lower(coalesce(nullif(p_food ->> 'barcodeSource', ''), ''))
			when 'usda' then 'usda'
			when 'open-food-facts' then 'open-food-facts'
			when 'community' then 'shared-catalog'
			else case
				when lower(coalesce(p_food ->> 'customFood', 'false')) = 'true' then 'custom'
				when nullif(p_food ->> 'sharedProductId', '') is not null then 'shared-catalog'
				else 'usda'
			end
		end
	end;
$$;

create or replace function public.food_trust_status(p_food jsonb)
returns text
language sql
immutable
set search_path = public
as $$
	select case
		when lower(coalesce(p_food ->> 'customFood', 'false')) = 'true'
			and nullif(p_food ->> 'sharedProductId', '') is null
			then 'user-private'
		when lower(coalesce(p_food ->> 'sharedProductConfidence', '')) in (
			'source-verified',
			'imported',
			'corroborated',
			'moderator-reviewed'
		) then lower(p_food ->> 'sharedProductConfidence')
		when public.food_source_key(p_food) = 'usda' then 'source-verified'
		when public.food_source_key(p_food) in ('open-food-facts', 'national-dataset') then 'imported'
		when public.food_source_key(p_food) = 'shared-catalog' then 'moderator-reviewed'
		else 'user-private'
	end;
$$;

alter table public.user_food_list_items
	drop constraint user_food_list_items_source_key_check;

alter table public.user_food_list_items
	add constraint user_food_list_items_source_key_check
		check (source_key in (
			'usda',
			'open-food-facts',
			'national-dataset',
			'shared-catalog',
			'custom'
		));

alter table public.custom_foods
	drop constraint custom_foods_source_key_check;

alter table public.custom_foods
	add constraint custom_foods_source_key_check
		check (source_key in (
			'usda',
			'open-food-facts',
			'national-dataset',
			'shared-catalog',
			'custom'
		));

create or replace function public.resolve_user_food_list_catalog_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_barcode text := public.food_normalized_barcode(new.food);
	v_shared_product_id uuid;
	v_shared_product_source text;
	v_shared_product_confidence text;
	v_pending_submission_id uuid;
	v_fallback_source text;
begin
	if v_barcode is not null then
		select product.id, product.source, product.confidence
		into v_shared_product_id, v_shared_product_source, v_shared_product_confidence
		from public.shared_products product
		where product.barcode = v_barcode
			and product.status = 'active'
		limit 1;

		select submission.id
		into v_pending_submission_id
		from public.shared_product_submissions submission
		where submission.submitted_by = new.user_id
			and submission.barcode = v_barcode
			and submission.status = 'pending'
		order by submission.created_at desc, submission.id desc
		limit 1;
	end if;

	v_fallback_source := public.food_source_key(new.food);
	new.shared_product_id := v_shared_product_id;
	new.shared_product_submission_id := v_pending_submission_id;
	new.source_key := case
		when v_shared_product_source = 'usda' then 'usda'
		when v_shared_product_source = 'open-food-facts' then 'open-food-facts'
		when v_shared_product_source = 'community-reviewed' then 'shared-catalog'
		else v_fallback_source
	end;
	new.trust_status := case
		when v_pending_submission_id is not null then 'pending-review'
		when v_shared_product_id is not null
			and v_shared_product_confidence in (
				'source-verified',
				'imported',
				'corroborated',
				'moderator-reviewed'
			) then v_shared_product_confidence
		when lower(coalesce(new.food ->> 'customFood', 'false')) = 'true'
			then 'user-private'
		when v_fallback_source = 'usda' then 'source-verified'
		when v_fallback_source in ('open-food-facts', 'national-dataset') then 'imported'
		else 'user-private'
	end;

	return new;
end;
$$;

insert into public.ingredient_provenance_options (
	dimension,
	value,
	filter_label,
	badge_label,
	badge_tone,
	display_order,
	filter_enabled,
	badge_enabled,
	description
)
values (
	'source',
	'national-dataset',
	'National food databases',
	'National',
	'info',
	25,
	true,
	true,
	'Government food-composition datasets imported into blendCalc with source attribution.'
)
on conflict (dimension, value) do update
set
	filter_label = excluded.filter_label,
	badge_label = excluded.badge_label,
	badge_tone = excluded.badge_tone,
	display_order = excluded.display_order,
	filter_enabled = excluded.filter_enabled,
	badge_enabled = excluded.badge_enabled,
	description = excluded.description,
	updated_at = now();

revoke all on function public.search_generic_food_records(text, integer)
	from public, anon;
grant execute on function public.search_generic_food_records(text, integer)
	to authenticated, service_role;
