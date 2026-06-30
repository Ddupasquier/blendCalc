create table public.nutrient_relationship_rules (
	id text primary key check (btrim(id) <> ''),
	parent_nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete cascade,
	child_nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete cascade,
	relationship text not null check (relationship in ('child_must_not_exceed_parent')),
	severity text not null default 'error' check (severity in ('error', 'warning')),
	message text not null check (btrim(message) <> ''),
	requires_parent boolean not null default true,
	tolerance numeric not null default 0 check (tolerance >= 0),
	enabled boolean not null default true,
	sort_order integer not null check (sort_order > 0),
	source text not null check (btrim(source) <> ''),
	source_count integer not null default 1 check (source_count >= 0),
	observation_count integer not null default 1 check (observation_count >= 0),
	sources text[] not null default '{}'::text[],
	provenance jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (parent_nutrient_id, child_nutrient_id, relationship)
);

create trigger set_nutrient_relationship_rules_updated_at
	before update on public.nutrient_relationship_rules
	for each row execute function public.set_updated_at();

create index nutrient_relationship_rules_parent_idx
	on public.nutrient_relationship_rules (parent_nutrient_id);

create index nutrient_relationship_rules_child_idx
	on public.nutrient_relationship_rules (child_nutrient_id);

create index nutrient_relationship_rules_active_sort_idx
	on public.nutrient_relationship_rules (sort_order, id)
	where enabled;

with desired_rules as (
	select *
	from (values
		('fiber-lte-carbs', '205', '291', 'Dietary fiber cannot exceed total carbohydrates.', 10),
		('total-sugars-lte-carbs', '205', '269', 'Total sugars cannot exceed total carbohydrates.', 20),
		('added-sugars-lte-total-sugars', '269', '539', 'Added sugars cannot exceed total sugars.', 30),
		('sugar-alcohols-lte-carbs', '205', '299', 'Sugar alcohols cannot exceed total carbohydrates.', 40),
		('starch-lte-carbs', '205', '209', 'Starch cannot exceed total carbohydrates.', 50),
		('saturated-fat-lte-total-fat', '204', '606', 'Saturated fat cannot exceed total fat.', 60),
		('trans-fat-lte-total-fat', '204', '605', 'Trans fat cannot exceed total fat.', 70),
		('monounsaturated-fat-lte-total-fat', '204', '645', 'Monounsaturated fat cannot exceed total fat.', 80),
		('polyunsaturated-fat-lte-total-fat', '204', '646', 'Polyunsaturated fat cannot exceed total fat.', 90)
	) as rules(id, parent_nutrient_number, child_nutrient_number, message, sort_order)
), matched_rules as (
	select distinct on (parent_definition.nutrient_id, child_definition.nutrient_id)
		desired_rules.id,
		parent_definition.nutrient_id as parent_nutrient_id,
		child_definition.nutrient_id as child_nutrient_id,
		desired_rules.message,
		desired_rules.sort_order,
		desired_rules.parent_nutrient_number,
		desired_rules.child_nutrient_number
	from desired_rules
	join public.nutrient_definitions parent_definition
		on parent_definition.nutrient_number = desired_rules.parent_nutrient_number
	join public.nutrient_definitions child_definition
		on child_definition.nutrient_number = desired_rules.child_nutrient_number
	where parent_definition.default_unit_name = child_definition.default_unit_name
	order by
		parent_definition.nutrient_id,
		child_definition.nutrient_id,
		desired_rules.sort_order
)
insert into public.nutrient_relationship_rules (
	id,
	parent_nutrient_id,
	child_nutrient_id,
	relationship,
	severity,
	message,
	requires_parent,
	tolerance,
	enabled,
	sort_order,
	source,
	source_count,
	observation_count,
	sources,
	provenance
)
select
	matched_rules.id || ':' || matched_rules.parent_nutrient_id || ':' || matched_rules.child_nutrient_id,
	matched_rules.parent_nutrient_id,
	matched_rules.child_nutrient_id,
	'child_must_not_exceed_parent',
	'error',
	matched_rules.message,
	true,
	0,
	true,
	matched_rules.sort_order,
	'nutrient_definitions',
	1,
	1,
	array['nutrient_definitions'],
	jsonb_build_object(
		'classificationMethod', 'canonical nutrient hierarchy inferred from source nutrient numbers',
		'parentNutrientNumber', matched_rules.parent_nutrient_number,
		'childNutrientNumber', matched_rules.child_nutrient_number
	)
from matched_rules
on conflict (parent_nutrient_id, child_nutrient_id, relationship) do update set
	message = excluded.message,
	severity = excluded.severity,
	requires_parent = excluded.requires_parent,
	tolerance = excluded.tolerance,
	enabled = excluded.enabled,
	sort_order = excluded.sort_order,
	source = excluded.source,
	source_count = excluded.source_count,
	observation_count = excluded.observation_count,
	sources = excluded.sources,
	provenance = excluded.provenance;

alter table public.nutrient_relationship_rules enable row level security;
alter table public.nutrient_relationship_rules force row level security;

create policy "Authenticated users can read nutrient relationship rules"
	on public.nutrient_relationship_rules
	for select
	to authenticated
	using (true);

revoke all on table public.nutrient_relationship_rules from public, anon, authenticated;
grant select on table public.nutrient_relationship_rules to authenticated;
grant all on table public.nutrient_relationship_rules to service_role;
