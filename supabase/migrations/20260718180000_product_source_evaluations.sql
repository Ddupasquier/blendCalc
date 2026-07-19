insert into public.product_data_sources (
	key,
	display_name,
	source_type,
	homepage_url,
	api_base_url,
	terms_url,
	attribution_text,
	enabled,
	provenance
)
values (
	'foodrepo',
	'The Open Food Repo',
	'external_api',
	'https://www.foodrepo.org/',
	null,
	'https://www.foodrepo.org/en/terms-of-service',
	'The Open Food Repo contributors (CC BY 4.0)',
	false,
	jsonb_build_object(
		'lifecycle_status', 'retired',
		'retired_on', '2026-02-28',
		'replacement_source_key', 'open-food-facts',
		'lifecycle_evidence_url', 'https://www.foodrepo.org/en/blog/8-api-v3-released'
	)
)
on conflict (key) do update
set
	display_name = excluded.display_name,
	source_type = excluded.source_type,
	homepage_url = excluded.homepage_url,
	api_base_url = excluded.api_base_url,
	terms_url = excluded.terms_url,
	attribution_text = excluded.attribution_text,
	enabled = excluded.enabled,
	provenance = excluded.provenance;

create table public.product_source_evaluations (
	id uuid primary key default gen_random_uuid(),
	source_key text not null references public.product_data_sources(key) on delete cascade,
	evaluation_kind text not null check (
		evaluation_kind in ('lifecycle', 'license', 'coverage', 'quality', 'reliability')
	),
	decision text not null check (
		decision in ('approved', 'trial', 'held', 'rejected', 'retired')
	),
	sample_size integer not null default 0 check (sample_size >= 0),
	matched_count integer not null default 0 check (
		matched_count >= 0 and matched_count <= sample_size
	),
	usable_count integer not null default 0 check (
		usable_count >= 0 and usable_count <= matched_count
	),
	summary text not null check (btrim(summary) <> ''),
	evidence_url text check (evidence_url is null or evidence_url ~ '^https://'),
	details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
	evaluated_at timestamptz not null default now(),
	created_at timestamptz not null default now()
);

create index product_source_evaluations_source_idx
	on public.product_source_evaluations (source_key, evaluated_at desc);

create index product_source_evaluations_decision_idx
	on public.product_source_evaluations (decision, evaluation_kind, evaluated_at desc);

alter table public.product_source_evaluations enable row level security;
alter table public.product_source_evaluations force row level security;

create policy "Authenticated users can read product source evaluations"
	on public.product_source_evaluations for select to authenticated using (true);

revoke all on table public.product_source_evaluations from public, anon, authenticated;
grant select on table public.product_source_evaluations to authenticated;
grant all on table public.product_source_evaluations to service_role;

insert into public.product_source_evaluations (
	source_key,
	evaluation_kind,
	decision,
	sample_size,
	matched_count,
	usable_count,
	summary,
	evidence_url,
	details,
	evaluated_at
)
values (
	'foodrepo',
	'lifecycle',
	'retired',
	0,
	0,
	0,
	'Coverage benchmarking was not run because the provider retired before evaluation. The retired source must not enter the live product fallback chain.',
	'https://www.foodrepo.org/en/blog/8-api-v3-released',
	jsonb_build_object(
		'planned_sample_size', 200,
		'retired_on', '2026-02-28',
		'checked_on', '2026-07-18',
		'replacement_source_key', 'open-food-facts'
	),
	'2026-07-18T00:00:00Z'
);
