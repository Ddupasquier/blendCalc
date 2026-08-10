create table public.compatibility_rule_conflicts (
	preference_tag_id uuid not null
		references public.compatibility_tags(id) on delete cascade,
	fact_tag_id uuid not null
		references public.compatibility_tags(id) on delete cascade,
	severity text not null check (severity in ('warning', 'potential')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (preference_tag_id, fact_tag_id)
);

create index compatibility_rule_conflicts_fact_tag_idx
	on public.compatibility_rule_conflicts (fact_tag_id, preference_tag_id);

create trigger set_compatibility_rule_conflicts_updated_at
	before update on public.compatibility_rule_conflicts
	for each row execute function public.set_updated_at();

with conflict_values (preference_slug, fact_slug, severity) as (
	values
		('dairy', 'milk', 'warning'),
		('dairy-free', 'dairy', 'warning'),
		('dairy-free', 'milk', 'warning'),
		('egg-free', 'egg', 'warning'),
		('gluten-free', 'gluten', 'warning'),
		('gluten-free', 'wheat', 'warning'),
		('kosher', 'shellfish', 'warning'),
		('nut-free', 'peanut', 'warning'),
		('nut-free', 'tree-nut', 'warning'),
		('soy-free', 'soy', 'warning'),
		('vegan', 'dairy', 'warning'),
		('vegan', 'milk', 'warning'),
		('vegan', 'egg', 'warning'),
		('vegan', 'fish', 'warning'),
		('vegan', 'shellfish', 'warning'),
		('vegetarian', 'fish', 'warning'),
		('vegetarian', 'shellfish', 'warning')
)
insert into public.compatibility_rule_conflicts (
	preference_tag_id,
	fact_tag_id,
	severity
)
select
	preference_tag.id,
	fact_tag.id,
	conflict_values.severity
from conflict_values
join public.compatibility_tags preference_tag
	on preference_tag.slug = conflict_values.preference_slug
join public.compatibility_tags fact_tag
	on fact_tag.slug = conflict_values.fact_slug
on conflict (preference_tag_id, fact_tag_id) do update
set
	severity = excluded.severity,
	updated_at = now();

alter table public.compatibility_rule_conflicts enable row level security;
alter table public.compatibility_rule_conflicts force row level security;

create policy "Authenticated users can read compatibility conflicts"
	on public.compatibility_rule_conflicts
	for select
	to authenticated
	using (true);

revoke all on table public.compatibility_rule_conflicts from public, anon;
grant select on table public.compatibility_rule_conflicts to authenticated, service_role;
