insert into public.nutrition_completeness_profiles (
	key,
	display_name,
	food_scope,
	region_code,
	complete_label,
	resolved_label,
	partial_label,
	limited_label,
	description,
	source_key,
	source_reference,
	is_default,
	enabled
)
values (
	'api-v1-packaged-core-v1',
	'blendCalc API v1 packaged-food core',
	'packaged',
	'',
	'API core complete',
	'API core resolved',
	'API core partial',
	'API core limited',
	'Core numeric nutrition required before a packaged product can be published through blendCalc API v1. This is a publication-quality profile, not a claim of legal label completeness.',
	'blendcalc-nutrition-policy',
	'blendCalc API packaged-food publication nutrition policy version 1',
	false,
	true
)
on conflict (key) do update
set
	display_name = excluded.display_name,
	food_scope = excluded.food_scope,
	region_code = excluded.region_code,
	complete_label = excluded.complete_label,
	resolved_label = excluded.resolved_label,
	partial_label = excluded.partial_label,
	limited_label = excluded.limited_label,
	description = excluded.description,
	source_key = excluded.source_key,
	source_reference = excluded.source_reference,
	is_default = excluded.is_default,
	enabled = excluded.enabled;

with profile_nutrients (
	nutrient_number,
	display_order,
	reason
) as (
	values
		('208', 10, 'Energy is required for API calculations.'),
		('204', 20, 'Total fat is a core macronutrient.'),
		('606', 30, 'Saturated fat is a common packaged-food label value.'),
		('205', 40, 'Total carbohydrate is a core macronutrient.'),
		('291', 50, 'Dietary fiber is required for goal and comparison calculations.'),
		('269', 60, 'Total sugars is required for packaged-food comparison.'),
		('203', 70, 'Protein is a core macronutrient.'),
		('307', 80, 'Sodium is required for packaged-food comparison.')
)
insert into public.nutrition_completeness_profile_nutrients (
	profile_key,
	nutrient_id,
	requirement_level,
	display_order,
	reason
)
select
	'api-v1-packaged-core-v1',
	definition.nutrient_id,
	'required',
	profile_nutrient.display_order,
	profile_nutrient.reason
from profile_nutrients profile_nutrient
join public.nutrient_definitions definition
	on definition.nutrient_number = profile_nutrient.nutrient_number
on conflict (profile_key, nutrient_id) do update
set
	requirement_level = excluded.requirement_level,
	display_order = excluded.display_order,
	reason = excluded.reason;

do $$
declare
	v_requirement_count integer;
begin
	select count(*)
	into v_requirement_count
	from public.nutrition_completeness_profile_nutrients requirement
	where requirement.profile_key = 'api-v1-packaged-core-v1'
		and requirement.requirement_level = 'required';

	if v_requirement_count <> 8 then
		raise exception 'API v1 packaged nutrition profile expected 8 required nutrients, found %',
			v_requirement_count;
	end if;
end;
$$;

create table public.blendcalc_api_publication_profiles (
	key text primary key check (btrim(key) <> ''),
	api_major integer not null check (api_major > 0),
	policy_version integer not null check (policy_version > 0),
	resource_scope text not null check (
		resource_scope in ('packaged-product', 'generic-food')
	),
	display_name text not null check (btrim(display_name) <> ''),
	description text not null check (btrim(description) <> ''),
	nutrition_profile_key text not null
		references public.nutrition_completeness_profiles(key) on delete restrict,
	required_field_paths text[] not null,
	recommended_field_paths text[] not null default '{}'::text[],
	require_valid_gtin boolean not null default true,
	require_primary_serving boolean not null default true,
	require_canonical_nutrient_mapping boolean not null default true,
	minimum_allergen_evidence text not null default 'ingredient-list' check (
		minimum_allergen_evidence in ('unknown', 'ingredient-list', 'explicit-declaration')
	),
	accepted_nutrient_value_statuses text[] not null default array[
		'reported',
		'reported-zero',
		'derived'
	],
	blocked_conflict_severities text[] not null default array['medium', 'high'],
	max_verification_age_days integer check (max_verification_age_days > 0),
	source_key text not null
		references public.product_data_sources(key) on delete restrict,
	source_reference text not null check (btrim(source_reference) <> ''),
	reviewed_at timestamptz not null,
	is_default boolean not null default false,
	enabled boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint blendcalc_api_publication_profiles_required_fields_check check (
		cardinality(required_field_paths) > 0
		and required_field_paths <@ array[
			'productName',
			'brandOwner',
			'categories',
			'ingredients',
			'sourceMetadata',
			'marketCountries'
		]::text[]
	),
	constraint blendcalc_api_publication_profiles_recommended_fields_check check (
		recommended_field_paths <@ array[
			'package',
			'structuredIngredients',
			'ingredientAnalysis',
			'additives',
			'allergens',
			'traces',
			'precautionaryStatements',
			'dietaryTags',
			'labels'
		]::text[]
	),
	constraint blendcalc_api_publication_profiles_nutrient_statuses_check check (
		cardinality(accepted_nutrient_value_statuses) > 0
		and accepted_nutrient_value_statuses <@ array[
			'reported',
			'reported-zero',
			'derived'
		]::text[]
	),
	constraint blendcalc_api_publication_profiles_conflict_severities_check check (
		blocked_conflict_severities <@ array['low', 'medium', 'high']::text[]
	)
);

create trigger set_blendcalc_api_publication_profiles_updated_at
	before update on public.blendcalc_api_publication_profiles
	for each row execute function public.set_updated_at();

create unique index blendcalc_api_publication_profiles_default_idx
	on public.blendcalc_api_publication_profiles (api_major, resource_scope)
	where is_default and enabled;

create index blendcalc_api_publication_profiles_runtime_idx
	on public.blendcalc_api_publication_profiles (
		api_major,
		resource_scope,
		is_default desc,
		policy_version desc
	)
	where enabled;

insert into public.blendcalc_api_publication_profiles (
	key,
	api_major,
	policy_version,
	resource_scope,
	display_name,
	description,
	nutrition_profile_key,
	required_field_paths,
	recommended_field_paths,
	require_valid_gtin,
	require_primary_serving,
	require_canonical_nutrient_mapping,
	minimum_allergen_evidence,
	accepted_nutrient_value_statuses,
	blocked_conflict_severities,
	max_verification_age_days,
	source_key,
	source_reference,
	reviewed_at,
	is_default,
	enabled
)
values (
	'api-v1-packaged-product-v1',
	1,
	1,
	'packaged-product',
	'blendCalc API v1 packaged product',
	'Fail-closed publication policy for exact-GTIN packaged products. Canonical catalog storage remains broader than public API publication.',
	'api-v1-packaged-core-v1',
	array[
		'productName',
		'brandOwner',
		'categories',
		'ingredients',
		'sourceMetadata',
		'marketCountries'
	],
	array[
		'package',
		'structuredIngredients',
		'ingredientAnalysis',
		'additives',
		'allergens',
		'traces',
		'precautionaryStatements',
		'dietaryTags',
		'labels'
	],
	true,
	true,
	true,
	'ingredient-list',
	array['reported', 'reported-zero', 'derived'],
	array['medium', 'high'],
	365,
	'blendcalc-nutrition-policy',
	'blendCalc API v1 packaged-product publication policy version 1',
	'2026-08-03T00:00:00Z'::timestamptz,
	true,
	true
)
on conflict (key) do update
set
	api_major = excluded.api_major,
	policy_version = excluded.policy_version,
	resource_scope = excluded.resource_scope,
	display_name = excluded.display_name,
	description = excluded.description,
	nutrition_profile_key = excluded.nutrition_profile_key,
	required_field_paths = excluded.required_field_paths,
	recommended_field_paths = excluded.recommended_field_paths,
	require_valid_gtin = excluded.require_valid_gtin,
	require_primary_serving = excluded.require_primary_serving,
	require_canonical_nutrient_mapping = excluded.require_canonical_nutrient_mapping,
	minimum_allergen_evidence = excluded.minimum_allergen_evidence,
	accepted_nutrient_value_statuses = excluded.accepted_nutrient_value_statuses,
	blocked_conflict_severities = excluded.blocked_conflict_severities,
	max_verification_age_days = excluded.max_verification_age_days,
	source_key = excluded.source_key,
	source_reference = excluded.source_reference,
	reviewed_at = excluded.reviewed_at,
	is_default = excluded.is_default,
	enabled = excluded.enabled;

alter table public.blendcalc_api_publication_profiles enable row level security;
alter table public.blendcalc_api_publication_profiles force row level security;

revoke all on table public.blendcalc_api_publication_profiles
	from public, anon, authenticated;
grant all on table public.blendcalc_api_publication_profiles to service_role;

update public.food_nutrients nutrient
set
	source_nutrient_key = mapping.source_nutrient_key,
	mapping_status = 'canonical',
	mapping_method = mapping.mapping_method,
	mapping_review_reference = mapping.review_reference
from (
	select distinct on (
		source_mapping.source_key,
		source_mapping.source_nutrient_key,
		source_mapping.nutrient_id
	)
		source_mapping.*
	from public.nutrient_source_mappings source_mapping
	where source_mapping.source_nutrient_key = source_mapping.nutrient_id::text
		and source_mapping.enabled
		and source_mapping.review_status = 'approved'
	order by
		source_mapping.source_key,
		source_mapping.source_nutrient_key,
		source_mapping.nutrient_id,
		source_mapping.priority,
		source_mapping.source_unit_name
) mapping
where nutrient.source_nutrient_key is null
	and nutrient.mapping_status = 'unknown'
	and mapping.source_key = nutrient.source
	and mapping.nutrient_id = nutrient.nutrient_id;

comment on table public.blendcalc_api_publication_profiles is
	'Database-owned, versioned hard gates that keep canonical catalog storage broader than public API publication.';
