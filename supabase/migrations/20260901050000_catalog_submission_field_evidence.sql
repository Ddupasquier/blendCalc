create function public.catalog_intake_evidence_references_are_valid(
	p_references text[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
	select
		coalesce(cardinality(p_references) between 1 and 16, false)
		and array_position(p_references, null) is null
		and not exists (
			select 1
			from unnest(p_references) reference
			where btrim(reference) = ''
				or reference <> btrim(reference)
				or char_length(reference) > 128
		);
$$;

revoke all on function public.catalog_intake_evidence_references_are_valid(text[])
	from public, anon, authenticated;
grant execute on function public.catalog_intake_evidence_references_are_valid(text[])
	to service_role;

create table public.shared_product_submission_field_evidence (
	id uuid primary key default gen_random_uuid(),
	submission_id uuid not null
		references public.shared_product_submissions(id) on delete cascade,
	source_observation_id uuid not null
		references public.shared_product_observations(id) on delete cascade,
	field_path text not null check (
		field_path = btrim(field_path)
		and char_length(field_path) between 1 and 180
	),
	proposed_value jsonb not null check (jsonb_typeof(proposed_value) <> 'null'),
	unit text check (
		unit is null
		or (
			unit = btrim(unit)
			and char_length(unit) between 1 and 32
		)
	),
	basis jsonb check (basis is null or jsonb_typeof(basis) = 'object'),
	observed_at timestamptz not null check (
		observed_at >= '1970-01-01 00:00:00+00'::timestamptz
		and observed_at <= now() + interval '1 day'
	),
	confidence text not null check (
		confidence in ('user-reported', 'imported', 'unknown')
	),
	evidence_references text[] not null check (
		public.catalog_intake_evidence_references_are_valid(evidence_references)
	),
	created_at timestamptz not null default now(),
	unique (submission_id, source_observation_id, field_path)
);

create function public.catalog_intake_field_evidence_source_matches_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if not exists (
		select 1
		from public.shared_product_observations observation
		where observation.id = new.source_observation_id
			and observation.submission_id = new.submission_id
	) then
		raise exception 'Field evidence source observation must belong to the same submission.'
			using errcode = '23514';
	end if;

	return new;
end;
$$;

revoke all on function public.catalog_intake_field_evidence_source_matches_submission()
	from public, anon, authenticated, service_role;

create trigger require_catalog_intake_field_evidence_source_owner
	before insert or update of submission_id, source_observation_id
	on public.shared_product_submission_field_evidence
	for each row
	execute function public.catalog_intake_field_evidence_source_matches_submission();

create index shared_product_submission_field_evidence_submission_idx
	on public.shared_product_submission_field_evidence (submission_id, field_path);

alter table public.shared_product_submission_field_evidence enable row level security;
alter table public.shared_product_submission_field_evidence force row level security;

revoke all on table public.shared_product_submission_field_evidence
	from public, anon, authenticated, service_role;
grant select, insert on table public.shared_product_submission_field_evidence
	to service_role;

comment on table public.shared_product_submission_field_evidence is
	'Private field-level evidence for proposed catalog values. Canonical selection remains in shared_product_field_provenance.';
comment on column public.shared_product_submission_field_evidence.proposed_value is
	'Exact source value before canonical normalization; JSON null is not a proposed value.';
comment on column public.shared_product_submission_field_evidence.unit is
	'Exact source unit when the proposed value has one; null means not applicable or not reported.';
comment on column public.shared_product_submission_field_evidence.basis is
	'Exact source calculation or serving basis when applicable; null never implies a conversion.';
comment on column public.shared_product_submission_field_evidence.evidence_references is
	'Bounded client evidence identifiers or source evidence references; never private storage paths.';
