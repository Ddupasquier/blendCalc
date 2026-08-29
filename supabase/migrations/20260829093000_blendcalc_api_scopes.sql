begin;

create table public.blendcalc_api_scopes (
	key text primary key,
	display_name text not null,
	description text not null,
	risk_level text not null check (risk_level in ('read', 'write', 'privileged')),
	enabled boolean not null default true,
	source_reference text not null,
	reviewed_at timestamptz not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint blendcalc_api_scopes_key_format check (
		key ~ '^[a-z]+(?:[.-][a-z]+)*$'
	)
);

create table public.blendcalc_api_scope_policies (
	operation_key text primary key,
	required_scope text not null references public.blendcalc_api_scopes(key),
	description text not null,
	enabled boolean not null default true,
	source_reference text not null,
	reviewed_at timestamptz not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint blendcalc_api_scope_policies_operation_key_format check (
		operation_key ~ '^[a-z]+(?:[.-][a-z]+)*$'
	)
);

alter table public.blendcalc_api_scopes enable row level security;
alter table public.blendcalc_api_scope_policies enable row level security;

revoke all
	on table public.blendcalc_api_scopes,
		public.blendcalc_api_scope_policies
	from public, anon, authenticated;

grant select
	on table public.blendcalc_api_scopes,
		public.blendcalc_api_scope_policies
	to service_role;

insert into public.blendcalc_api_scopes (
	key, display_name, description, risk_level, source_reference, reviewed_at
)
values
	('catalog.read', 'Read catalog', 'Read publication-ready catalog products, categories, and revision metadata.', 'read', 'blendCalcAPI access policy 2026-08-29', '2026-08-29T00:00:00Z'),
	('intake.write', 'Submit catalog intake', 'Submit bounded product observations to the existing catalog intake workflow.', 'write', 'blendCalcAPI access policy 2026-08-29', '2026-08-29T00:00:00Z'),
	('corrections.write', 'Submit corrections', 'Submit bounded evidence-backed corrections without directly changing canonical data.', 'write', 'blendCalcAPI access policy 2026-08-29', '2026-08-29T00:00:00Z'),
	('moderation.read', 'Read moderation work', 'Read private moderation queues and supporting evidence.', 'privileged', 'blendCalcAPI access policy 2026-08-29', '2026-08-29T00:00:00Z'),
	('moderation.write', 'Resolve moderation work', 'Record reviewed moderation decisions through approved server workflows.', 'privileged', 'blendCalcAPI access policy 2026-08-29', '2026-08-29T00:00:00Z'),
	('administration', 'Administer API access', 'Manage API clients, credentials, policies, and other explicitly approved administrative operations.', 'privileged', 'blendCalcAPI access policy 2026-08-29', '2026-08-29T00:00:00Z');

insert into public.blendcalc_api_scope_policies (
	operation_key, required_scope, description, source_reference, reviewed_at
)
values
	('catalog.read', 'catalog.read', 'Read one bounded publication-ready catalog response.', 'blendCalcAPI access policy 2026-08-29', '2026-08-29T00:00:00Z'),
	('intake.submit', 'intake.write', 'Submit one bounded observation through catalog intake.', 'blendCalcAPI access policy 2026-08-29', '2026-08-29T00:00:00Z'),
	('corrections.submit', 'corrections.write', 'Submit one bounded evidence-backed correction.', 'blendCalcAPI access policy 2026-08-29', '2026-08-29T00:00:00Z'),
	('moderation.read', 'moderation.read', 'Read one bounded moderation resource.', 'blendCalcAPI access policy 2026-08-29', '2026-08-29T00:00:00Z'),
	('moderation.resolve', 'moderation.write', 'Record one reviewed moderation resolution.', 'blendCalcAPI access policy 2026-08-29', '2026-08-29T00:00:00Z'),
	('administration.manage', 'administration', 'Manage one approved API administration resource.', 'blendCalcAPI access policy 2026-08-29', '2026-08-29T00:00:00Z');

commit;
