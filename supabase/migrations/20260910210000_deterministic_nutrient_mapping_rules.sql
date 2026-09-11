create or replace function private.normalize_nutrient_unit_name(
	p_unit_name text
)
returns text
language sql
immutable
strict
set search_path = ''
as $$
	select case replace(replace(upper(btrim(p_unit_name)), 'Μ', 'U'), 'µ', 'U')
		when 'GRAM' then 'G'
		when 'GRAMS' then 'G'
		when 'MILLIGRAM' then 'MG'
		when 'MILLIGRAMS' then 'MG'
		when 'MICROGRAM' then 'UG'
		when 'MICROGRAMS' then 'UG'
		when 'MCG' then 'UG'
		when 'KILOCALORIE' then 'KCAL'
		when 'KILOCALORIES' then 'KCAL'
		when 'KILOJOULE' then 'KJ'
		when 'KILOJOULES' then 'KJ'
		when 'INTERNATIONAL UNIT' then 'IU'
		when 'INTERNATIONAL UNITS' then 'IU'
		when 'NIACIN EQUIVALENTS' then 'NE'
		else replace(replace(upper(btrim(p_unit_name)), 'Μ', 'U'), 'µ', 'U')
	end;
$$;

create table public.nutrient_mapping_deterministic_rules (
	id uuid primary key default gen_random_uuid(),
	source_key text not null references public.product_data_sources(key) on delete restrict,
	source_nutrient_key text not null check (btrim(source_nutrient_key) <> ''),
	source_unit_name text not null check (
		btrim(source_unit_name) <> ''
		and source_unit_name = private.normalize_nutrient_unit_name(source_unit_name)
	),
	source_nutrient_name text not null check (btrim(source_nutrient_name) <> ''),
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete restrict,
	rule_version integer not null check (rule_version > 0),
	review_reference text not null check (btrim(review_reference) <> ''),
	evidence_reference text not null check (
		btrim(evidence_reference) <> ''
		and char_length(evidence_reference) <= 2000
	),
	review_note text not null check (
		btrim(review_note) <> ''
		and char_length(review_note) <= 2000
	),
	effective_at timestamptz not null,
	enabled boolean not null default true,
	provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (source_key, source_nutrient_key, source_unit_name, rule_version),
	unique (review_reference)
);

create unique index nutrient_mapping_deterministic_rules_active_identity_idx
	on public.nutrient_mapping_deterministic_rules (
		source_key,
		source_nutrient_key,
		source_unit_name
	)
	where enabled;

create index nutrient_mapping_deterministic_rules_nutrient_idx
	on public.nutrient_mapping_deterministic_rules (
		source_key,
		nutrient_id,
		source_unit_name
	)
	where enabled;

create table public.nutrient_mapping_deterministic_backfill_runs (
	id uuid primary key default gen_random_uuid(),
	operation_reference text not null check (btrim(operation_reference) <> ''),
	rule_count integer not null check (rule_count >= 0),
	pending_count integer not null check (pending_count >= 0),
	approved_count integer not null default 0 check (approved_count >= 0),
	skipped_count integer not null default 0 check (skipped_count >= 0),
	started_at timestamptz not null default now(),
	completed_at timestamptz,
	check (approved_count + skipped_count <= pending_count),
	check (completed_at is null or approved_count + skipped_count = pending_count)
);

create table public.nutrient_mapping_deterministic_backfill_results (
	id uuid primary key default gen_random_uuid(),
	run_id uuid not null references public.nutrient_mapping_deterministic_backfill_runs(id) on delete restrict,
	mapping_id uuid references public.nutrient_source_mappings(id) on delete set null,
	source_key text not null,
	source_nutrient_key text not null,
	source_unit_name text not null,
	result text not null check (result in ('approved', 'skipped')),
	reason text not null check (
		reason in (
			'approved_exact_rule',
			'no_exact_rule',
			'missing_reviewed_unit_conversion',
			'state_changed_before_approval'
		)
	),
	decision_id uuid references public.nutrient_mapping_review_decisions(id) on delete restrict,
	evaluated_at timestamptz not null default now(),
	unique (run_id, source_key, source_nutrient_key, source_unit_name),
	check (
		(result = 'approved' and reason = 'approved_exact_rule' and decision_id is not null)
		or (result = 'skipped' and reason <> 'approved_exact_rule' and decision_id is null)
	)
);

create index nutrient_mapping_deterministic_backfill_results_run_result_idx
	on public.nutrient_mapping_deterministic_backfill_results (run_id, result, reason);

create trigger set_nutrient_mapping_deterministic_rules_updated_at
	before update on public.nutrient_mapping_deterministic_rules
	for each row execute function public.set_updated_at();

alter table public.nutrient_mapping_deterministic_rules enable row level security;
alter table public.nutrient_mapping_deterministic_rules force row level security;
alter table public.nutrient_mapping_deterministic_backfill_runs enable row level security;
alter table public.nutrient_mapping_deterministic_backfill_runs force row level security;
alter table public.nutrient_mapping_deterministic_backfill_results enable row level security;
alter table public.nutrient_mapping_deterministic_backfill_results force row level security;

revoke all on table public.nutrient_mapping_deterministic_rules
	from public, anon, authenticated, service_role;
revoke all on table public.nutrient_mapping_deterministic_backfill_runs
	from public, anon, authenticated, service_role;
revoke all on table public.nutrient_mapping_deterministic_backfill_results
	from public, anon, authenticated, service_role;
grant select on table public.nutrient_mapping_deterministic_rules to service_role;
grant select on table public.nutrient_mapping_deterministic_backfill_runs to service_role;
grant select on table public.nutrient_mapping_deterministic_backfill_results to service_role;

alter table public.nutrient_mapping_review_decisions
	add column decision_origin text not null default 'human_review'
		check (decision_origin in ('human_review', 'deterministic_rule')),
	add column deterministic_rule_id uuid
		references public.nutrient_mapping_deterministic_rules(id) on delete restrict,
	alter column reviewed_by drop not null;

alter table public.nutrient_mapping_review_decisions
	add constraint nutrient_mapping_review_decisions_actor_check check (
		(
			decision_origin = 'human_review'
			and reviewed_by is not null
			and deterministic_rule_id is null
		)
		or (
			decision_origin = 'deterministic_rule'
			and reviewed_by is null
			and deterministic_rule_id is not null
		)
	);

create unique index nutrient_mapping_review_decisions_deterministic_rule_idx
	on public.nutrient_mapping_review_decisions (mapping_id, deterministic_rule_id)
	where decision_origin = 'deterministic_rule';

create or replace function private.try_approve_deterministic_nutrient_mapping(
	p_mapping_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_mapping public.nutrient_source_mappings%rowtype;
	v_rule public.nutrient_mapping_deterministic_rules%rowtype;
	v_default_unit_name text;
	v_decision_id uuid;
	v_reviewed_at timestamptz := now();
begin
	select mapping.*
	into v_mapping
	from public.nutrient_source_mappings mapping
	where mapping.id = p_mapping_id
	for update;

	if not found or v_mapping.review_status <> 'pending_review' then
		return null;
	end if;

	select rule.*
	into v_rule
	from public.nutrient_mapping_deterministic_rules rule
	where rule.source_key = v_mapping.source_key
		and rule.source_nutrient_key = v_mapping.source_nutrient_key
		and rule.source_unit_name = private.normalize_nutrient_unit_name(v_mapping.source_unit_name)
		and rule.enabled
	order by rule.rule_version desc
	limit 1;

	if not found then
		return null;
	end if;

	select definition.default_unit_name
	into v_default_unit_name
	from public.nutrient_definitions definition
	where definition.nutrient_id = v_rule.nutrient_id;

	if not found then
		return null;
	end if;

	if private.normalize_nutrient_unit_name(v_default_unit_name)
		<> private.normalize_nutrient_unit_name(v_mapping.source_unit_name)
		and not exists (
			select 1
			from public.nutrient_unit_conversions conversion
			where conversion.source_key = v_mapping.source_key
				and conversion.nutrient_id = v_rule.nutrient_id
				and private.normalize_nutrient_unit_name(conversion.from_unit_name)
					= private.normalize_nutrient_unit_name(v_mapping.source_unit_name)
				and private.normalize_nutrient_unit_name(conversion.to_unit_name)
					= private.normalize_nutrient_unit_name(v_default_unit_name)
				and conversion.conversion_method in ('reviewed_standard', 'moderator_verified')
				and conversion.confidence = 1
		) then
		return null;
	end if;

	insert into public.nutrient_mapping_review_decisions (
		mapping_id,
		source_key,
		source_nutrient_key,
		source_unit_name,
		outcome,
		previous_nutrient_id,
		selected_nutrient_id,
		previous_mapping_method,
		review_note,
		evidence_reference,
		reviewed_by,
		reviewed_at,
		decision_origin,
		deterministic_rule_id
	)
	values (
		v_mapping.id,
		v_mapping.source_key,
		v_mapping.source_nutrient_key,
		v_mapping.source_unit_name,
		'approved',
		v_mapping.nutrient_id,
		v_rule.nutrient_id,
		v_mapping.mapping_method,
		v_rule.review_note,
		v_rule.evidence_reference,
		null,
		v_reviewed_at,
		'deterministic_rule',
		v_rule.id
	)
	on conflict (mapping_id, deterministic_rule_id)
		where decision_origin = 'deterministic_rule'
	do nothing
	returning id into v_decision_id;

	if v_decision_id is null then
		select decision.id
		into v_decision_id
		from public.nutrient_mapping_review_decisions decision
		where decision.mapping_id = v_mapping.id
			and decision.deterministic_rule_id = v_rule.id
			and decision.decision_origin = 'deterministic_rule';
	end if;

	update public.nutrient_source_mappings mapping
	set
		nutrient_id = v_rule.nutrient_id,
		mapping_method = 'db_reviewed_api_key_match',
		confidence = 1,
		enabled = true,
		review_status = 'approved',
		review_reference = v_rule.review_reference,
		reviewed_at = v_reviewed_at,
		provenance = mapping.provenance || jsonb_build_object(
			'deterministicRuleId', v_rule.id,
			'deterministicRuleVersion', v_rule.rule_version,
			'lastReviewDecisionId', v_decision_id,
			'lastReviewOutcome', 'approved'
		),
		updated_at = v_reviewed_at
	where mapping.id = v_mapping.id
		and mapping.review_status = 'pending_review';

	return v_decision_id;
end;
$$;

create or replace function private.run_deterministic_nutrient_mapping_backfill(
	p_operation_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_run_id uuid := gen_random_uuid();
	v_mapping record;
	v_decision_id uuid;
	v_reason text;
	v_pending_count integer;
	v_rule_count integer;
	v_approved_count integer := 0;
	v_skipped_count integer := 0;
begin
	if btrim(coalesce(p_operation_reference, '')) = '' then
		raise exception 'A non-empty operation reference is required.';
	end if;

	select count(*)::integer
	into v_rule_count
	from public.nutrient_mapping_deterministic_rules rule
	where rule.enabled;

	select count(*)::integer
	into v_pending_count
	from public.nutrient_source_mappings mapping
	where mapping.review_status = 'pending_review';

	insert into public.nutrient_mapping_deterministic_backfill_runs (
		id,
		operation_reference,
		rule_count,
		pending_count
	)
	values (
		v_run_id,
		btrim(p_operation_reference),
		v_rule_count,
		v_pending_count
	);

	for v_mapping in
		select
			mapping.id,
			mapping.source_key,
			mapping.source_nutrient_key,
			mapping.source_unit_name
		from public.nutrient_source_mappings mapping
		where mapping.review_status = 'pending_review'
		order by mapping.source_key, mapping.source_nutrient_key, mapping.source_unit_name
	loop
		v_decision_id := private.try_approve_deterministic_nutrient_mapping(
			v_mapping.id
		);

		if v_decision_id is not null then
			v_reason := 'approved_exact_rule';
			v_approved_count := v_approved_count + 1;
		else
			select case
				when not exists (
					select 1
					from public.nutrient_mapping_deterministic_rules rule
					where rule.source_key = v_mapping.source_key
						and rule.source_nutrient_key = v_mapping.source_nutrient_key
						and rule.source_unit_name = private.normalize_nutrient_unit_name(v_mapping.source_unit_name)
						and rule.enabled
				) then 'no_exact_rule'
				when exists (
					select 1
					from public.nutrient_mapping_deterministic_rules rule
					join public.nutrient_definitions definition
						on definition.nutrient_id = rule.nutrient_id
					where rule.source_key = v_mapping.source_key
						and rule.source_nutrient_key = v_mapping.source_nutrient_key
						and rule.source_unit_name = private.normalize_nutrient_unit_name(v_mapping.source_unit_name)
						and rule.enabled
						and private.normalize_nutrient_unit_name(definition.default_unit_name)
							<> private.normalize_nutrient_unit_name(v_mapping.source_unit_name)
						and not exists (
							select 1
							from public.nutrient_unit_conversions conversion
							where conversion.source_key = v_mapping.source_key
								and conversion.nutrient_id = rule.nutrient_id
								and private.normalize_nutrient_unit_name(conversion.from_unit_name)
									= private.normalize_nutrient_unit_name(v_mapping.source_unit_name)
								and private.normalize_nutrient_unit_name(conversion.to_unit_name)
									= private.normalize_nutrient_unit_name(definition.default_unit_name)
								and conversion.conversion_method in ('reviewed_standard', 'moderator_verified')
								and conversion.confidence = 1
						)
				) then 'missing_reviewed_unit_conversion'
				else 'state_changed_before_approval'
			end
			into v_reason;
			v_skipped_count := v_skipped_count + 1;
		end if;

		insert into public.nutrient_mapping_deterministic_backfill_results (
			run_id,
			mapping_id,
			source_key,
			source_nutrient_key,
			source_unit_name,
			result,
			reason,
			decision_id
		)
		values (
			v_run_id,
			v_mapping.id,
			v_mapping.source_key,
			v_mapping.source_nutrient_key,
			v_mapping.source_unit_name,
			case when v_decision_id is null then 'skipped' else 'approved' end,
			v_reason,
			v_decision_id
		);
	end loop;

	update public.nutrient_mapping_deterministic_backfill_runs run
	set
		approved_count = v_approved_count,
		skipped_count = v_skipped_count,
		completed_at = now()
	where run.id = v_run_id;

	return v_run_id;
end;
$$;

create or replace function private.apply_deterministic_nutrient_mapping_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_mapping_id uuid;
begin
	if not new.enabled then
		return new;
	end if;

	insert into public.nutrient_source_mappings (
		source_key,
		source_nutrient_key,
		source_unit_name,
		source_nutrient_name,
		nutrient_id,
		priority,
		mapping_method,
		confidence,
		enabled,
		observation_count,
		provenance,
		review_status,
		review_reference,
		reviewed_at
	)
	values (
		new.source_key,
		new.source_nutrient_key,
		new.source_unit_name,
		new.source_nutrient_name,
		new.nutrient_id,
		0,
		'db_reviewed_api_key_match',
		1,
		false,
		0,
		jsonb_build_object(
			'deterministicRuleId', new.id,
			'deterministicRuleVersion', new.rule_version,
			'reason', new.review_note
		),
		'pending_review',
		null,
		null
	)
	on conflict (source_key, source_nutrient_key, source_unit_name) do update set
		source_nutrient_name = excluded.source_nutrient_name,
		nutrient_id = excluded.nutrient_id,
		priority = excluded.priority,
		mapping_method = excluded.mapping_method,
		confidence = excluded.confidence,
		provenance = public.nutrient_source_mappings.provenance || excluded.provenance,
		updated_at = now()
	where public.nutrient_source_mappings.review_status = 'pending_review'
	returning id into v_mapping_id;

	if v_mapping_id is null then
		select mapping.id
		into v_mapping_id
		from public.nutrient_source_mappings mapping
		where mapping.source_key = new.source_key
			and mapping.source_nutrient_key = new.source_nutrient_key
			and mapping.source_unit_name = new.source_unit_name;
	end if;

	perform private.try_approve_deterministic_nutrient_mapping(v_mapping_id);
	return new;
end;
$$;

create or replace function private.apply_deterministic_rule_to_mapping_candidate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	perform private.try_approve_deterministic_nutrient_mapping(new.id);
	return new;
end;
$$;

create or replace function private.apply_deterministic_rules_after_conversion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_mapping_id uuid;
begin
	if new.conversion_method not in ('reviewed_standard', 'moderator_verified')
		or new.confidence <> 1 then
		return new;
	end if;

	for v_mapping_id in
		select mapping.id
		from public.nutrient_source_mappings mapping
		join public.nutrient_mapping_deterministic_rules rule
			on rule.source_key = mapping.source_key
			and rule.source_nutrient_key = mapping.source_nutrient_key
			and rule.source_unit_name = private.normalize_nutrient_unit_name(mapping.source_unit_name)
			and rule.nutrient_id = new.nutrient_id
			and rule.enabled
		join public.nutrient_definitions definition
			on definition.nutrient_id = rule.nutrient_id
		where mapping.review_status = 'pending_review'
			and mapping.source_key = new.source_key
			and private.normalize_nutrient_unit_name(mapping.source_unit_name)
				= private.normalize_nutrient_unit_name(new.from_unit_name)
			and private.normalize_nutrient_unit_name(definition.default_unit_name)
				= private.normalize_nutrient_unit_name(new.to_unit_name)
	loop
		perform private.try_approve_deterministic_nutrient_mapping(v_mapping_id);
	end loop;

	return new;
end;
$$;

revoke all on function private.normalize_nutrient_unit_name(text)
	from public, anon, authenticated, service_role;
revoke all on function private.try_approve_deterministic_nutrient_mapping(uuid)
	from public, anon, authenticated, service_role;
revoke all on function private.run_deterministic_nutrient_mapping_backfill(text)
	from public, anon, authenticated, service_role;
revoke all on function private.apply_deterministic_nutrient_mapping_rule()
	from public, anon, authenticated, service_role;
revoke all on function private.apply_deterministic_rule_to_mapping_candidate()
	from public, anon, authenticated, service_role;
revoke all on function private.apply_deterministic_rules_after_conversion()
	from public, anon, authenticated, service_role;

with reviewed_conversions (
	nutrient_id,
	from_unit_name,
	to_unit_name,
	multiplier
) as (
	values
		(1057, 'G', 'MG', 1000::numeric),
		(1087, 'G', 'MG', 1000::numeric),
		(1089, 'G', 'MG', 1000::numeric),
		(1090, 'G', 'MG', 1000::numeric),
		(1091, 'G', 'MG', 1000::numeric),
		(1092, 'G', 'MG', 1000::numeric),
		(1095, 'G', 'MG', 1000::numeric),
		(1098, 'G', 'MG', 1000::numeric),
		(1099, 'MG', 'UG', 1000::numeric),
		(1100, 'G', 'UG', 1000000::numeric),
		(1101, 'G', 'MG', 1000::numeric),
		(1103, 'G', 'UG', 1000000::numeric),
		(1107, 'G', 'UG', 1000000::numeric),
		(1109, 'G', 'MG', 1000::numeric),
		(1114, 'G', 'UG', 1000000::numeric),
		(1162, 'G', 'MG', 1000::numeric),
		(1176, 'G', 'UG', 1000000::numeric),
		(1180, 'G', 'MG', 1000::numeric),
		(1181, 'G', 'MG', 1000::numeric),
		(2066, 'G', 'MG', 1000::numeric),
		(2066, 'UG', 'MG', 0.001::numeric),
		(1008, 'KJ', 'KCAL', 0.23900574::numeric)
)
insert into public.nutrient_unit_conversions (
	source_key,
	nutrient_id,
	from_unit_name,
	to_unit_name,
	multiplier,
	conversion_method,
	confidence,
	observation_count,
	provenance
)
select
	'open-food-facts',
	conversion.nutrient_id,
	conversion.from_unit_name,
	conversion.to_unit_name,
	conversion.multiplier,
	'reviewed_standard',
	1,
	1,
	'{}'::jsonb
from reviewed_conversions conversion
join public.nutrient_definitions definition
	on definition.nutrient_id = conversion.nutrient_id
on conflict (source_key, nutrient_id, from_unit_name, to_unit_name) do update set
	multiplier = excluded.multiplier,
	conversion_method = excluded.conversion_method,
	confidence = excluded.confidence,
	observation_count = greatest(
		public.nutrient_unit_conversions.observation_count,
		excluded.observation_count
	),
	provenance = public.nutrient_unit_conversions.provenance || excluded.provenance || jsonb_build_object(
		'sourceReference', 'https://ucum.org/ucum',
		'specificationVersion', '2.2',
		'licenseName', 'UCUM License v1.1',
		'licenseUrl', 'https://ucum.org/license',
		'reviewedAt', '2026-09-10T00:00:00Z'
	),
	updated_at = now();

update public.nutrient_unit_conversions conversion
set provenance = conversion.provenance || jsonb_build_object(
	'sourceReference', 'https://ucum.org/ucum',
	'specificationVersion', '2.2',
	'licenseName', 'UCUM License v1.1',
	'licenseUrl', 'https://ucum.org/license',
	'reviewedAt', '2026-09-10T00:00:00Z'
)
where conversion.source_key = 'open-food-facts'
	and conversion.conversion_method = 'reviewed_standard'
	and conversion.confidence = 1
	and conversion.nutrient_id in (
		1008, 1057, 1087, 1089, 1090, 1091, 1092, 1095, 1098, 1099, 1100,
		1101, 1103, 1107, 1109, 1114, 1162, 1176, 1180, 1181, 2066
	);

with reviewed_rules (
	source_nutrient_key,
	source_unit_name,
	source_nutrient_name,
	nutrient_id
) as (
	values
		('arachidonic-acid', 'G', 'Arachidonic acid', 700855),
		('beta-carotene', 'G', 'Beta carotene', 1107),
		('beta-glucan', 'G', 'Beta-glucan', 2058),
		('biotin', 'G', 'Biotin', 1176),
		('biotin', 'UG', 'Biotin', 1176),
		('caffeine', 'G', 'Caffeine', 1057),
		('caffeine', 'MG', 'Caffeine', 1057),
		('calcium', 'G', 'Calcium', 1087),
		('calcium', 'MG', 'Calcium', 1087),
		('carbohydrates-total', 'G', 'Total carbohydrates (includes fiber)', 1005),
		('choline', 'G', 'Choline', 1180),
		('copper', 'G', 'Copper', 1098),
		('copper', 'MG', 'Copper', 1098),
		('energy-kj', 'KJ', 'Energy (kJ)', 1008),
		('fluoride', 'MG', 'Fluoride', 1099),
		('folates', 'UG', 'Folates (total folates)', 1177),
		('fructose', 'G', 'Fructose', 1012),
		('galactose', 'G', 'Galactose', 1075),
		('glucose', 'G', 'Glucose', 1011),
		('inositol', 'G', 'Inositol', 1181),
		('insoluble-fiber', 'G', 'Insoluble fiber', 1084),
		('iodine', 'G', 'Iodine', 1100),
		('iodine', 'UG', 'Iodine', 1100),
		('iron', 'G', 'Iron', 1089),
		('iron', 'MG', 'Iron', 1089),
		('lactose', 'G', 'Lactose', 1013),
		('linoleic-acid', 'G', 'Linoleic acid', 700666),
		('magnesium', 'G', 'Magnesium', 1090),
		('magnesium', 'MG', 'Magnesium', 1090),
		('maltose', 'G', 'Maltose', 1014),
		('manganese', 'G', 'Manganese', 1101),
		('manganese', 'MG', 'Manganese', 1101),
		('molybdenum', 'UG', 'Molybdenum', 1102),
		('phosphorus', 'G', 'Phosphorus', 1091),
		('phosphorus', 'MG', 'Phosphorus', 1091),
		('potassium', 'G', 'Potassium', 1092),
		('potassium', 'MG', 'Potassium', 1092),
		('selenium', 'G', 'Selenium', 1103),
		('selenium', 'UG', 'Selenium', 1103),
		('soluble-fiber', 'G', 'Soluble fiber', 1082),
		('sorbitol', 'G', 'Sorbitol', 700261),
		('starch', 'G', 'Starch', 1009),
		('sucrose', 'G', 'Sucrose', 1010),
		('vitamin-a', 'G', 'Vitamin A', 2066),
		('vitamin-a', 'UG', 'Vitamin A', 2066),
		('vitamin-c', 'G', 'Vitamin C (ascorbic acid)', 1162),
		('vitamin-c', 'MG', 'Vitamin C (ascorbic acid)', 1162),
		('vitamin-d', 'G', 'Vitamin D', 1114),
		('vitamin-d', 'UG', 'Vitamin D', 1114),
		('vitamin-e', 'G', 'Vitamin E', 1109),
		('vitamin-e', 'MG', 'Vitamin E', 1109),
		('water', 'G', 'Water', 1051),
		('zinc', 'G', 'Zinc', 1095),
		('zinc', 'MG', 'Zinc', 1095)
)
insert into public.nutrient_mapping_deterministic_rules (
	source_key,
	source_nutrient_key,
	source_unit_name,
	source_nutrient_name,
	nutrient_id,
	rule_version,
	review_reference,
	evidence_reference,
	review_note,
	effective_at,
	provenance
)
select
	'open-food-facts',
	rule.source_nutrient_key,
	rule.source_unit_name,
	rule.source_nutrient_name,
	rule.nutrient_id,
	1,
	format(
		'DEV-074:open-food-facts:%s:%s:v1',
		rule.source_nutrient_key,
		rule.source_unit_name
	),
	'https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Food.pm',
	format(
		'Open Food Facts defines the exact %s nutrient key; blendCalc reviewed it as canonical %s with an eligible %s unit path.',
		rule.source_nutrient_key,
		definition.nutrient_name,
		rule.source_unit_name
	),
	'2026-09-10T00:00:00Z',
	jsonb_build_object(
		'owner', 'source-controlled-migration',
		'canonicalNutrientNumber', definition.nutrient_number,
		'unitPath', rule.source_unit_name || '-to-' || private.normalize_nutrient_unit_name(definition.default_unit_name),
		'providerReference', 'Open Food Facts maintained nutrient tables'
	)
from reviewed_rules rule
join public.nutrient_definitions definition
	on definition.nutrient_id = rule.nutrient_id;

select private.run_deterministic_nutrient_mapping_backfill(
	'DEV-074 initial pending nutrient mapping review backfill'
);

create trigger apply_deterministic_nutrient_mapping_rule
	after insert or update of enabled, nutrient_id, evidence_reference, review_note
	on public.nutrient_mapping_deterministic_rules
	for each row execute function private.apply_deterministic_nutrient_mapping_rule();

create trigger apply_deterministic_rule_to_mapping_candidate
	after insert or update of source_key, source_nutrient_key, source_unit_name, review_status
	on public.nutrient_source_mappings
	for each row
	when (new.review_status = 'pending_review')
	execute function private.apply_deterministic_rule_to_mapping_candidate();

create trigger apply_deterministic_rules_after_conversion
	after insert or update of conversion_method, confidence, multiplier
	on public.nutrient_unit_conversions
	for each row execute function private.apply_deterministic_rules_after_conversion();

update public.nutrient_mapping_deterministic_rules
set review_note = review_note
where enabled;

comment on table public.nutrient_mapping_deterministic_rules is
	'Versioned source-controlled exact nutrient identities that may bypass routine human review only when their normalized unit path is already reviewed.';

comment on table public.nutrient_mapping_deterministic_backfill_runs is
	'Immutable summaries of full pending-review evaluations against the enabled deterministic nutrient rule corpus.';

comment on table public.nutrient_mapping_deterministic_backfill_results is
	'One immutable approved-or-skipped result for every mapping evaluated by a deterministic nutrient backfill run.';

comment on column public.nutrient_mapping_review_decisions.decision_origin is
	'Distinguishes an AAL2 human review from a source-controlled deterministic rule decision.';

comment on column public.nutrient_mapping_review_decisions.deterministic_rule_id is
	'Links an automatic approval to the exact immutable rule version that authorized it; null for human review.';

comment on function private.try_approve_deterministic_nutrient_mapping(uuid) is
	'Idempotently approves one pending exact source identity only when an enabled source-controlled rule and reviewed unit path both match.';

comment on function private.run_deterministic_nutrient_mapping_backfill(text) is
	'Evaluates every pending nutrient mapping, records an auditable result, and approves only exact rules with reviewed unit paths.';
