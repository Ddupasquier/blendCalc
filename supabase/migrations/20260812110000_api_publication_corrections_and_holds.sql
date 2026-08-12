create or replace function public.are_api_concern_evidence_urls_valid(
	p_evidence_urls text[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
	select cardinality(coalesce(p_evidence_urls, '{}'::text[])) <= 5
		and coalesce(bool_and(
			evidence_url ~ '^https://'
			and length(evidence_url) <= 2048
		), true)
	from unnest(coalesce(p_evidence_urls, '{}'::text[])) evidence_url;
$$;

insert into public.app_issue_codes (
	code,
	kind,
	domain,
	description,
	enabled
)
values
	(
		'PUBLICATION_CONCERN_INVALID',
		'error',
		'catalog',
		'The publication concern payload or target is invalid.',
		true
	),
	(
		'PUBLICATION_CONCERN_FAILED',
		'error',
		'catalog',
		'The publication concern could not be persisted.',
		true
	)
on conflict (code) do update set
	kind = excluded.kind,
	domain = excluded.domain,
	description = excluded.description,
	enabled = excluded.enabled,
	updated_at = now();

create table public.api_publication_concerns (
	id uuid primary key default gen_random_uuid(),
	reporter_type text not null check (
		reporter_type in ('user', 'provider', 'brand', 'rights-holder', 'other')
	),
	contact_name text,
	contact_email text not null check (
		contact_email = lower(btrim(contact_email))
		and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
	),
	reporter_user_id uuid references auth.users(id) on delete set null,
	concern_type text not null check (
		concern_type in (
			'product-correction',
			'rights-or-license',
			'attribution',
			'privacy',
			'source-retirement',
			'other'
		)
	),
	subject_type text not null check (
		subject_type in ('product', 'image', 'dataset', 'source')
	),
	shared_product_id uuid references public.shared_products(id) on delete restrict,
	food_image_asset_id uuid references public.food_image_assets(id) on delete restrict,
	dataset_key text references public.generic_food_datasets(key) on delete restrict,
	source_key text references public.product_data_sources(key) on delete restrict,
	subject_reference text not null check (
		btrim(subject_reference) <> '' and length(subject_reference) <= 256
	),
	concern_fingerprint text not null check (
		concern_fingerprint ~ '^[a-f0-9]{64}$'
	),
	details text not null check (
		btrim(details) <> '' and length(details) <= 4000
	),
	evidence_urls text[] not null default '{}'::text[]
		check (public.are_api_concern_evidence_urls_valid(evidence_urls)),
	status text not null default 'open' check (
		status in ('open', 'triaged', 'resolved', 'dismissed')
	),
	urgency text not null default 'normal' check (
		urgency in ('normal', 'urgent')
	),
	resolution_action text check (
		resolution_action is null
		or resolution_action in (
			'product-correction',
			'image-correction',
			'source-policy-correction',
			'publication-hold',
			'no-change'
		)
	),
	resolution_note text check (
		resolution_note is null or length(resolution_note) <= 4000
	),
	reviewed_by uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (
		(subject_type = 'product' and shared_product_id is not null
			and food_image_asset_id is null and dataset_key is null and source_key is null)
		or (subject_type = 'image' and food_image_asset_id is not null
			and shared_product_id is null and dataset_key is null and source_key is null)
		or (subject_type = 'dataset' and dataset_key is not null
			and shared_product_id is null and food_image_asset_id is null and source_key is null)
		or (subject_type = 'source' and source_key is not null
			and shared_product_id is null and food_image_asset_id is null and dataset_key is null)
	),
	check (
		(status in ('open', 'triaged') and reviewed_at is null)
		or (status in ('resolved', 'dismissed') and reviewed_at is not null
			and reviewed_by is not null and resolution_action is not null)
	)
);

create trigger set_api_publication_concerns_updated_at
	before update on public.api_publication_concerns
	for each row execute function public.set_updated_at();

create index api_publication_concerns_open_created_idx
	on public.api_publication_concerns (urgency desc, created_at)
	where status in ('open', 'triaged');

create index api_publication_concerns_product_idx
	on public.api_publication_concerns (shared_product_id, created_at desc)
	where shared_product_id is not null;

create index api_publication_concerns_image_idx
	on public.api_publication_concerns (food_image_asset_id, created_at desc)
	where food_image_asset_id is not null;

create unique index api_publication_concerns_active_fingerprint_unique
	on public.api_publication_concerns (concern_fingerprint)
	where status in ('open', 'triaged');

create table public.api_publication_holds (
	id uuid primary key default gen_random_uuid(),
	subject_type text not null check (
		subject_type in ('product', 'image', 'dataset', 'source')
	),
	shared_product_id uuid references public.shared_products(id) on delete restrict,
	food_image_asset_id uuid references public.food_image_assets(id) on delete restrict,
	dataset_key text references public.generic_food_datasets(key) on delete restrict,
	source_key text references public.product_data_sources(key) on delete restrict,
	reason_code text not null check (
		reason_code in (
			'accuracy-review',
			'rights-review',
			'attribution-review',
			'privacy-review',
			'source-retirement',
			'legal-request'
		)
	),
	public_message text not null check (
		btrim(public_message) <> '' and length(public_message) <= 500
	),
	internal_note text not null check (
		btrim(internal_note) <> '' and length(internal_note) <= 4000
	),
	concern_id uuid references public.api_publication_concerns(id) on delete set null,
	placed_by uuid references auth.users(id) on delete restrict,
	placed_at timestamptz not null default now(),
	released_by uuid references auth.users(id) on delete restrict,
	released_at timestamptz,
	release_note text check (
		release_note is null or length(release_note) <= 4000
	),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (
		(subject_type = 'product' and shared_product_id is not null
			and food_image_asset_id is null and dataset_key is null and source_key is null)
		or (subject_type = 'image' and food_image_asset_id is not null
			and shared_product_id is null and dataset_key is null and source_key is null)
		or (subject_type = 'dataset' and dataset_key is not null
			and shared_product_id is null and food_image_asset_id is null and source_key is null)
		or (subject_type = 'source' and source_key is not null
			and shared_product_id is null and food_image_asset_id is null and dataset_key is null)
	),
	check (
		(released_at is null and released_by is null and release_note is null)
		or (released_at is not null and released_by is not null
			and nullif(btrim(release_note), '') is not null)
	)
);

create trigger set_api_publication_holds_updated_at
	before update on public.api_publication_holds
	for each row execute function public.set_updated_at();

create or replace function public.validate_api_publication_hold_concern_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	concern public.api_publication_concerns%rowtype;
begin
	if new.concern_id is null then
		return new;
	end if;

	select report.* into concern
	from public.api_publication_concerns report
	where report.id = new.concern_id;

	if not found
		or concern.subject_type <> new.subject_type
		or concern.shared_product_id is distinct from new.shared_product_id
		or concern.food_image_asset_id is distinct from new.food_image_asset_id
		or concern.dataset_key is distinct from new.dataset_key
		or concern.source_key is distinct from new.source_key
	then
		raise exception using
			errCode = '23514',
			message = 'API_PUBLICATION_HOLD_CONCERN_MISMATCH';
	end if;

	return new;
end;
$$;

create trigger validate_api_publication_hold_concern_target
	before insert or update of concern_id on public.api_publication_holds
	for each row execute function public.validate_api_publication_hold_concern_target();

create or replace function public.validate_api_publication_concern_resolution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.status = 'dismissed' and new.resolution_action <> 'no-change' then
		raise exception using
			errCode = '23514',
			message = 'API_PUBLICATION_DISMISSAL_ACTION_INVALID';
	end if;

	if new.status = 'resolved'
		and new.resolution_action = 'publication-hold'
		and not exists (
			select 1
			from public.api_publication_holds hold
			where hold.concern_id = new.id
		)
	then
		raise exception using
			errCode = '23514',
			message = 'API_PUBLICATION_RESOLUTION_HOLD_MISSING';
	end if;

	return new;
end;
$$;

create trigger validate_api_publication_concern_resolution
	before update of status, resolution_action on public.api_publication_concerns
	for each row execute function public.validate_api_publication_concern_resolution();

create unique index api_publication_holds_active_product_unique
	on public.api_publication_holds (shared_product_id)
	where released_at is null and shared_product_id is not null;

create unique index api_publication_holds_active_image_unique
	on public.api_publication_holds (food_image_asset_id)
	where released_at is null and food_image_asset_id is not null;

create unique index api_publication_holds_active_dataset_unique
	on public.api_publication_holds (dataset_key)
	where released_at is null and dataset_key is not null;

create unique index api_publication_holds_active_source_unique
	on public.api_publication_holds (source_key)
	where released_at is null and source_key is not null;

alter table public.api_publication_concerns enable row level security;
alter table public.api_publication_concerns force row level security;
alter table public.api_publication_holds enable row level security;
alter table public.api_publication_holds force row level security;

revoke all on table public.api_publication_concerns
	from public, anon, authenticated;
revoke all on table public.api_publication_holds
	from public, anon, authenticated;
grant all on table public.api_publication_concerns to service_role;
grant all on table public.api_publication_holds to service_role;

revoke all on function public.are_api_concern_evidence_urls_valid(text[])
	from public, anon, authenticated;
revoke all on function public.validate_api_publication_hold_concern_target()
	from public, anon, authenticated;
revoke all on function public.validate_api_publication_concern_resolution()
	from public, anon, authenticated;
grant execute on function public.are_api_concern_evidence_urls_valid(text[])
	to service_role;
grant execute on function public.validate_api_publication_hold_concern_target()
	to service_role;
grant execute on function public.validate_api_publication_concern_resolution()
	to service_role;

create or replace function public.blendcalc_api_v1_source_has_active_hold(
	p_source text,
	p_source_reference text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.api_publication_holds hold
		where hold.released_at is null
			and (
				(hold.source_key = case
					when p_source in ('community', 'community-reviewed')
						then 'shared-catalog'
					else p_source
				end)
				or (
					hold.dataset_key is not null
					and hold.dataset_key = split_part(btrim(p_source_reference), ':', 1)
				)
			)
	);
$$;

create or replace function public.sync_product_publication_hold_conflict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	product_barcode text;
begin
	if new.shared_product_id is null then
		return new;
	end if;

	if tg_op = 'INSERT' then
		select product.barcode
		into product_barcode
		from public.shared_products product
		where product.id = new.shared_product_id;

		insert into public.shared_product_conflicts (
			shared_product_id,
			barcode,
			field_path,
			observed_values,
			severity,
			status
		)
		values (
			new.shared_product_id,
			product_barcode,
			'api-publication-hold:' || new.id::text,
			jsonb_build_array(jsonb_build_object(
				'reasonCode', new.reason_code,
				'publicMessage', new.public_message
			)),
			'high',
			'open'
		);
	elsif old.released_at is null and new.released_at is not null then
		update public.shared_product_conflicts conflict
		set
			status = 'resolved',
			resolution_note = new.release_note,
			resolved_by = new.released_by,
			resolved_at = new.released_at
		where conflict.shared_product_id = new.shared_product_id
			and conflict.field_path = 'api-publication-hold:' || new.id::text
			and conflict.status = 'open';
	end if;

	return new;
end;
$$;

create trigger sync_api_product_publication_hold_conflict
	after insert or update of released_at on public.api_publication_holds
	for each row execute function public.sync_product_publication_hold_conflict();

revoke all on function public.blendcalc_api_v1_source_has_active_hold(text, text)
	from public, anon, authenticated;
revoke all on function public.sync_product_publication_hold_conflict()
	from public, anon, authenticated;
grant execute on function public.blendcalc_api_v1_source_has_active_hold(text, text)
	to service_role;
grant execute on function public.sync_product_publication_hold_conflict()
	to service_role;

create or replace function public.blendcalc_api_v1_source_attribution_is_complete(
	p_source text,
	p_source_reference text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	with source_policy as (
		select source.*
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
			and nullif(btrim(source.display_name), '') is not null
			and nullif(btrim(source.homepage_url), '') is not null
			and nullif(btrim(source.canonical_license_name), '') is not null
			and nullif(btrim(source.terms_url), '') is not null
			and nullif(btrim(source.attribution_text), '') is not null
	), dataset_source as (
		select exists (
			select 1
			from public.generic_food_datasets dataset
			join source_policy source on source.key = dataset.source_key
		) as has_datasets
	), referenced_dataset as (
		select split_part(btrim(p_source_reference), ':', 1) as dataset_key
		where position(':' in coalesce(p_source_reference, '')) > 1
	)
	select exists (select 1 from source_policy)
		and not public.blendcalc_api_v1_source_has_active_hold(
			p_source,
			p_source_reference
		)
		and (
			not (select has_datasets from dataset_source)
			or exists (
				select 1
				from referenced_dataset reference
				join public.generic_food_datasets dataset
					on dataset.key = reference.dataset_key
				join source_policy source
					on source.key = dataset.source_key
				where dataset.active
					and dataset.import_enabled
					and dataset.license_review_status = 'approved'
					and nullif(btrim(dataset.display_name), '') is not null
					and nullif(btrim(dataset.version), '') is not null
					and nullif(btrim(dataset.source_url), '') is not null
					and nullif(btrim(dataset.license_name), '') is not null
					and nullif(btrim(dataset.license_url), '') is not null
					and nullif(btrim(dataset.attribution_text), '') is not null
					and dataset.imported_at is not null
			)
		);
$$;

revoke all on function public.blendcalc_api_v1_source_attribution_is_complete(text, text)
	from public, anon, authenticated;
grant execute on function public.blendcalc_api_v1_source_attribution_is_complete(text, text)
	to service_role;

comment on table public.api_publication_concerns is
	'Private evidence-backed correction, attribution, privacy, source, and rights concerns submitted by users, providers, brands, rights holders, or other reporters.';
comment on table public.api_publication_holds is
	'Reversible API publication holds that immediately withhold a product, image, dataset release, or source without deleting canonical revisions or private evidence.';
comment on function public.are_api_concern_evidence_urls_valid(text[]) is
	'Validates the bounded HTTPS evidence-reference list retained with a publication concern.';
comment on function public.validate_api_publication_hold_concern_target() is
	'Requires a hold linked to a concern to target the exact same canonical subject.';
comment on function public.validate_api_publication_concern_resolution() is
	'Requires dismissed concerns to record no change and hold resolutions to reference an actual hold.';
comment on function public.blendcalc_api_v1_source_has_active_hold(text, text) is
	'Fails API source publication while either the represented provider or exact dataset release has an active hold.';
comment on function public.sync_product_publication_hold_conflict() is
	'Mirrors a product publication hold into the existing material-conflict gate and resolves only that hold conflict when released.';
