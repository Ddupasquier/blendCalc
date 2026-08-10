alter table public.product_data_sources
	add column if not exists api_redistribution_allowed boolean not null default false;

update public.product_data_sources
set
	api_redistribution_allowed = true,
	canonical_policy_notes = concat_ws(
		E'\n',
		nullif(btrim(canonical_policy_notes), ''),
		'Approved canonical fields may be redistributed through the versioned blendCalc catalog API when field provenance and required attribution survive normalization.'
	)
where key in ('usda', 'health-canada-cnf', 'uk-cofid')
	and enabled
	and canonical_storage_allowed
	and canonical_policy_reviewed_at is not null
	and nullif(btrim(canonical_license_name), '') is not null
	and nullif(btrim(terms_url), '') is not null
	and nullif(btrim(attribution_text), '') is not null;

update public.product_data_sources
set api_redistribution_allowed = false
where key not in ('usda', 'health-canada-cnf', 'uk-cofid');

create temporary table api_v1_ingredient_provenance_backfill
on commit drop
as
select distinct on (product.id)
	product.id as shared_product_id,
	observation.id as observation_id,
	observation.source,
	observation.source_reference as observation_source_reference,
	jsonb_build_object(
		'ingredients', product.food -> 'ingredients',
		'ingredientList', coalesce(product.food -> 'ingredientList', '[]'::jsonb)
	) as field_value
from public.shared_products product
join public.shared_product_observations observation
	on observation.barcode = product.barcode
	and observation.source = 'usda'
	and observation.source_reference is not distinct from product.source_reference
join public.product_data_sources source
	on source.key = observation.source
	and source.enabled
	and source.canonical_storage_allowed
	and source.api_redistribution_allowed
where product.status = 'active'
	and product.source = 'usda'
	and nullif(btrim(product.food ->> 'ingredients'), '') is not null
	and lower(btrim(coalesce(
		observation.normalized_food ->> 'ingredients',
		observation.raw_payload ->> 'ingredients'
	))) = lower(btrim(product.food ->> 'ingredients'))
	and not exists (
		select 1
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = product.id
			and provenance.field_path = 'ingredients'
			and provenance.selected
	)
order by
	product.id,
	observation.observed_at desc,
	observation.id desc;

insert into public.shared_product_field_provenance (
	shared_product_id,
	observation_id,
	field_path,
	source_value,
	normalized_value,
	selected,
	confidence,
	verification_method
)
select
	backfill.shared_product_id,
	backfill.observation_id,
	'ingredients',
	backfill.field_value,
	backfill.field_value,
	true,
	'source-verified',
	'exact-barcode'
from api_v1_ingredient_provenance_backfill backfill
on conflict (shared_product_id, observation_id, field_path) do update
set
	source_value = excluded.source_value,
	normalized_value = excluded.normalized_value,
	selected = true,
	confidence = excluded.confidence,
	verification_method = excluded.verification_method;

update public.shared_products product
set
	food = jsonb_set(
		product.food,
		'{fieldProvenance}',
		coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
			|| jsonb_build_object(
				'ingredients',
				jsonb_build_object(
					'source', backfill.source,
					'sourceReference', backfill.observation_source_reference,
					'confidence', 'source-verified'
				)
			),
		true
	),
	canonical_provenance = jsonb_set(
		coalesce(product.canonical_provenance, '{}'::jsonb),
		'{ingredients}',
		jsonb_build_object(
			'source', backfill.source,
			'sourceReference', backfill.observation_source_reference,
			'observationId', backfill.observation_id,
			'confidence', 'source-verified',
			'verificationMethod', 'exact-barcode'
		),
		true
	),
	last_verified_at = now(),
	updated_at = now()
from api_v1_ingredient_provenance_backfill backfill
where product.id = backfill.shared_product_id;

create temporary table api_v1_category_provenance_backfill
on commit drop
as
select distinct on (product.id)
	product.id as shared_product_id,
	product.barcode,
	case
		when category_observation.source = 'fdc-branded-detail' then 'usda'
		else category_observation.source
	end as source,
	category_observation.source_reference,
	source.canonical_license_name as source_license,
	category_observation.source_payload as raw_payload,
	jsonb_build_object(
		'foodCategory', category.label,
		'categories', jsonb_build_array(category_observation.source_value)
	) as normalized_food,
	category_observation.source_value,
	category.label as normalized_value,
	category_observation.last_seen_at as observed_at,
	product.category_option_id,
	null::uuid as observation_id
from public.shared_products product
join public.custom_food_category_options category
	on category.id = product.category_option_id
	and category.enabled
join public.custom_food_category_observations category_observation
	on category_observation.query = product.barcode
join public.custom_food_category_mappings category_mapping
	on category_mapping.source_normalized_value =
		category_observation.normalized_value
	and category_mapping.category_option_id = product.category_option_id
	and category_mapping.confidence = 'exact'
join public.product_data_sources source
	on source.key = case
		when category_observation.source = 'fdc-branded-detail' then 'usda'
		else category_observation.source
	end
	and source.enabled
	and source.canonical_storage_allowed
	and source.api_redistribution_allowed
where product.status = 'active'
	and nullif(btrim(category_observation.source_reference), '') is not null
	and not exists (
		select 1
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = product.id
			and provenance.field_path = 'categories'
			and provenance.selected
	)
order by
	product.id,
	case category_observation.source
		when 'fdc-branded-detail' then 0
		else 1
	end,
	category_observation.last_seen_at desc,
	category_observation.id desc;

with inserted as (
	insert into public.shared_product_observations (
		barcode,
		source,
		source_reference,
		source_license,
		raw_payload,
		normalized_food,
		content_hash,
		observed_at
	)
	select
		backfill.barcode,
		backfill.source,
		backfill.source_reference,
		backfill.source_license,
		backfill.raw_payload,
		backfill.normalized_food,
		encode(
			extensions.digest(
				concat_ws(
					'|',
					backfill.barcode,
					backfill.source,
					backfill.source_reference,
					backfill.source_value,
					backfill.category_option_id
				),
				'sha256'
			),
			'hex'
		),
		backfill.observed_at
	from api_v1_category_provenance_backfill backfill
	returning id, barcode, source, source_reference
)
update api_v1_category_provenance_backfill backfill
set observation_id = inserted.id
from inserted
where inserted.barcode = backfill.barcode
	and inserted.source = backfill.source
	and inserted.source_reference = backfill.source_reference;

insert into public.shared_product_field_provenance (
	shared_product_id,
	observation_id,
	field_path,
	source_value,
	normalized_value,
	selected,
	confidence,
	verification_method
)
select
	backfill.shared_product_id,
	backfill.observation_id,
	'categories',
	to_jsonb(backfill.source_value),
	to_jsonb(backfill.normalized_value),
	true,
	'source-verified',
	'exact-barcode'
from api_v1_category_provenance_backfill backfill
where backfill.observation_id is not null;

update public.shared_products product
set
	food = jsonb_set(
		product.food,
		'{fieldProvenance}',
		coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
			|| jsonb_build_object(
				'categories',
				jsonb_build_object(
					'source', backfill.source,
					'sourceReference', backfill.source_reference,
					'confidence', 'source-verified'
				)
			),
		true
	),
	canonical_provenance = jsonb_set(
		coalesce(product.canonical_provenance, '{}'::jsonb),
		'{categories}',
		jsonb_build_object(
			'source', backfill.source,
			'sourceReference', backfill.source_reference,
			'observationId', backfill.observation_id,
			'confidence', 'source-verified',
			'verificationMethod', 'exact-barcode'
		),
		true
	),
	last_verified_at = now(),
	updated_at = now()
from api_v1_category_provenance_backfill backfill
where product.id = backfill.shared_product_id
	and backfill.observation_id is not null;

create temporary table api_v1_provenance_backfilled_products
on commit drop
as
select
	backfilled.shared_product_id,
	array_agg(distinct backfilled.field_path order by backfilled.field_path)
		as field_paths
from (
	select
		ingredient.shared_product_id,
		'ingredients'::text as field_path
	from api_v1_ingredient_provenance_backfill ingredient
	union all
	select
		category.shared_product_id,
		'categories'::text as field_path
	from api_v1_category_provenance_backfill category
	where category.observation_id is not null
) backfilled
group by backfilled.shared_product_id;

insert into public.shared_product_revisions (
	shared_product_id,
	revision_number,
	food,
	source,
	source_reference,
	category_option_id,
	supersedes_revision_id,
	change_summary,
	label_observed_at
)
select
	product.id,
	coalesce(latest.revision_number, 0) + 1,
	product.food,
	product.source,
	product.source_reference,
	product.category_option_id,
	latest.id,
	jsonb_build_object(
		'provenanceBackfill',
		to_jsonb(backfill.field_paths)
	),
	coalesce(latest.label_observed_at, now())
from public.shared_products product
join api_v1_provenance_backfilled_products backfill
	on backfill.shared_product_id = product.id
left join lateral (
	select
		revision.id,
		revision.revision_number,
		revision.label_observed_at
	from public.shared_product_revisions revision
	where revision.shared_product_id = product.id
	order by revision.revision_number desc
	limit 1
) latest on true;

create or replace function public.blendcalc_api_v1_source_is_eligible(
	p_source text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.product_data_sources source
		where source.key = case
				when p_source in ('community', 'community-reviewed')
					then 'shared-catalog'
				else p_source
			end
			and source.enabled
			and source.canonical_storage_allowed
			and source.api_redistribution_allowed
			and source.canonical_policy_reviewed_at is not null
			and nullif(btrim(source.canonical_license_name), '') is not null
			and nullif(btrim(source.terms_url), '') is not null
			and nullif(btrim(source.attribution_text), '') is not null
	);
$$;

create or replace function public.blendcalc_api_v1_product_readiness_reasons(
	p_shared_product_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_product public.shared_products%rowtype;
	v_reasons text[] := '{}'::text[];
	v_field text;
	v_key text;
	v_value jsonb;
	v_has_value boolean;
begin
	select *
	into v_product
	from public.shared_products product
	where product.id = p_shared_product_id;

	if not found or v_product.status <> 'active' then
		return array['inactive_product'];
	end if;

	if v_product.last_verified_at is null then
		v_reasons := array_append(v_reasons, 'missing_verification_timestamp');
	end if;
	if v_product.category_option_id is null or not exists (
		select 1
		from public.custom_food_category_options category
		where category.id = v_product.category_option_id
			and category.enabled
	) then
		v_reasons := array_append(v_reasons, 'missing_canonical_category');
	end if;
	if not exists (
		select 1
		from public.shared_product_revisions revision
		where revision.shared_product_id = v_product.id
	) then
		v_reasons := array_append(v_reasons, 'missing_current_revision');
	end if;

	foreach v_field in array array['productName', 'brandOwner']
	loop
		v_has_value := case
			when v_field = 'productName'
				then nullif(btrim(v_product.product_name), '') is not null
			else nullif(btrim(v_product.brand_owner), '') is not null
		end;
		if v_has_value and not exists (
			select 1
			from public.shared_product_field_provenance provenance
			where provenance.shared_product_id = v_product.id
				and provenance.field_path = v_field
				and provenance.selected
		) then
			v_reasons := array_append(
				v_reasons,
				'missing_field_provenance:' || v_field
			);
		end if;
	end loop;

	if not exists (
		select 1
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = v_product.id
			and provenance.field_path = 'categories'
			and provenance.selected
	) then
		v_reasons := array_append(
			v_reasons,
			'missing_field_provenance:categories'
		);
	end if;

	foreach v_field in array array[
		'ingredients',
		'structuredIngredients',
		'ingredientAnalysis',
		'additives',
		'allergens',
		'traces',
		'dietaryTags',
		'labels',
		'package',
		'sourceMetadata'
	]
	loop
		v_key := case
			when v_field = 'package' then 'packageQuantity'
			else v_field
		end;
		v_value := v_product.food -> v_key;
		v_has_value := case
			when v_field = 'ingredients'
				then nullif(btrim(v_product.food ->> v_key), '') is not null
			when jsonb_typeof(v_value) = 'array'
				then jsonb_array_length(v_value) > 0
			when jsonb_typeof(v_value) = 'object'
				then v_value <> '{}'::jsonb
			else false
		end;
		if v_has_value and not exists (
			select 1
			from public.shared_product_field_provenance provenance
			where provenance.shared_product_id = v_product.id
				and provenance.field_path = v_field
				and provenance.selected
		) then
			v_reasons := array_append(
				v_reasons,
				'missing_field_provenance:' || v_field
			);
		end if;
	end loop;

	if exists (
		select 1
		from public.shared_product_field_provenance provenance
		join public.shared_product_observations observation
			on observation.id = provenance.observation_id
		where provenance.shared_product_id = v_product.id
			and provenance.selected
			and (
				not public.blendcalc_api_v1_source_is_eligible(observation.source)
				or nullif(btrim(observation.source_reference), '') is null
			)
	) then
		v_reasons := array_append(v_reasons, 'field_source_not_redistributable');
	end if;

	if not exists (
		select 1
		from public.food_nutrients nutrient
		where nutrient.shared_product_id = v_product.id
	) then
		v_reasons := array_append(v_reasons, 'missing_normalized_nutrients');
	elsif exists (
		select 1
		from public.food_nutrients nutrient
		where nutrient.shared_product_id = v_product.id
			and (
				not public.blendcalc_api_v1_source_is_eligible(nutrient.source)
				or nullif(btrim(nutrient.source_reference), '') is null
				or nullif(btrim(nutrient.confidence), '') is null
			)
	) then
		v_reasons := array_append(v_reasons, 'nutrient_source_not_redistributable');
	end if;

	if exists (
		select 1
		from public.food_servings serving
		where serving.shared_product_id = v_product.id
			and (
				not public.blendcalc_api_v1_source_is_eligible(serving.source)
				or nullif(btrim(serving.source_reference), '') is null
				or nullif(btrim(serving.confidence), '') is null
				or serving.gram_weight <= 0
			)
	) then
		v_reasons := array_append(v_reasons, 'serving_source_not_redistributable');
	end if;

	return v_reasons;
end;
$$;

create or replace view public.blendcalc_api_v1_product_readiness
with (security_invoker = true)
as
select
	product.id as shared_product_id,
	product.barcode,
	product.product_name,
	public.blendcalc_api_v1_product_readiness_reasons(product.id) as reasons,
	cardinality(
		public.blendcalc_api_v1_product_readiness_reasons(product.id)
	) = 0 as publishable
from public.shared_products product
where product.status = 'active';

create or replace function public.get_blendcalc_product_v1(
	p_barcode text
)
returns table (
	id uuid,
	barcode text,
	product_name text,
	brand_owner text,
	category_option_id text,
	compatibility_summary jsonb,
	canonical_provenance jsonb,
	food jsonb,
	source text,
	source_reference text,
	confidence text,
	created_at timestamptz,
	updated_at timestamptz,
	last_verified_at timestamptz,
	current_revision_id uuid,
	current_revision_number integer,
	revision_created_at timestamptz,
	label_observed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
	select
		product.id,
		product.barcode,
		product.product_name,
		product.brand_owner,
		product.category_option_id,
		product.compatibility_summary,
		product.canonical_provenance,
		product.food,
		product.source,
		product.source_reference,
		product.confidence,
		product.created_at,
		product.updated_at,
		product.last_verified_at,
		revision.id,
		revision.revision_number,
		revision.created_at,
		revision.label_observed_at
	from public.shared_products product
	left join lateral (
		select
			product_revision.id,
			product_revision.revision_number,
			product_revision.created_at,
			product_revision.label_observed_at
		from public.shared_product_revisions product_revision
		where product_revision.shared_product_id = product.id
		order by product_revision.revision_number desc
		limit 1
	) revision on true
	where product.status = 'active'
		and cardinality(
			public.blendcalc_api_v1_product_readiness_reasons(product.id)
		) = 0
		and product.barcode = p_barcode
	limit 1;
$$;

create or replace function public.search_blendcalc_products_v1(
	p_query text,
	p_terms text[],
	p_limit integer default 15,
	p_offset integer default 0
)
returns table (
	id uuid,
	barcode text,
	product_name text,
	brand_owner text,
	category_option_id text,
	compatibility_summary jsonb,
	canonical_provenance jsonb,
	food jsonb,
	source text,
	source_reference text,
	confidence text,
	created_at timestamptz,
	updated_at timestamptz,
	last_verified_at timestamptz,
	current_revision_id uuid,
	current_revision_number integer,
	revision_created_at timestamptz,
	label_observed_at timestamptz,
	total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
	with input as (
		select
			lower(btrim(p_query)) as normalized_query,
			array(
				select distinct lower(btrim(term))
				from unnest(coalesce(p_terms, array[]::text[])) term
				where btrim(term) <> ''
			) as terms,
			greatest(1, least(coalesce(p_limit, 15), 50)) as result_limit,
			greatest(0, least(coalesce(p_offset, 0), 1000)) as result_offset
	),
	ranked as (
		select
			product.id,
			product.barcode,
			product.product_name,
			product.brand_owner,
			product.category_option_id,
			product.compatibility_summary,
			product.canonical_provenance,
			product.food,
			product.source,
			product.source_reference,
			product.confidence,
			product.created_at,
			product.updated_at,
			product.last_verified_at,
			revision.id as current_revision_id,
			revision.revision_number as current_revision_number,
			revision.created_at as revision_created_at,
			revision.label_observed_at,
			case
				when product_text.name_text = input.normalized_query then 0
				when strpos(product_text.name_text, input.normalized_query) = 1 then 1
				when not exists (
					select 1
					from unnest(input.terms) term
					where strpos(product_text.early_name_text, term) = 0
				) then 2
				when strpos(product_text.name_text, input.normalized_query) > 0 then 3
				else 4
			end as relevance_tier,
			coalesce((
				select min(nullif(strpos(product_text.name_text, term), 0))
				from unnest(input.terms) term
			), 2147483647) as first_match_position
		from public.shared_products product
		cross join input
		cross join lateral (
			select
				lower(product.product_name) as name_text,
				array_to_string(
					(regexp_split_to_array(
						lower(product.product_name),
						'[^[:alnum:]]+'
					))[1:3],
					' '
				) as early_name_text
		) product_text
		left join lateral (
			select
				product_revision.id,
				product_revision.revision_number,
				product_revision.created_at,
				product_revision.label_observed_at
			from public.shared_product_revisions product_revision
			where product_revision.shared_product_id = product.id
			order by product_revision.revision_number desc
			limit 1
		) revision on true
		where product.status = 'active'
			and cardinality(
				public.blendcalc_api_v1_product_readiness_reasons(product.id)
			) = 0
			and cardinality(input.terms) > 0
			and not exists (
				select 1
				from unnest(input.terms) term
				where strpos(
					lower(coalesce(product.search_text, product.product_name, '')),
					term
				) = 0
			)
	),
	counted as (
		select ranked.*, count(*) over () as total_count
		from ranked
	)
	select
		counted.id,
		counted.barcode,
		counted.product_name,
		counted.brand_owner,
		counted.category_option_id,
		counted.compatibility_summary,
		counted.canonical_provenance,
		counted.food,
		counted.source,
		counted.source_reference,
		counted.confidence,
		counted.created_at,
		counted.updated_at,
		counted.last_verified_at,
		counted.current_revision_id,
		counted.current_revision_number,
		counted.revision_created_at,
		counted.label_observed_at,
		counted.total_count
	from counted
	order by
		counted.relevance_tier,
		counted.first_match_position,
		counted.product_name,
		counted.id
	limit (select result_limit from input)
	offset (select result_offset from input);
$$;

revoke all on function public.blendcalc_api_v1_source_is_eligible(text)
	from public, anon, authenticated;
revoke all on function public.blendcalc_api_v1_product_readiness_reasons(uuid)
	from public, anon, authenticated;
revoke all on table public.blendcalc_api_v1_product_readiness
	from public, anon, authenticated;
revoke all on function public.get_blendcalc_product_v1(text)
	from public, anon;
revoke all on function public.search_blendcalc_products_v1(
	text,
	text[],
	integer,
	integer
) from public, anon;

grant execute on function public.blendcalc_api_v1_source_is_eligible(text)
	to service_role;
grant execute on function public.blendcalc_api_v1_product_readiness_reasons(uuid)
	to service_role;
grant select on table public.blendcalc_api_v1_product_readiness
	to service_role;
grant execute on function public.get_blendcalc_product_v1(text)
	to authenticated, service_role;
grant execute on function public.search_blendcalc_products_v1(
	text,
	text[],
	integer,
	integer
) to authenticated, service_role;
