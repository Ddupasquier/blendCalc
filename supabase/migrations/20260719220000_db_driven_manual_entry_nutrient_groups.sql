drop trigger if exists sync_nutrient_manual_entry_observations_after_change
	on public.nutrient_manual_entry_observations;

alter table public.nutrient_manual_entry_groups
	add column if not exists group_role text not null default 'display';

alter table public.nutrient_manual_entry_groups
	drop constraint if exists nutrient_manual_entry_groups_group_role_check;

alter table public.nutrient_manual_entry_groups
	add constraint nutrient_manual_entry_groups_group_role_check
	check (group_role in ('display', 'unclassified'));

alter table public.nutrient_manual_entry_fields
	add column if not exists classification_status text not null default 'approved',
	add column if not exists classification_source_key text not null default 'blendcalc-manual-entry-policy',
	add column if not exists classification_reference text not null default 'manual-entry-policy-v1',
	add column if not exists classification_version integer not null default 1,
	add column if not exists classification_notes text,
	add column if not exists replacement_nutrient_id bigint references public.nutrient_definitions(nutrient_id) on delete restrict,
	add column if not exists reviewed_at timestamptz;

alter table public.nutrient_manual_entry_fields
	drop constraint if exists nutrient_manual_entry_fields_classification_status_check;

alter table public.nutrient_manual_entry_fields
	add constraint nutrient_manual_entry_fields_classification_status_check
	check (classification_status in ('approved', 'pending_review', 'retired'));

alter table public.nutrient_manual_entry_fields
	drop constraint if exists nutrient_manual_entry_fields_classification_version_check;

alter table public.nutrient_manual_entry_fields
	add constraint nutrient_manual_entry_fields_classification_version_check
	check (classification_version > 0);

alter table public.nutrient_manual_entry_fields
	drop constraint nutrient_manual_entry_fields_nutrient_type_check;

alter table public.nutrient_manual_entry_fields
	add constraint nutrient_manual_entry_fields_nutrient_type_check
	check (
		nutrient_type in (
			'energy',
			'macro',
			'fat',
			'carbohydrate',
			'mineral',
			'vitamin',
			'amino_acid',
			'carotenoid',
			'proximate',
			'other'
		)
	);

alter table public.nutrient_manual_entry_observations
	drop constraint nutrient_manual_entry_observations_nutrient_type_check;

alter table public.nutrient_manual_entry_observations
	add constraint nutrient_manual_entry_observations_nutrient_type_check
	check (
		nutrient_type in (
			'energy',
			'macro',
			'fat',
			'carbohydrate',
			'mineral',
			'vitamin',
			'amino_acid',
			'carotenoid',
			'proximate',
			'other'
		)
	);

alter table public.nutrient_manual_entry_observations
	add column if not exists canonical_nutrient_id bigint references public.nutrient_definitions(nutrient_id) on delete restrict;

update public.nutrient_manual_entry_observations
set canonical_nutrient_id = nutrient_id
where canonical_nutrient_id is null;

alter table public.nutrient_manual_entry_observations
	alter column canonical_nutrient_id set not null;

create index if not exists nutrient_manual_entry_observations_canonical_nutrient_idx
	on public.nutrient_manual_entry_observations (canonical_nutrient_id, observed_at desc);

insert into public.nutrient_manual_entry_groups (
	id,
	entry_step,
	title,
	sort_order,
	enabled,
	group_role,
	source_count,
	observation_count,
	verification_status,
	sources,
	last_observed_at
)
values
	('carotenoids', 'extended', 'Carotenoids', 40, true, 'display', 0, 0, 'single_source', '{}'::text[], null),
	('advanced-carbohydrate-details', 'extended', 'Advanced carbohydrate details', 50, true, 'display', 0, 0, 'single_source', '{}'::text[], null),
	('advanced-fat-details', 'extended', 'Advanced fat details', 60, true, 'display', 0, 0, 'single_source', '{}'::text[], null),
	('other-nutrients', 'extended', 'Other nutrients', 90, true, 'display', 0, 0, 'single_source', '{}'::text[], null),
	('unclassified-nutrients', 'extended', 'Unclassified nutrients', 999, false, 'unclassified', 0, 0, 'single_source', '{}'::text[], null)
on conflict (id) do update set
	entry_step = excluded.entry_step,
	title = excluded.title,
	sort_order = excluded.sort_order,
	enabled = excluded.enabled,
	group_role = excluded.group_role;

update public.nutrient_manual_entry_groups
set
	group_role = 'display',
	updated_at = now()
where id <> 'unclassified-nutrients';

update public.nutrient_manual_entry_fields
set
	classification_status = 'approved',
	classification_source_key = 'blendcalc-manual-entry-policy',
	classification_reference = '20260719220000_db_driven_manual_entry_nutrient_groups',
	classification_version = 2,
	classification_notes = 'Existing API-observed field approved into the DB-owned manual-entry grouping catalog.',
	reviewed_at = now(),
	updated_at = now()
where classification_status <> 'retired';

update public.nutrient_manual_entry_fields
set
	group_id = 'required-basics',
	nutrient_type = case nutrient_id
		when 1008 then 'energy'
		when 1093 then 'mineral'
		else 'macro'
	end,
	display_label = case nutrient_id
		when 1008 then 'Calories (kcal)'
		when 1004 then 'Total Fat (g)'
		when 1005 then 'Total Carbohydrates (g)'
		when 1003 then 'Protein (g)'
		when 1093 then 'Sodium (mg)'
	end,
	dedupe_key = case nutrient_id
		when 1008 then 'macros:required-basics:calories:kcal'
		when 1004 then 'macros:required-basics:total fat:g'
		when 1005 then 'macros:required-basics:total carbohydrates:g'
		when 1003 then 'macros:required-basics:protein:g'
		when 1093 then 'macros:required-basics:sodium:mg'
	end,
	sort_order = case nutrient_id
		when 1008 then 10
		when 1004 then 20
		when 1005 then 30
		when 1003 then 40
		when 1093 then 50
	end,
	classification_notes = 'Common required nutrition-label value retained in Macros.',
	updated_at = now()
where nutrient_id in (1008, 1004, 1005, 1003, 1093);

update public.nutrient_manual_entry_fields
set
	group_id = 'carbohydrate-details',
	nutrient_type = 'carbohydrate',
	display_label = case nutrient_id
		when 1079 then 'Fiber, Total Dietary (g)'
		when 2000 then 'Total Sugars (g)'
		when 1235 then 'Added Sugars (g)'
	end,
	dedupe_key = case nutrient_id
		when 1079 then 'macros:carbohydrate-details:fiber total dietary:g'
		when 2000 then 'macros:carbohydrate-details:total sugars:g'
		when 1235 then 'macros:carbohydrate-details:added sugars:g'
	end,
	sort_order = case nutrient_id
		when 1079 then 10
		when 2000 then 20
		when 1235 then 30
	end,
	classification_notes = 'Common carbohydrate label value retained in Macros.',
	updated_at = now()
where nutrient_id in (1079, 2000, 1235);

update public.nutrient_manual_entry_fields
set
	group_id = 'fat-details',
	nutrient_type = 'fat',
	sort_order = case nutrient_id
		when 1258 then 10
		when 1257 then 20
		when 1293 then 30
		when 1292 then 40
		when 1253 then 50
	end,
	classification_notes = 'Common fat label value retained in Macros.',
	updated_at = now()
where nutrient_id in (1258, 1257, 1293, 1292, 1253);

update public.nutrient_manual_entry_fields
set
	group_id = 'advanced-carbohydrate-details',
	dedupe_key = regexp_replace(
		dedupe_key,
		'^macros:carbohydrate-details:',
		'extended:advanced-carbohydrate-details:'
	),
	sort_order = case nutrient_id
		when 1082 then 10
		when 1084 then 20
		when 2038 then 30
		when 2065 then 40
		when 2033 then 50
		when 1086 then 60
		when 1009 then 70
		when 1071 then 80
		else sort_order
	end,
	classification_notes = 'Advanced carbohydrate field retained in Extended; Macros contains common label values only.',
	updated_at = now()
where nutrient_id in (1082, 1084, 2038, 2065, 2033, 1086, 1009, 1071);

update public.nutrient_manual_entry_fields
set
	group_id = 'advanced-fat-details',
	dedupe_key = regexp_replace(
		dedupe_key,
		'^macros:fat-details:',
		'extended:advanced-fat-details:'
	),
	sort_order = case nutrient_id
		when 1330 then 10
		when 1329 then 20
		when 1331 then 30
		else sort_order
	end,
	classification_notes = 'Specialized trans-fat subtype retained in Extended; Macros contains common label values only.',
	updated_at = now()
where nutrient_id in (1329, 1330, 1331);

update public.nutrient_manual_entry_fields
set
	group_id = 'carotenoids',
	nutrient_type = 'carotenoid',
	dedupe_key = regexp_replace(
		dedupe_key,
		'^macros:fat-details:',
		'extended:carotenoids:'
	),
	sort_order = case nutrient_id
		when 2028 then 800
		when 2029 then 810
		else sort_order
	end,
	classification_notes = 'Carotenoid corrected from the broad trans-fat name match and retained in its own Extended group.',
	updated_at = now()
where nutrient_id in (2028, 2029);

update public.nutrient_manual_entry_fields
set
	group_id = 'other-nutrients',
	nutrient_type = 'proximate',
	dedupe_key = regexp_replace(
		dedupe_key,
		'^macros:mineral-details:',
		'extended:other-nutrients:'
	),
	sort_order = 10,
	classification_notes = 'Ash is a proximate measurement, not a specific mineral and not a common Macros input.',
	updated_at = now()
where nutrient_id = 1007;

update public.nutrient_manual_entry_fields
set
	enabled = false,
	classification_status = 'retired',
	replacement_nutrient_id = 2000,
	classification_source_key = 'blendcalc-manual-entry-policy',
	classification_reference = '20260719220000_db_driven_manual_entry_nutrient_groups',
	classification_version = 2,
	classification_notes = 'USDA legacy total-sugars field is retained as an alias of canonical Total Sugars nutrient 2000.',
	reviewed_at = now(),
	updated_at = now()
where nutrient_id = 1063;

update public.nutrient_manual_entry_observations
set
	canonical_nutrient_id = 2000,
	dedupe_key = 'macros:carbohydrate-details:total sugars:g',
	display_label = 'Total Sugars (g)',
	field_sort_order = 20,
	classification_method = 'db-manual-entry-policy-v2',
	updated_at = now()
where nutrient_id = 1063;

update public.nutrient_manual_entry_observations
set
	entry_step = 'extended',
	group_id = 'advanced-carbohydrate-details',
	group_title = 'Advanced carbohydrate details',
	group_sort_order = 50,
	dedupe_key = regexp_replace(
		dedupe_key,
		'^macros:carbohydrate-details:',
		'extended:advanced-carbohydrate-details:'
	),
	field_sort_order = case nutrient_id
		when 1082 then 10
		when 1084 then 20
		when 2038 then 30
		when 2065 then 40
		when 2033 then 50
		when 1086 then 60
		when 1009 then 70
		when 1071 then 80
		else field_sort_order
	end,
	classification_method = 'db-manual-entry-policy-v2',
	updated_at = now()
where nutrient_id in (1082, 1084, 2038, 2065, 2033, 1086, 1009, 1071);

update public.nutrient_manual_entry_observations
set
	entry_step = 'extended',
	group_id = 'advanced-fat-details',
	group_title = 'Advanced fat details',
	group_sort_order = 60,
	dedupe_key = regexp_replace(
		dedupe_key,
		'^macros:fat-details:',
		'extended:advanced-fat-details:'
	),
	field_sort_order = case nutrient_id
		when 1330 then 10
		when 1329 then 20
		when 1331 then 30
		else field_sort_order
	end,
	classification_method = 'db-manual-entry-policy-v2',
	updated_at = now()
where nutrient_id in (1329, 1330, 1331);

update public.nutrient_manual_entry_observations
set
	entry_step = 'extended',
	group_id = 'carotenoids',
	group_title = 'Carotenoids',
	group_sort_order = 40,
	nutrient_type = 'carotenoid',
	dedupe_key = regexp_replace(
		dedupe_key,
		'^macros:fat-details:',
		'extended:carotenoids:'
	),
	field_sort_order = case nutrient_id
		when 2028 then 800
		when 2029 then 810
		else field_sort_order
	end,
	classification_method = 'db-manual-entry-policy-v2',
	updated_at = now()
where nutrient_id in (2028, 2029);

update public.nutrient_manual_entry_observations
set
	entry_step = 'extended',
	group_id = 'other-nutrients',
	group_title = 'Other nutrients',
	group_sort_order = 90,
	nutrient_type = 'proximate',
	dedupe_key = regexp_replace(
		dedupe_key,
		'^macros:mineral-details:',
		'extended:other-nutrients:'
	),
	field_sort_order = 10,
	classification_method = 'db-manual-entry-policy-v2',
	updated_at = now()
where nutrient_id = 1007;

alter table public.nutrient_source_mappings
	drop constraint nutrient_source_mappings_mapping_method_check;

alter table public.nutrient_source_mappings
	add constraint nutrient_source_mappings_mapping_method_check
	check (
		mapping_method in (
			'api_id_match',
			'api_taxonomy_match',
			'api_observation_match',
			'moderator_verified',
			'standards_dataset',
			'db_reviewed_api_key_match'
		)
	);

update public.nutrient_source_mappings
set
	nutrient_id = case source_nutrient_key
		when 'saturated-fat' then 1258
		when 'trans-fat' then 1257
		when 'polyunsaturated-fat' then 1293
		when 'monounsaturated-fat' then 1292
	end,
	priority = 0,
	mapping_method = 'db_reviewed_api_key_match',
	confidence = 1,
	provenance = provenance || jsonb_build_object(
		'reviewedBy', 'blendcalc-manual-entry-policy',
		'reviewedIn', '20260719220000_db_driven_manual_entry_nutrient_groups',
		'reason', 'Specific fat keys must not resolve to the parent Total Fat nutrient.'
	),
	updated_at = now()
where source_key = 'open-food-facts'
	and source_unit_name = 'G'
	and source_nutrient_key in (
		'saturated-fat',
		'trans-fat',
		'polyunsaturated-fat',
		'monounsaturated-fat'
	);

create unique index if not exists nutrient_manual_entry_fields_enabled_nutrient_idx
	on public.nutrient_manual_entry_fields (nutrient_id)
	where enabled and classification_status = 'approved';

create or replace function public.sync_nutrient_manual_entry_fields()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	with observation_counts as (
		select
			canonical_nutrient_id,
			count(distinct source)::integer as source_count,
			count(*)::integer as observation_count,
			array_agg(distinct source order by source) as sources,
			max(observed_at) as last_observed_at
		from public.nutrient_manual_entry_observations
		group by canonical_nutrient_id
	)
	update public.nutrient_manual_entry_fields fields
	set
		source_count = counts.source_count,
		observation_count = counts.observation_count,
		verification_status = case
			when counts.source_count > 1 then 'multi_source_verified'
			else 'single_source'
		end,
		sources = counts.sources,
		last_observed_at = counts.last_observed_at,
		updated_at = now()
	from observation_counts counts
	where fields.nutrient_id = counts.canonical_nutrient_id;

	update public.nutrient_manual_entry_fields fields
	set
		source_count = 0,
		observation_count = 0,
		verification_status = 'single_source',
		sources = '{}'::text[],
		last_observed_at = null,
		updated_at = now()
	where not exists (
		select 1
		from public.nutrient_manual_entry_observations observations
		where observations.canonical_nutrient_id = fields.nutrient_id
	);

	with group_counts as (
		select
			fields.group_id,
			count(distinct observations.source)::integer as source_count,
			count(observations.id)::integer as observation_count,
			coalesce(
				array_agg(distinct observations.source order by observations.source)
					filter (where observations.source is not null),
				'{}'::text[]
			) as sources,
			max(observations.observed_at) as last_observed_at
		from public.nutrient_manual_entry_fields fields
		left join public.nutrient_manual_entry_observations observations
			on observations.canonical_nutrient_id = fields.nutrient_id
		where fields.enabled
			and fields.classification_status = 'approved'
		group by fields.group_id
	)
	update public.nutrient_manual_entry_groups groups
	set
		source_count = counts.source_count,
		observation_count = counts.observation_count,
		verification_status = case
			when counts.source_count > 1 then 'multi_source_verified'
			else 'single_source'
		end,
		sources = counts.sources,
		last_observed_at = counts.last_observed_at,
		updated_at = now()
	from group_counts counts
	where groups.id = counts.group_id;

	with unclassified_counts as (
		select
			observations.group_id,
			count(distinct observations.source)::integer as source_count,
			count(*)::integer as observation_count,
			array_agg(distinct observations.source order by observations.source) as sources,
			max(observations.observed_at) as last_observed_at
		from public.nutrient_manual_entry_observations observations
		join public.nutrient_manual_entry_groups groups
			on groups.id = observations.group_id
			and groups.group_role = 'unclassified'
		group by observations.group_id
	)
	update public.nutrient_manual_entry_groups groups
	set
		source_count = counts.source_count,
		observation_count = counts.observation_count,
		verification_status = case
			when counts.source_count > 1 then 'multi_source_verified'
			else 'single_source'
		end,
		sources = counts.sources,
		last_observed_at = counts.last_observed_at,
		updated_at = now()
	from unclassified_counts counts
	where groups.id = counts.group_id;
end;
$$;

create trigger sync_nutrient_manual_entry_observations_after_change
	after insert or update or delete on public.nutrient_manual_entry_observations
	for each statement execute function public.sync_nutrient_manual_entry_fields_trigger();

select public.sync_nutrient_manual_entry_fields();

update public.nutrient_manual_entry_groups
set
	enabled = false,
	group_role = 'display',
	updated_at = now()
where id = 'mineral-details';

comment on table public.nutrient_manual_entry_fields is
	'DB-owned manual-entry nutrient classification catalog. External observations update evidence counts but never overwrite approved grouping policy.';

comment on column public.nutrient_manual_entry_fields.classification_status is
	'Approval state for showing this nutrient in manual entry; pending or retired rows remain available for history and aliases.';

comment on column public.nutrient_manual_entry_fields.replacement_nutrient_id is
	'Canonical replacement used when a retired source nutrient is an alias of another manual-entry nutrient.';

comment on column public.nutrient_manual_entry_observations.canonical_nutrient_id is
	'Canonical manual-entry nutrient selected by the DB classification catalog while preserving the raw source nutrient_id.';
