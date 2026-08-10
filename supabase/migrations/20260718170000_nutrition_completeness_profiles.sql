insert into public.product_data_sources (
	key,
	display_name,
	source_type,
	homepage_url,
	attribution_text,
	enabled,
	provenance
)
values
	(
		'blendcalc-nutrition-policy',
		'blendCalc nutrition completeness policy',
		'internal_catalog',
		null,
		'blendCalc application policy',
		true,
		jsonb_build_object(
			'policy_scope', 'generic_food_core_nutrition',
			'policy_version', '2026-07-18'
		)
	),
	(
		'fda-nutrition-facts',
		'U.S. FDA Nutrition Facts Label',
		'standards_api',
		'https://www.fda.gov/food/nutrition-facts-label/how-understand-and-use-nutrition-facts-label',
		'U.S. Food and Drug Administration',
		true,
		jsonb_build_object(
			'standard_scope', 'us_packaged_food_label',
			'accessed_on', '2026-07-18'
		)
	)
on conflict (key) do update
set
	display_name = excluded.display_name,
	source_type = excluded.source_type,
	homepage_url = excluded.homepage_url,
	attribution_text = excluded.attribution_text,
	enabled = excluded.enabled,
	provenance = excluded.provenance;

create table public.nutrition_completeness_profiles (
	key text primary key check (btrim(key) <> ''),
	display_name text not null check (btrim(display_name) <> ''),
	food_scope text not null check (food_scope in ('generic', 'packaged')),
	region_code text not null default '' check (region_code = upper(region_code)),
	complete_label text not null check (btrim(complete_label) <> ''),
	resolved_label text not null check (btrim(resolved_label) <> ''),
	partial_label text not null check (btrim(partial_label) <> ''),
	limited_label text not null check (btrim(limited_label) <> ''),
	description text not null check (btrim(description) <> ''),
	source_key text not null references public.product_data_sources(key) on delete restrict,
	source_reference text not null check (btrim(source_reference) <> ''),
	is_default boolean not null default false,
	enabled boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create trigger set_nutrition_completeness_profiles_updated_at
	before update on public.nutrition_completeness_profiles
	for each row execute function public.set_updated_at();

create unique index nutrition_completeness_profiles_default_idx
	on public.nutrition_completeness_profiles (food_scope, region_code)
	where is_default and enabled;

create index nutrition_completeness_profiles_runtime_idx
	on public.nutrition_completeness_profiles (
		food_scope,
		region_code,
		is_default desc,
		key
	)
	where enabled;

create table public.nutrition_completeness_profile_nutrients (
	profile_key text not null references public.nutrition_completeness_profiles(key) on delete cascade,
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete restrict,
	requirement_level text not null check (requirement_level in ('required', 'recommended')),
	display_order integer not null check (display_order >= 0),
	reason text not null check (btrim(reason) <> ''),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (profile_key, nutrient_id),
	unique (profile_key, display_order)
);

create trigger set_nutrition_completeness_profile_nutrients_updated_at
	before update on public.nutrition_completeness_profile_nutrients
	for each row execute function public.set_updated_at();

create index nutrition_completeness_profile_nutrients_runtime_idx
	on public.nutrition_completeness_profile_nutrients (
		profile_key,
		requirement_level,
		display_order,
		nutrient_id
	);

create index nutrition_completeness_profile_nutrients_definition_idx
	on public.nutrition_completeness_profile_nutrients (nutrient_id, profile_key);

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
values
	(
		'generic-core-v1',
		'Generic food core nutrition',
		'generic',
		'',
		'Complete',
		'Resolved',
		'Partial',
		'Limited',
		'Core nutrients needed for reliable food calculations, with common comparison nutrients tracked separately.',
		'blendcalc-nutrition-policy',
		'blendCalc generic food completeness policy version 2026-07-18',
		true,
		true
	),
	(
		'us-packaged-label-v1',
		'U.S. packaged food label nutrition',
		'packaged',
		'US',
		'Complete label',
		'Resolved label',
		'Partial label',
		'Limited label',
		'Nutrients normally declared on the current U.S. Nutrition Facts label.',
		'fda-nutrition-facts',
		'https://www.fda.gov/food/nutrition-facts-label/how-understand-and-use-nutrition-facts-label',
		true,
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
	profile_key,
	nutrient_number,
	requirement_level,
	display_order,
	reason
) as (
	values
		('generic-core-v1', '208', 'required', 10, 'Energy is needed for calorie calculations.'),
		('generic-core-v1', '204', 'required', 20, 'Total fat is a core macronutrient.'),
		('generic-core-v1', '205', 'required', 30, 'Total carbohydrate is a core macronutrient.'),
		('generic-core-v1', '203', 'required', 40, 'Protein is a core macronutrient.'),
		('generic-core-v1', '307', 'required', 50, 'Sodium is required by blendCalc manual entry and comparison rules.'),
		('generic-core-v1', '291', 'recommended', 60, 'Dietary fiber improves food comparison but is not always reported for generic records.'),
		('generic-core-v1', '269', 'recommended', 70, 'Total sugars improves food comparison but is not always reported for generic records.'),
		('us-packaged-label-v1', '208', 'required', 10, 'Calories are declared on the U.S. Nutrition Facts label.'),
		('us-packaged-label-v1', '204', 'required', 20, 'Total fat is declared on the U.S. Nutrition Facts label.'),
		('us-packaged-label-v1', '606', 'required', 30, 'Saturated fat is declared on the U.S. Nutrition Facts label.'),
		('us-packaged-label-v1', '605', 'required', 40, 'Trans fat is declared on the U.S. Nutrition Facts label.'),
		('us-packaged-label-v1', '601', 'required', 50, 'Cholesterol is declared on the U.S. Nutrition Facts label.'),
		('us-packaged-label-v1', '307', 'required', 60, 'Sodium is declared on the U.S. Nutrition Facts label.'),
		('us-packaged-label-v1', '205', 'required', 70, 'Total carbohydrate is declared on the U.S. Nutrition Facts label.'),
		('us-packaged-label-v1', '291', 'required', 80, 'Dietary fiber is declared on the U.S. Nutrition Facts label.'),
		('us-packaged-label-v1', '269', 'required', 90, 'Total sugars is declared on the U.S. Nutrition Facts label.'),
		('us-packaged-label-v1', '539', 'required', 100, 'Added sugars is declared on the U.S. Nutrition Facts label, subject to FDA exceptions.'),
		('us-packaged-label-v1', '203', 'required', 110, 'Protein is declared on the U.S. Nutrition Facts label.'),
		('us-packaged-label-v1', '328', 'required', 120, 'Vitamin D is a mandatory U.S. label micronutrient.'),
		('us-packaged-label-v1', '301', 'required', 130, 'Calcium is a mandatory U.S. label micronutrient.'),
		('us-packaged-label-v1', '303', 'required', 140, 'Iron is a mandatory U.S. label micronutrient.'),
		('us-packaged-label-v1', '306', 'required', 150, 'Potassium is a mandatory U.S. label micronutrient.')
)
insert into public.nutrition_completeness_profile_nutrients (
	profile_key,
	nutrient_id,
	requirement_level,
	display_order,
	reason
)
select
	profile_nutrients.profile_key,
	definitions.nutrient_id,
	profile_nutrients.requirement_level,
	profile_nutrients.display_order,
	profile_nutrients.reason
from profile_nutrients
join public.nutrient_definitions definitions
	on definitions.nutrient_number = profile_nutrients.nutrient_number
on conflict (profile_key, nutrient_id) do update
set
	requirement_level = excluded.requirement_level,
	display_order = excluded.display_order,
	reason = excluded.reason;

do $$
declare
	v_generic_count integer;
	v_packaged_count integer;
begin
	select count(*) into v_generic_count
	from public.nutrition_completeness_profile_nutrients
	where profile_key = 'generic-core-v1';

	select count(*) into v_packaged_count
	from public.nutrition_completeness_profile_nutrients
	where profile_key = 'us-packaged-label-v1';

	if v_generic_count <> 7 then
		raise exception 'Generic nutrition profile expected 7 nutrients, found %', v_generic_count;
	end if;

	if v_packaged_count <> 15 then
		raise exception 'U.S. packaged nutrition profile expected 15 nutrients, found %', v_packaged_count;
	end if;
end;
$$;

alter table public.nutrition_completeness_profiles enable row level security;
alter table public.nutrition_completeness_profiles force row level security;
alter table public.nutrition_completeness_profile_nutrients enable row level security;
alter table public.nutrition_completeness_profile_nutrients force row level security;

create policy "Authenticated users can read nutrition completeness profiles"
	on public.nutrition_completeness_profiles
	for select
	to authenticated
	using (enabled);

create policy "Authenticated users can read nutrition completeness profile nutrients"
	on public.nutrition_completeness_profile_nutrients
	for select
	to authenticated
	using (
		exists (
			select 1
			from public.nutrition_completeness_profiles profiles
			where profiles.key = profile_key
				and profiles.enabled
		)
	);

revoke all on table public.nutrition_completeness_profiles from public, anon, authenticated;
revoke all on table public.nutrition_completeness_profile_nutrients from public, anon, authenticated;

grant select on table public.nutrition_completeness_profiles to authenticated;
grant select on table public.nutrition_completeness_profile_nutrients to authenticated;

grant all on table public.nutrition_completeness_profiles to service_role;
grant all on table public.nutrition_completeness_profile_nutrients to service_role;
