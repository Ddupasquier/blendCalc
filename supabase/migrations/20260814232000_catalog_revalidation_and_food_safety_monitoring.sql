create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

insert into public.product_data_sources (
	key,
	display_name,
	source_type,
	homepage_url,
	api_base_url,
	terms_url,
	attribution_text,
	enabled,
	canonical_storage_allowed,
	canonical_license_name,
	canonical_policy_reviewed_at,
	api_redistribution_allowed,
	canonical_policy_notes,
	provenance
)
values
	(
		'open-fda-food-enforcement',
		'FDA Food Enforcement Reports',
		'external_api',
		'https://open.fda.gov/apis/food/enforcement/',
		'https://api.fda.gov/food/enforcement.json',
		'https://open.fda.gov/terms/',
		'Data provided by the U.S. Food and Drug Administration',
		true,
		true,
		'CC0-1.0',
		'2026-08-14T00:00:00Z'::timestamptz,
		true,
		'Official enforcement notices may be redistributed with source attribution. Product matches remain evidence-backed notices and are not medical advice.',
		'{"identityOwner":"migration","sourceRole":"official_food_safety_alerts","observationLicenseName":"CC0-1.0","medicalDecisionDisclaimerRequired":true,"publicApiEligible":true}'::jsonb
	),
	(
		'usda-fsis-recalls',
		'USDA FSIS Recalls and Public Health Alerts',
		'external_api',
		'https://www.fsis.usda.gov/recalls-alerts',
		'https://www.fsis.usda.gov/fsis/api/recall/v/1',
		'https://www.usda.gov/policies-and-links',
		'U.S. Department of Agriculture Food Safety and Inspection Service',
		true,
		true,
		'United States Government Work',
		'2026-08-14T00:00:00Z'::timestamptz,
		true,
		'Official recall and public-health alert notices may be retained with source attribution. Product matching remains conservative and evidence-backed.',
		'{"identityOwner":"migration","sourceRole":"official_meat_poultry_egg_safety_alerts","observationLicenseName":"United States Government Work","publicApiEligible":true}'::jsonb
	)
on conflict (key) do update set
	display_name = excluded.display_name,
	source_type = excluded.source_type,
	homepage_url = excluded.homepage_url,
	api_base_url = excluded.api_base_url,
	terms_url = excluded.terms_url,
	attribution_text = excluded.attribution_text,
	enabled = excluded.enabled,
	canonical_storage_allowed = excluded.canonical_storage_allowed,
	canonical_license_name = excluded.canonical_license_name,
	canonical_policy_reviewed_at = excluded.canonical_policy_reviewed_at,
	api_redistribution_allowed = excluded.api_redistribution_allowed,
	canonical_policy_notes = excluded.canonical_policy_notes,
	provenance = public.product_data_sources.provenance || excluded.provenance;

update public.product_data_sources
set provenance = provenance || case key
	when 'usda' then '{"observationLicenseName":"CC0-1.0"}'::jsonb
	when 'open-food-facts' then '{"observationLicenseName":"Open Database License 1.0"}'::jsonb
	else '{}'::jsonb
end
where key in ('usda', 'open-food-facts');

create table public.catalog_monitor_settings (
	id boolean primary key default true check (id),
	enabled boolean not null default false,
	product_batch_size integer not null default 10 check (product_batch_size between 1 and 50),
	safety_alert_page_size integer not null default 100 check (safety_alert_page_size between 1 and 1000),
	safety_alert_interval interval not null default interval '2 hours'
		check (safety_alert_interval between interval '1 hour' and interval '24 hours'),
	product_claim_timeout interval not null default interval '15 minutes'
		check (product_claim_timeout between interval '5 minutes' and interval '1 hour'),
	last_invocation_requested_at timestamptz,
	last_invocation_request_id bigint,
	last_invocation_error text,
	updated_at timestamptz not null default now()
);

insert into public.catalog_monitor_settings (id)
values (true)
on conflict (id) do nothing;

create trigger set_catalog_monitor_settings_updated_at
	before update on public.catalog_monitor_settings
	for each row execute function public.set_updated_at();

create table public.catalog_monitor_runs (
	id uuid primary key default gen_random_uuid(),
	invocation_source text not null check (invocation_source in ('cron', 'manual', 'test')),
	status text not null default 'running'
		check (status in ('running', 'completed', 'partial', 'failed')),
	started_at timestamptz not null default now(),
	finished_at timestamptz,
	product_jobs_claimed integer not null default 0 check (product_jobs_claimed >= 0),
	product_jobs_unchanged integer not null default 0 check (product_jobs_unchanged >= 0),
	product_jobs_changed integer not null default 0 check (product_jobs_changed >= 0),
	product_jobs_failed integer not null default 0 check (product_jobs_failed >= 0),
	safety_alerts_observed integer not null default 0 check (safety_alerts_observed >= 0),
	safety_alerts_changed integer not null default 0 check (safety_alerts_changed >= 0),
	safety_matches_activated integer not null default 0 check (safety_matches_activated >= 0),
	error_summary jsonb not null default '[]'::jsonb check (jsonb_typeof(error_summary) = 'array'),
	created_at timestamptz not null default now(),
	check (
		(status = 'running' and finished_at is null)
		or (status <> 'running' and finished_at is not null)
	)
);

create index catalog_monitor_runs_started_idx
	on public.catalog_monitor_runs (started_at desc);

create table public.catalog_revalidation_queue (
	id uuid primary key default gen_random_uuid(),
	shared_product_id uuid not null references public.shared_products(id) on delete cascade,
	provider_key text not null references public.product_data_sources(key) on delete restrict,
	source_reference text not null check (btrim(source_reference) <> ''),
	priority smallint not null default 50 check (priority between 1 and 100),
	revalidation_reason text not null default 'scheduled'
		check (revalidation_reason in ('initial_baseline', 'recently_used', 'scheduled', 'source_change', 'moderator_requested')),
	status text not null default 'queued'
		check (status in ('queued', 'running', 'retry', 'paused')),
	next_check_at timestamptz not null default now(),
	recheck_interval interval not null default interval '30 days'
		check (recheck_interval between interval '1 day' and interval '180 days'),
	last_checked_at timestamptz,
	last_result text check (
		last_result is null or last_result in (
			'baseline',
			'unchanged',
			'changed',
			'not_found',
			'rate_limited',
			'provider_unavailable',
			'invalid_response',
			'skipped'
		)
	),
	attempt_count integer not null default 0 check (attempt_count >= 0),
	consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
	last_error_code text,
	claimed_at timestamptz,
	claim_token uuid,
	claimed_by_run_id uuid references public.catalog_monitor_runs(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (shared_product_id, provider_key),
	check (
		(status = 'running' and claimed_at is not null and claim_token is not null)
		or (status <> 'running' and claimed_at is null and claim_token is null)
	)
);

create trigger set_catalog_revalidation_queue_updated_at
	before update on public.catalog_revalidation_queue
	for each row execute function public.set_updated_at();

create index catalog_revalidation_queue_due_idx
	on public.catalog_revalidation_queue (priority, next_check_at, id)
	where status in ('queued', 'retry');

create index catalog_revalidation_queue_product_idx
	on public.catalog_revalidation_queue (shared_product_id, provider_key);

create table public.catalog_provider_product_snapshots (
	id uuid primary key default gen_random_uuid(),
	shared_product_id uuid not null references public.shared_products(id) on delete restrict,
	provider_key text not null references public.product_data_sources(key) on delete restrict,
	source_reference text not null check (btrim(source_reference) <> ''),
	observation_id uuid not null references public.shared_product_observations(id) on delete restrict,
	content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
	provider_revision text,
	provider_updated_at timestamptz,
	normalized_snapshot jsonb not null check (jsonb_typeof(normalized_snapshot) = 'object'),
	observed_at timestamptz not null,
	created_at timestamptz not null default now(),
	unique (shared_product_id, provider_key, content_hash)
);

create index catalog_provider_product_snapshots_latest_idx
	on public.catalog_provider_product_snapshots (
		shared_product_id,
		provider_key,
		observed_at desc,
		created_at desc
	);

create table public.catalog_provider_change_reviews (
	id uuid primary key default gen_random_uuid(),
	shared_product_id uuid not null references public.shared_products(id) on delete cascade,
	provider_key text not null references public.product_data_sources(key) on delete restrict,
	snapshot_id uuid not null references public.catalog_provider_product_snapshots(id) on delete restrict,
	status text not null default 'pending'
		check (status in ('pending', 'accepted', 'rejected', 'superseded')),
	change_summary jsonb not null check (
		jsonb_typeof(change_summary) = 'object'
		and jsonb_typeof(change_summary -> 'changes') = 'array'
		and jsonb_array_length(change_summary -> 'changes') > 0
	),
	material_field_paths text[] not null check (cardinality(material_field_paths) > 0),
	reviewed_by uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz,
	review_note text,
	accepted_revision_id uuid references public.shared_product_revisions(id) on delete restrict,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (
		(status = 'pending' and reviewed_at is null)
		or (status <> 'pending' and reviewed_at is not null)
	),
	check (
		(status = 'accepted' and accepted_revision_id is not null)
		or (status <> 'accepted' and accepted_revision_id is null)
	)
);

create trigger set_catalog_provider_change_reviews_updated_at
	before update on public.catalog_provider_change_reviews
	for each row execute function public.set_updated_at();

create unique index catalog_provider_change_reviews_pending_unique
	on public.catalog_provider_change_reviews (shared_product_id, provider_key)
	where status = 'pending';

create index catalog_provider_change_reviews_status_idx
	on public.catalog_provider_change_reviews (status, created_at);

create table public.catalog_safety_alert_ingestion_cursors (
	provider_key text primary key references public.product_data_sources(key) on delete cascade,
	status text not null default 'queued'
		check (status in ('queued', 'running', 'retry', 'paused')),
	next_check_at timestamptz not null default now(),
	last_successful_at timestamptz,
	last_source_updated_at timestamptz,
	cursor_value jsonb not null default '{}'::jsonb check (jsonb_typeof(cursor_value) = 'object'),
	attempt_count integer not null default 0 check (attempt_count >= 0),
	consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
	last_error_code text,
	claimed_at timestamptz,
	claim_token uuid,
	claimed_by_run_id uuid references public.catalog_monitor_runs(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (
		(status = 'running' and claimed_at is not null and claim_token is not null)
		or (status <> 'running' and claimed_at is null and claim_token is null)
	)
);

create trigger set_catalog_safety_alert_ingestion_cursors_updated_at
	before update on public.catalog_safety_alert_ingestion_cursors
	for each row execute function public.set_updated_at();

insert into public.catalog_safety_alert_ingestion_cursors (provider_key)
values
	('open-fda-food-enforcement'),
	('usda-fsis-recalls')
on conflict (provider_key) do nothing;

create table public.official_food_safety_alerts (
	id uuid primary key default gen_random_uuid(),
	provider_key text not null references public.product_data_sources(key) on delete restrict,
	external_alert_id text not null check (btrim(external_alert_id) <> ''),
	recall_number text,
	event_id text,
	alert_type text not null check (alert_type in ('recall', 'public_health_alert')),
	classification text,
	status text not null,
	product_description text not null check (btrim(product_description) <> ''),
	reason text,
	recalling_organization text,
	distribution_pattern text,
	package_description text,
	code_information text,
	source_url text not null check (source_url ~ '^https://'),
	report_date date,
	recall_initiated_at date,
	terminated_at date,
	source_updated_at timestamptz,
	current_content_hash text not null check (current_content_hash ~ '^[a-f0-9]{64}$'),
	is_active boolean not null,
	first_seen_at timestamptz not null default now(),
	last_seen_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (provider_key, external_alert_id)
);

create trigger set_official_food_safety_alerts_updated_at
	before update on public.official_food_safety_alerts
	for each row execute function public.set_updated_at();

create index official_food_safety_alerts_active_report_idx
	on public.official_food_safety_alerts (report_date desc, provider_key)
	where is_active;

create table public.official_food_safety_alert_revisions (
	id uuid primary key default gen_random_uuid(),
	alert_id uuid not null references public.official_food_safety_alerts(id) on delete restrict,
	content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
	raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
	normalized_payload jsonb not null check (jsonb_typeof(normalized_payload) = 'object'),
	observed_at timestamptz not null,
	created_at timestamptz not null default now(),
	unique (alert_id, content_hash)
);

create index official_food_safety_alert_revisions_alert_idx
	on public.official_food_safety_alert_revisions (alert_id, observed_at desc);

create table public.official_food_safety_alert_identifiers (
	alert_id uuid not null references public.official_food_safety_alerts(id) on delete cascade,
	identifier_type text not null
		check (identifier_type in ('gtin', 'upc', 'lot_code', 'use_by_date', 'package_code')),
	normalized_value text not null check (btrim(normalized_value) <> ''),
	source_text text,
	created_at timestamptz not null default now(),
	primary key (alert_id, identifier_type, normalized_value)
);

create index official_food_safety_alert_identifiers_lookup_idx
	on public.official_food_safety_alert_identifiers (identifier_type, normalized_value);

create table public.official_food_safety_alert_matches (
	id uuid primary key default gen_random_uuid(),
	alert_id uuid not null references public.official_food_safety_alerts(id) on delete cascade,
	shared_product_id uuid not null references public.shared_products(id) on delete cascade,
	match_type text not null check (match_type in ('exact_gtin', 'probable_identity', 'manual')),
	status text not null check (status in ('active', 'needs_review', 'confirmed', 'dismissed', 'superseded')),
	requires_package_check boolean not null default false,
	match_evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(match_evidence) = 'object'),
	detected_at timestamptz not null default now(),
	reviewed_by uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz,
	review_note text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (alert_id, shared_product_id),
	check (
		(status in ('active', 'needs_review') and reviewed_at is null)
		or (status in ('confirmed', 'dismissed') and reviewed_at is not null)
		or status = 'superseded'
	),
	check (match_type <> 'probable_identity' or status <> 'active')
);

create trigger set_official_food_safety_alert_matches_updated_at
	before update on public.official_food_safety_alert_matches
	for each row execute function public.set_updated_at();

create index official_food_safety_alert_matches_visible_idx
	on public.official_food_safety_alert_matches (shared_product_id, status, detected_at desc)
	where status in ('active', 'confirmed');

create index official_food_safety_alert_matches_review_idx
	on public.official_food_safety_alert_matches (status, detected_at)
	where status = 'needs_review';

create table public.product_safety_alert_notifications (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	alert_match_id uuid not null references public.official_food_safety_alert_matches(id) on delete cascade,
	channel text not null default 'in_app' check (channel in ('in_app', 'email', 'push')),
	status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'read')),
	attempt_count integer not null default 0 check (attempt_count >= 0),
	last_attempted_at timestamptz,
	delivered_at timestamptz,
	read_at timestamptz,
	failure_code text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (user_id, alert_match_id, channel)
);

create trigger set_product_safety_alert_notifications_updated_at
	before update on public.product_safety_alert_notifications
	for each row execute function public.set_updated_at();

create index product_safety_alert_notifications_user_status_idx
	on public.product_safety_alert_notifications (user_id, status, created_at desc);

create or replace function public.prevent_immutable_catalog_monitor_evidence_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	raise exception 'Catalog monitor evidence is immutable';
end;
$$;

create trigger prevent_catalog_provider_product_snapshot_changes
	before update or delete on public.catalog_provider_product_snapshots
	for each row execute function public.prevent_immutable_catalog_monitor_evidence_changes();

create trigger prevent_official_food_safety_alert_revision_changes
	before update or delete on public.official_food_safety_alert_revisions
	for each row execute function public.prevent_immutable_catalog_monitor_evidence_changes();

create or replace function public.claim_catalog_revalidation_jobs(
	p_run_id uuid,
	p_limit integer default 10
)
returns table (
	id uuid,
	shared_product_id uuid,
	provider_key text,
	source_reference text,
	barcode text,
	product_name text,
	brand_owner text,
	food jsonb,
	claim_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
	v_claim_timeout interval;
begin
	if not exists (
		select 1
		from public.catalog_monitor_runs run
		where run.id = p_run_id and run.status = 'running'
	) then
		raise exception 'Catalog monitor run is not active';
	end if;

	select setting.product_claim_timeout
	into v_claim_timeout
	from public.catalog_monitor_settings setting
	where setting.id;

	update public.catalog_revalidation_queue queue
	set status = 'retry',
		claimed_at = null,
		claim_token = null,
		claimed_by_run_id = null,
		last_error_code = 'claim_expired',
		next_check_at = now()
	where queue.status = 'running'
		and queue.claimed_at < now() - coalesce(v_claim_timeout, interval '15 minutes');

	return query
	with due as (
		select queue.id
		from public.catalog_revalidation_queue queue
		join public.shared_products product on product.id = queue.shared_product_id
		join public.product_data_sources source on source.key = queue.provider_key
		where queue.status in ('queued', 'retry')
			and queue.next_check_at <= now()
			and product.status = 'active'
			and source.enabled
		order by queue.priority, queue.next_check_at, queue.id
		for update of queue skip locked
		limit v_limit
	),
	claimed as (
		update public.catalog_revalidation_queue queue
		set status = 'running',
			claimed_at = now(),
			claim_token = gen_random_uuid(),
			claimed_by_run_id = p_run_id,
			attempt_count = queue.attempt_count + 1
		from due
		where queue.id = due.id
		returning queue.*
	)
	select
		claimed.id,
		claimed.shared_product_id,
		claimed.provider_key,
		claimed.source_reference,
		product.barcode,
		product.product_name,
		product.brand_owner,
		product.food,
		claimed.claim_token
	from claimed
	join public.shared_products product on product.id = claimed.shared_product_id;
end;
$$;

create or replace function public.complete_catalog_revalidation_job(
	p_queue_id uuid,
	p_claim_token uuid,
	p_result text,
	p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_queue public.catalog_revalidation_queue%rowtype;
	v_failure boolean;
	v_failure_count integer;
begin
	select *
	into v_queue
	from public.catalog_revalidation_queue queue
	where queue.id = p_queue_id
		and queue.status = 'running'
		and queue.claim_token = p_claim_token
	for update;

	if not found then
		raise exception 'Catalog revalidation claim is no longer active';
	end if;

	if p_result not in (
		'baseline',
		'unchanged',
		'changed',
		'not_found',
		'rate_limited',
		'provider_unavailable',
		'invalid_response',
		'skipped'
	) then
		raise exception 'Unsupported catalog revalidation result';
	end if;

	v_failure := p_result in (
		'rate_limited',
		'provider_unavailable',
		'invalid_response'
	);
	v_failure_count := case
		when v_failure then v_queue.consecutive_failures + 1
		else 0
	end;

	update public.catalog_revalidation_queue
	set status = case when v_failure then 'retry' else 'queued' end,
		next_check_at = case
			when p_result = 'rate_limited' then now() + least(interval '24 hours', interval '30 minutes' * power(2, least(v_failure_count, 5)))
			when v_failure then now() + least(interval '7 days', interval '2 hours' * power(2, least(v_failure_count, 5)))
			when p_result = 'not_found' then now() + greatest(recheck_interval, interval '60 days')
			else now() + recheck_interval
		end,
		last_checked_at = now(),
		last_result = p_result,
		consecutive_failures = v_failure_count,
		last_error_code = nullif(btrim(p_error_code), ''),
		claimed_at = null,
		claim_token = null,
		claimed_by_run_id = null,
		revalidation_reason = 'scheduled'
	where id = p_queue_id;
end;
$$;

create or replace function public.record_catalog_provider_snapshot(
	p_queue_id uuid,
	p_claim_token uuid,
	p_raw_payload jsonb,
	p_normalized_snapshot jsonb,
	p_content_hash text,
	p_provider_revision text,
	p_provider_updated_at timestamptz,
	p_observed_at timestamptz,
	p_changes jsonb default '[]'::jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_queue public.catalog_revalidation_queue%rowtype;
	v_product public.shared_products%rowtype;
	v_source public.product_data_sources%rowtype;
	v_previous public.catalog_provider_product_snapshots%rowtype;
	v_observation_id uuid;
	v_snapshot_id uuid;
	v_change jsonb;
	v_material_paths text[];
	v_result text;
	v_source_license text;
begin
	if jsonb_typeof(p_raw_payload) <> 'object'
		or jsonb_typeof(p_normalized_snapshot) <> 'object'
		or jsonb_typeof(p_changes) <> 'array' then
		raise exception 'Catalog monitor payloads must use the expected JSON shapes';
	end if;
	if p_content_hash !~ '^[a-f0-9]{64}$' then
		raise exception 'Catalog monitor content hash is invalid';
	end if;
	if exists (
		select 1
		from jsonb_array_elements(p_changes) change
		where jsonb_typeof(change) <> 'object'
			or btrim(coalesce(change ->> 'field', '')) = ''
			or btrim(coalesce(change ->> 'label', '')) = ''
			or change ->> 'severity' not in ('low', 'medium', 'high')
			or not change ? 'previousValue'
			or not change ? 'observedValue'
	) then
		raise exception 'Catalog monitor change summary is invalid';
	end if;

	select *
	into v_queue
	from public.catalog_revalidation_queue queue
	where queue.id = p_queue_id
		and queue.status = 'running'
		and queue.claim_token = p_claim_token
	for update;
	if not found then
		raise exception 'Catalog revalidation claim is no longer active';
	end if;

	select * into v_product
	from public.shared_products product
	where product.id = v_queue.shared_product_id and product.status = 'active';
	if not found then
		raise exception 'Catalog product is no longer active';
	end if;

	select * into v_source
	from public.product_data_sources source
	where source.key = v_queue.provider_key and source.enabled;
	if not found then
		raise exception 'Catalog monitoring source is unavailable';
	end if;
	v_source_license := coalesce(
		nullif(v_source.provenance ->> 'observationLicenseName', ''),
		nullif(v_source.canonical_license_name, '')
	);
	if v_source_license is null then
		raise exception 'Catalog monitoring source has no reviewed observation licence';
	end if;

	select snapshot.*
	into v_previous
	from public.catalog_provider_product_snapshots snapshot
	where snapshot.shared_product_id = v_queue.shared_product_id
		and snapshot.provider_key = v_queue.provider_key
	order by snapshot.observed_at desc, snapshot.created_at desc
	limit 1;

	if found and v_previous.content_hash = p_content_hash then
		update public.shared_products
		set last_verified_at = greatest(coalesce(last_verified_at, p_observed_at), p_observed_at)
		where id = v_queue.shared_product_id;
		perform public.complete_catalog_revalidation_job(
			p_queue_id,
			p_claim_token,
			'unchanged',
			null
		);
		return 'unchanged';
	end if;

	insert into public.shared_product_observations (
		barcode,
		source,
		source_reference,
		source_license,
		raw_payload,
		normalized_food,
		content_hash,
		observed_at
	)
	values (
		v_product.barcode,
		v_queue.provider_key,
		v_queue.source_reference,
		v_source_license,
		p_raw_payload,
		p_normalized_snapshot,
		p_content_hash,
		p_observed_at
	)
	returning id into v_observation_id;

	insert into public.catalog_provider_product_snapshots (
		shared_product_id,
		provider_key,
		source_reference,
		observation_id,
		content_hash,
		provider_revision,
		provider_updated_at,
		normalized_snapshot,
		observed_at
	)
	values (
		v_queue.shared_product_id,
		v_queue.provider_key,
		v_queue.source_reference,
		v_observation_id,
		p_content_hash,
		nullif(btrim(p_provider_revision), ''),
		p_provider_updated_at,
		p_normalized_snapshot,
		p_observed_at
	)
	returning id into v_snapshot_id;

	if v_previous.id is null then
		v_result := 'baseline';
	elsif jsonb_array_length(p_changes) = 0 then
		v_result := 'unchanged';
	else
		v_result := 'changed';
		select array_agg(distinct change ->> 'field' order by change ->> 'field')
		into v_material_paths
		from jsonb_array_elements(p_changes) change;

		update public.catalog_provider_change_reviews
		set status = 'superseded',
			reviewed_at = now(),
			review_note = 'A newer provider observation superseded this pending review.'
		where shared_product_id = v_queue.shared_product_id
			and provider_key = v_queue.provider_key
			and status = 'pending';

		insert into public.catalog_provider_change_reviews (
			shared_product_id,
			provider_key,
			snapshot_id,
			change_summary,
			material_field_paths
		)
		values (
			v_queue.shared_product_id,
			v_queue.provider_key,
			v_snapshot_id,
			jsonb_build_object(
				'previousSnapshotId', v_previous.id,
				'observedAt', p_observed_at,
				'changes', p_changes
			),
			v_material_paths
		);

		for v_change in select value from jsonb_array_elements(p_changes)
		loop
			update public.shared_product_conflicts
			set status = 'superseded'
			where shared_product_id = v_queue.shared_product_id
				and field_path = v_change ->> 'field'
				and status = 'open';

			insert into public.shared_product_conflicts (
				shared_product_id,
				barcode,
				field_path,
				observed_values,
				severity
			)
			values (
				v_queue.shared_product_id,
				v_product.barcode,
				v_change ->> 'field',
				jsonb_build_array(
					jsonb_build_object('snapshotId', v_previous.id, 'value', v_change -> 'previousValue'),
					jsonb_build_object('snapshotId', v_snapshot_id, 'value', v_change -> 'observedValue')
				),
				v_change ->> 'severity'
			);
		end loop;
	end if;

	if v_result <> 'changed' then
		update public.shared_products
		set last_verified_at = greatest(coalesce(last_verified_at, p_observed_at), p_observed_at)
		where id = v_queue.shared_product_id;
	end if;

	perform public.complete_catalog_revalidation_job(
		p_queue_id,
		p_claim_token,
		v_result,
		null
	);
	return v_result;
end;
$$;

create or replace function public.confirm_catalog_provider_metadata_unchanged(
	p_queue_id uuid,
	p_claim_token uuid,
	p_provider_revision text,
	p_provider_updated_at timestamptz,
	p_observed_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_queue public.catalog_revalidation_queue%rowtype;
	v_latest public.catalog_provider_product_snapshots%rowtype;
begin
	select *
	into v_queue
	from public.catalog_revalidation_queue queue
	where queue.id = p_queue_id
		and queue.status = 'running'
		and queue.claim_token = p_claim_token
	for update;
	if not found then
		raise exception 'Catalog revalidation claim is no longer active';
	end if;

	select snapshot.*
	into v_latest
	from public.catalog_provider_product_snapshots snapshot
	where snapshot.shared_product_id = v_queue.shared_product_id
		and snapshot.provider_key = v_queue.provider_key
	order by snapshot.observed_at desc, snapshot.created_at desc
	limit 1;

	if v_latest.id is null
		or coalesce(nullif(btrim(v_latest.provider_revision), ''), '')
			<> coalesce(nullif(btrim(p_provider_revision), ''), '')
		or v_latest.provider_updated_at is distinct from p_provider_updated_at then
		return false;
	end if;

	update public.shared_products
	set last_verified_at = greatest(coalesce(last_verified_at, p_observed_at), p_observed_at)
	where id = v_queue.shared_product_id;

	perform public.complete_catalog_revalidation_job(
		p_queue_id,
		p_claim_token,
		'unchanged',
		null
	);
	return true;
end;
$$;

create or replace function public.claim_safety_alert_ingestion_sources(
	p_run_id uuid,
	p_limit integer default 2
)
returns table (
	provider_key text,
	cursor_value jsonb,
	last_successful_at timestamptz,
	claim_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_limit integer := greatest(1, least(coalesce(p_limit, 2), 10));
begin
	if not exists (
		select 1 from public.catalog_monitor_runs run
		where run.id = p_run_id and run.status = 'running'
	) then
		raise exception 'Catalog monitor run is not active';
	end if;

	update public.catalog_safety_alert_ingestion_cursors cursor_row
	set status = 'retry',
		claimed_at = null,
		claim_token = null,
		claimed_by_run_id = null,
		last_error_code = 'claim_expired',
		next_check_at = now()
	where cursor_row.status = 'running'
		and cursor_row.claimed_at < now() - interval '15 minutes';

	return query
	with due as (
		select cursor_row.provider_key
		from public.catalog_safety_alert_ingestion_cursors cursor_row
		join public.product_data_sources source on source.key = cursor_row.provider_key
		where cursor_row.status in ('queued', 'retry')
			and cursor_row.next_check_at <= now()
			and source.enabled
		order by cursor_row.next_check_at, cursor_row.provider_key
		for update of cursor_row skip locked
		limit v_limit
	),
	claimed as (
		update public.catalog_safety_alert_ingestion_cursors cursor_row
		set status = 'running',
			claimed_at = now(),
			claim_token = gen_random_uuid(),
			claimed_by_run_id = p_run_id,
			attempt_count = cursor_row.attempt_count + 1
		from due
		where cursor_row.provider_key = due.provider_key
		returning cursor_row.*
	)
	select
		claimed.provider_key,
		claimed.cursor_value,
		claimed.last_successful_at,
		claimed.claim_token
	from claimed;
end;
$$;

create or replace function public.complete_safety_alert_ingestion_source(
	p_provider_key text,
	p_claim_token uuid,
	p_success boolean,
	p_cursor_value jsonb default '{}'::jsonb,
	p_source_updated_at timestamptz default null,
	p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_interval interval;
	v_failures integer;
begin
	select setting.safety_alert_interval
	into v_interval
	from public.catalog_monitor_settings setting
	where setting.id;

	select cursor_row.consecutive_failures + 1
	into v_failures
	from public.catalog_safety_alert_ingestion_cursors cursor_row
	where cursor_row.provider_key = p_provider_key
		and cursor_row.status = 'running'
		and cursor_row.claim_token = p_claim_token
	for update;
	if not found then
		raise exception 'Safety alert ingestion claim is no longer active';
	end if;

	update public.catalog_safety_alert_ingestion_cursors
	set status = case when p_success then 'queued' else 'retry' end,
		next_check_at = case
			when p_success and coalesce((p_cursor_value ->> 'hasMore')::boolean, false)
				then now() + interval '5 minutes'
			when p_success then now() + coalesce(v_interval, interval '2 hours')
			else now() + least(interval '24 hours', interval '30 minutes' * power(2, least(v_failures, 5)))
		end,
		last_successful_at = case when p_success then now() else last_successful_at end,
		last_source_updated_at = case when p_success then p_source_updated_at else last_source_updated_at end,
		cursor_value = case when p_success then p_cursor_value else cursor_value end,
		consecutive_failures = case when p_success then 0 else v_failures end,
		last_error_code = nullif(btrim(p_error_code), ''),
		claimed_at = null,
		claim_token = null,
		claimed_by_run_id = null
	where provider_key = p_provider_key;
end;
$$;

create or replace function public.record_official_food_safety_alert(
	p_provider_key text,
	p_alert jsonb,
	p_raw_payload jsonb,
	p_normalized_payload jsonb,
	p_content_hash text,
	p_identifiers jsonb default '[]'::jsonb,
	p_probable_matches jsonb default '[]'::jsonb,
	p_observed_at timestamptz default now()
)
returns table (
	alert_id uuid,
	content_changed boolean,
	exact_matches_activated integer,
	probable_matches_queued integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_alert_id uuid;
	v_previous_hash text;
	v_is_active boolean;
	v_requires_package_check boolean;
	v_exact_count integer := 0;
	v_previous_active_exact_count integer := 0;
	v_current_active_exact_count integer := 0;
	v_probable_count integer := 0;
begin
	if jsonb_typeof(p_alert) <> 'object'
		or jsonb_typeof(p_raw_payload) <> 'object'
		or jsonb_typeof(p_normalized_payload) <> 'object'
		or jsonb_typeof(p_identifiers) <> 'array'
		or jsonb_typeof(p_probable_matches) <> 'array' then
		raise exception 'Official food safety alert payloads must use the expected JSON shapes';
	end if;
	if p_content_hash !~ '^[a-f0-9]{64}$' then
		raise exception 'Official food safety alert content hash is invalid';
	end if;
	if not exists (
		select 1
		from public.product_data_sources source
		where source.key = p_provider_key and source.enabled
	) then
		raise exception 'Official food safety alert provider is unavailable';
	end if;
	if btrim(coalesce(p_alert ->> 'externalAlertId', '')) = ''
		or btrim(coalesce(p_alert ->> 'productDescription', '')) = ''
		or btrim(coalesce(p_alert ->> 'sourceUrl', '')) !~ '^https://' then
		raise exception 'Official food safety alert identity is incomplete';
	end if;
	if p_alert ->> 'alertType' not in ('recall', 'public_health_alert') then
		raise exception 'Official food safety alert type is invalid';
	end if;

	v_is_active := coalesce((p_alert ->> 'isActive')::boolean, false);
	v_requires_package_check :=
		btrim(coalesce(p_alert ->> 'codeInformation', '')) <> ''
		or btrim(coalesce(p_alert ->> 'packageDescription', '')) <> '';

	select alert.id, alert.current_content_hash
	into v_alert_id, v_previous_hash
	from public.official_food_safety_alerts alert
	where alert.provider_key = p_provider_key
		and alert.external_alert_id = p_alert ->> 'externalAlertId'
	for update;

	insert into public.official_food_safety_alerts (
		provider_key,
		external_alert_id,
		recall_number,
		event_id,
		alert_type,
		classification,
		status,
		product_description,
		reason,
		recalling_organization,
		distribution_pattern,
		package_description,
		code_information,
		source_url,
		report_date,
		recall_initiated_at,
		terminated_at,
		source_updated_at,
		current_content_hash,
		is_active,
		first_seen_at,
		last_seen_at
	)
	values (
		p_provider_key,
		p_alert ->> 'externalAlertId',
		nullif(btrim(p_alert ->> 'recallNumber'), ''),
		nullif(btrim(p_alert ->> 'eventId'), ''),
		p_alert ->> 'alertType',
		nullif(btrim(p_alert ->> 'classification'), ''),
		coalesce(nullif(btrim(p_alert ->> 'status'), ''), 'unknown'),
		p_alert ->> 'productDescription',
		nullif(btrim(p_alert ->> 'reason'), ''),
		nullif(btrim(p_alert ->> 'recallingOrganization'), ''),
		nullif(btrim(p_alert ->> 'distributionPattern'), ''),
		nullif(btrim(p_alert ->> 'packageDescription'), ''),
		nullif(btrim(p_alert ->> 'codeInformation'), ''),
		p_alert ->> 'sourceUrl',
		nullif(p_alert ->> 'reportDate', '')::date,
		nullif(p_alert ->> 'recallInitiatedAt', '')::date,
		nullif(p_alert ->> 'terminatedAt', '')::date,
		nullif(p_alert ->> 'sourceUpdatedAt', '')::timestamptz,
		p_content_hash,
		v_is_active,
		p_observed_at,
		p_observed_at
	)
	on conflict (provider_key, external_alert_id) do update set
		recall_number = excluded.recall_number,
		event_id = excluded.event_id,
		alert_type = excluded.alert_type,
		classification = excluded.classification,
		status = excluded.status,
		product_description = excluded.product_description,
		reason = excluded.reason,
		recalling_organization = excluded.recalling_organization,
		distribution_pattern = excluded.distribution_pattern,
		package_description = excluded.package_description,
		code_information = excluded.code_information,
		source_url = excluded.source_url,
		report_date = excluded.report_date,
		recall_initiated_at = excluded.recall_initiated_at,
		terminated_at = excluded.terminated_at,
		source_updated_at = excluded.source_updated_at,
		current_content_hash = excluded.current_content_hash,
		is_active = excluded.is_active,
		last_seen_at = excluded.last_seen_at
	returning id into v_alert_id;

	insert into public.official_food_safety_alert_revisions (
		alert_id,
		content_hash,
		raw_payload,
		normalized_payload,
		observed_at
	)
	values (
		v_alert_id,
		p_content_hash,
		p_raw_payload,
		p_normalized_payload,
		p_observed_at
	)
	on conflict on constraint official_food_safety_alert_revisions_alert_id_content_hash_key
		do nothing;

	delete from public.official_food_safety_alert_identifiers identifier
	where identifier.alert_id = v_alert_id;

	insert into public.official_food_safety_alert_identifiers (
		alert_id,
		identifier_type,
		normalized_value,
		source_text
	)
	select
		v_alert_id,
		identifier ->> 'type',
		identifier ->> 'normalizedValue',
		nullif(btrim(identifier ->> 'sourceText'), '')
	from jsonb_array_elements(p_identifiers) identifier
	where identifier ->> 'type' in ('gtin', 'upc', 'lot_code', 'use_by_date', 'package_code')
		and btrim(coalesce(identifier ->> 'normalizedValue', '')) <> ''
	on conflict on constraint official_food_safety_alert_identifiers_pkey
		do nothing;

	if not v_is_active then
		update public.official_food_safety_alert_matches match
		set status = 'superseded'
		where match.alert_id = v_alert_id
			and match.status in ('active', 'needs_review', 'confirmed');
	else
		select count(*)
		into v_previous_active_exact_count
		from public.official_food_safety_alert_matches existing_match
		where existing_match.alert_id = v_alert_id
			and existing_match.match_type = 'exact_gtin'
			and existing_match.status in ('active', 'confirmed');

		insert into public.official_food_safety_alert_matches (
			alert_id,
			shared_product_id,
			match_type,
			status,
			requires_package_check,
			match_evidence
		)
		select distinct
			v_alert_id,
			product.id,
			'exact_gtin',
			'active',
			v_requires_package_check,
			jsonb_build_object(
				'providerKey', p_provider_key,
				'matchedIdentifier', identifier.normalized_value,
				'matchBasis', 'exact_gtin'
			)
		from public.official_food_safety_alert_identifiers identifier
		join public.shared_products product
			on lpad(product.barcode, 14, '0') = lpad(identifier.normalized_value, 14, '0')
		where identifier.alert_id = v_alert_id
			and identifier.identifier_type in ('gtin', 'upc')
			and product.status = 'active'
		on conflict on constraint official_food_safety_alert_match_alert_id_shared_product_id_key
		do update set
			match_type = 'exact_gtin',
			status = 'active',
			requires_package_check = excluded.requires_package_check,
			match_evidence = excluded.match_evidence,
			detected_at = now(),
			reviewed_by = null,
			reviewed_at = null,
			review_note = null;
		select count(*)
		into v_current_active_exact_count
		from public.official_food_safety_alert_matches current_match
		where current_match.alert_id = v_alert_id
			and current_match.match_type = 'exact_gtin'
			and current_match.status in ('active', 'confirmed');
		v_exact_count := greatest(
			0,
			v_current_active_exact_count - v_previous_active_exact_count
		);

		insert into public.official_food_safety_alert_matches (
			alert_id,
			shared_product_id,
			match_type,
			status,
			requires_package_check,
			match_evidence
		)
		select
			v_alert_id,
			(probable ->> 'sharedProductId')::uuid,
			'probable_identity',
			'needs_review',
			v_requires_package_check,
			coalesce(probable -> 'evidence', '{}'::jsonb)
		from jsonb_array_elements(p_probable_matches) probable
		join public.shared_products product
			on product.id = (probable ->> 'sharedProductId')::uuid
		where product.status = 'active'
			and jsonb_typeof(coalesce(probable -> 'evidence', '{}'::jsonb)) = 'object'
			and not exists (
				select 1
				from public.official_food_safety_alert_matches exact_match
				where exact_match.alert_id = v_alert_id
					and exact_match.shared_product_id = product.id
					and exact_match.match_type = 'exact_gtin'
			)
		on conflict on constraint official_food_safety_alert_match_alert_id_shared_product_id_key
		do update set
			match_type = case
				when public.official_food_safety_alert_matches.match_type = 'exact_gtin'
					then 'exact_gtin'
				else 'probable_identity'
			end,
			status = case
				when public.official_food_safety_alert_matches.match_type = 'exact_gtin'
					then public.official_food_safety_alert_matches.status
				else 'needs_review'
			end,
			requires_package_check = excluded.requires_package_check,
			match_evidence = case
				when public.official_food_safety_alert_matches.match_type = 'exact_gtin'
					then public.official_food_safety_alert_matches.match_evidence
				else excluded.match_evidence
			end,
			detected_at = now(),
			reviewed_by = case
				when public.official_food_safety_alert_matches.match_type = 'exact_gtin'
					then public.official_food_safety_alert_matches.reviewed_by
				else null
			end,
			reviewed_at = case
				when public.official_food_safety_alert_matches.match_type = 'exact_gtin'
					then public.official_food_safety_alert_matches.reviewed_at
				else null
			end,
			review_note = case
				when public.official_food_safety_alert_matches.match_type = 'exact_gtin'
					then public.official_food_safety_alert_matches.review_note
				else null
			end;
		get diagnostics v_probable_count = row_count;
	end if;

	return query select
		v_alert_id,
		v_previous_hash is not null and v_previous_hash is distinct from p_content_hash,
		v_exact_count,
		v_probable_count;
end;
$$;

create or replace function public.enqueue_product_safety_alert_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.status not in ('active', 'confirmed') then
		return new;
	end if;

	insert into public.product_safety_alert_notifications (
		user_id,
		alert_match_id,
		channel
	)
	select distinct
		item.user_id,
		new.id,
		'in_app'
	from public.user_food_list_items item
	where item.shared_product_id = new.shared_product_id
	on conflict (user_id, alert_match_id, channel) do nothing;

	return new;
end;
$$;

create or replace function public.mark_product_safety_alert_notification_read(
	p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if auth.uid() is null then
		raise exception 'Authentication is required';
	end if;

	update public.product_safety_alert_notifications notification
	set status = 'read',
		read_at = coalesce(notification.read_at, now())
	where notification.id = p_notification_id
		and notification.user_id = (select auth.uid());

	if not found then
		raise exception 'Food safety alert notification was not found';
	end if;
end;
$$;

create or replace function public.get_catalog_monitor_moderation_summary(
	p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
begin
	if not public.authorize_app_permission('moderation.data_health.read') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified moderator access is required.';
	end if;

	return jsonb_build_object(
		'settings', coalesce((
			select jsonb_build_object(
				'enabled', settings.enabled,
				'productBatchSize', settings.product_batch_size,
				'safetyAlertPageSize', settings.safety_alert_page_size,
				'lastInvocationRequestedAt', settings.last_invocation_requested_at,
				'lastInvocationRequestId', settings.last_invocation_request_id,
				'lastInvocationError', settings.last_invocation_error
			)
			from public.catalog_monitor_settings settings
			where settings.id
		), '{}'::jsonb),
		'queue', jsonb_build_object(
			'dueProducts', (
				select count(*)
				from public.catalog_revalidation_queue queue
				where queue.status in ('queued', 'retry')
					and queue.next_check_at <= now()
			),
			'retryingProducts', (
				select count(*)
				from public.catalog_revalidation_queue queue
				where queue.status = 'retry'
			),
			'pendingProviderChanges', (
				select count(*)
				from public.catalog_provider_change_reviews review
				where review.status = 'pending'
			),
			'pendingSafetyMatches', (
				select count(*)
				from public.official_food_safety_alert_matches match
				where match.status = 'needs_review'
			),
			'activeSafetyMatches', (
				select count(*)
				from public.official_food_safety_alert_matches match
				where match.status in ('active', 'confirmed')
			)
		),
		'recentRuns', coalesce((
			select jsonb_agg(to_jsonb(run_row) order by run_row.started_at desc)
			from (
				select
					run.id,
					run.status,
					run.invocation_source as "invocationSource",
					run.started_at as "startedAt",
					run.finished_at as "finishedAt",
					run.product_jobs_claimed as "productJobsClaimed",
					run.product_jobs_changed as "productJobsChanged",
					run.product_jobs_failed as "productJobsFailed",
					run.safety_alerts_observed as "safetyAlertsObserved",
					run.safety_alerts_changed as "safetyAlertsChanged",
					run.safety_matches_activated as "safetyMatchesActivated",
					run.error_summary as "errors"
				from public.catalog_monitor_runs run
				order by run.started_at desc
				limit 10
			) run_row
		), '[]'::jsonb),
		'providerChanges', coalesce((
			select jsonb_agg(to_jsonb(change_row) order by change_row.created_at)
			from (
				select
					review.id,
					review.shared_product_id as "sharedProductId",
					product.barcode,
					product.product_name as "productName",
					source.display_name as "sourceName",
					review.change_summary as "changeSummary",
					review.material_field_paths as "materialFieldPaths",
					snapshot.observed_at as "observedAt",
					review.created_at
				from public.catalog_provider_change_reviews review
				join public.shared_products product on product.id = review.shared_product_id
				join public.product_data_sources source on source.key = review.provider_key
				join public.catalog_provider_product_snapshots snapshot on snapshot.id = review.snapshot_id
				where review.status = 'pending'
				order by review.created_at
				limit v_limit
			) change_row
		), '[]'::jsonb),
		'safetyMatches', coalesce((
			select jsonb_agg(to_jsonb(match_row) order by match_row.detected_at)
			from (
				select
					match.id,
					match.shared_product_id as "sharedProductId",
					product.barcode,
					product.product_name as "productName",
					product.brand_owner as "brandOwner",
					alert.product_description as "alertProductDescription",
					alert.classification,
					alert.reason,
					alert.package_description as "packageDescription",
					alert.code_information as "codeInformation",
					alert.source_url as "sourceUrl",
					source.display_name as "sourceName",
					match.match_evidence as "matchEvidence",
					match.requires_package_check as "requiresPackageCheck",
					match.detected_at
				from public.official_food_safety_alert_matches match
				join public.official_food_safety_alerts alert on alert.id = match.alert_id
				join public.shared_products product on product.id = match.shared_product_id
				join public.product_data_sources source on source.key = alert.provider_key
				where match.status = 'needs_review'
				order by match.detected_at
				limit v_limit
			) match_row
		), '[]'::jsonb)
	);
end;
$$;

create or replace function public.review_official_food_safety_alert_match(
	p_match_id uuid,
	p_outcome text,
	p_review_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not public.authorize_app_permission('moderation.catalog.review') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog review access is required.';
	end if;
	if p_outcome not in ('confirmed', 'dismissed') then
		raise exception 'Food safety match review outcome is invalid';
	end if;
	if btrim(coalesce(p_review_note, '')) = '' then
		raise exception 'A review note is required';
	end if;

	update public.official_food_safety_alert_matches match
	set status = p_outcome,
		reviewed_by = (select auth.uid()),
		reviewed_at = now(),
		review_note = left(btrim(p_review_note), 2000)
	where match.id = p_match_id
		and match.status = 'needs_review';

	if not found then
		raise exception 'Food safety match is no longer waiting for review';
	end if;
end;
$$;

create or replace function public.review_catalog_provider_change(
	p_review_id uuid,
	p_outcome text,
	p_review_note text,
	p_accepted_revision_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_review public.catalog_provider_change_reviews%rowtype;
begin
	if not public.authorize_app_permission('moderation.catalog.review') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog review access is required.';
	end if;
	if p_outcome not in ('accepted', 'rejected', 'superseded') then
		raise exception 'Catalog provider change review outcome is invalid';
	end if;
	if btrim(coalesce(p_review_note, '')) = '' then
		raise exception 'A review note is required';
	end if;

	select *
	into v_review
	from public.catalog_provider_change_reviews review
	where review.id = p_review_id
		and review.status = 'pending'
	for update;
	if not found then
		raise exception 'Catalog provider change is no longer waiting for review';
	end if;

	if p_outcome = 'accepted' and not exists (
		select 1
		from public.shared_product_revisions revision
		where revision.id = p_accepted_revision_id
			and revision.shared_product_id = v_review.shared_product_id
			and revision.created_at >= v_review.created_at
	) then
		raise exception 'Accepted provider changes require the resulting catalog revision';
	end if;

	update public.catalog_provider_change_reviews
	set status = p_outcome,
		reviewed_by = (select auth.uid()),
		reviewed_at = now(),
		review_note = left(btrim(p_review_note), 2000),
		accepted_revision_id = case when p_outcome = 'accepted' then p_accepted_revision_id else null end
	where id = p_review_id;
end;
$$;

create trigger enqueue_product_safety_alert_notifications
	after insert or update of status on public.official_food_safety_alert_matches
	for each row execute function public.enqueue_product_safety_alert_notifications();

create or replace function public.sync_catalog_product_revalidation_queue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.status <> 'active' then
		update public.catalog_revalidation_queue queue
		set status = 'paused',
			claimed_at = null,
			claim_token = null,
			claimed_by_run_id = null
		where queue.shared_product_id = new.id;
		return new;
	end if;

	insert into public.catalog_revalidation_queue (
		shared_product_id,
		provider_key,
		source_reference,
		priority,
		revalidation_reason,
		status,
		next_check_at,
		recheck_interval
	)
	values (
		new.id,
		'open-food-facts',
		new.barcode,
		20,
		'initial_baseline',
		'queued',
		now(),
		interval '30 days'
	)
	on conflict (shared_product_id, provider_key) do update set
		source_reference = excluded.source_reference,
		status = case
			when public.catalog_revalidation_queue.status = 'running'
				then public.catalog_revalidation_queue.status
			else 'queued'
		end,
		next_check_at = least(public.catalog_revalidation_queue.next_check_at, now());

	if new.source = 'usda' and coalesce(new.source_reference, '') ~ '^[0-9]+$' then
		insert into public.catalog_revalidation_queue (
			shared_product_id,
			provider_key,
			source_reference,
			priority,
			revalidation_reason,
			status,
			next_check_at,
			recheck_interval
		)
		values (
			new.id,
			'usda',
			new.source_reference,
			20,
			'initial_baseline',
			'queued',
			now(),
			interval '30 days'
		)
		on conflict (shared_product_id, provider_key) do update set
			source_reference = excluded.source_reference,
			status = case
				when public.catalog_revalidation_queue.status = 'running'
					then public.catalog_revalidation_queue.status
				else 'queued'
			end,
			next_check_at = least(public.catalog_revalidation_queue.next_check_at, now());
	end if;
	return new;
end;
$$;

create trigger sync_catalog_product_revalidation_queue
	after insert or update of status, barcode, source, source_reference
	on public.shared_products
	for each row execute function public.sync_catalog_product_revalidation_queue();

create or replace function public.sync_catalog_observation_revalidation_queue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.source not in ('usda', 'open-food-facts')
		or btrim(coalesce(new.source_reference, '')) = '' then
		return new;
	end if;

	insert into public.catalog_revalidation_queue (
		shared_product_id,
		provider_key,
		source_reference,
		priority,
		revalidation_reason,
		next_check_at,
		recheck_interval
	)
	select
		product.id,
		new.source,
		new.source_reference,
		20,
		'initial_baseline',
		now(),
		interval '30 days'
	from public.shared_products product
	where product.barcode = new.barcode
		and product.status = 'active'
		and (new.source <> 'usda' or new.source_reference ~ '^[0-9]+$')
	on conflict (shared_product_id, provider_key) do update set
		source_reference = excluded.source_reference,
		next_check_at = least(public.catalog_revalidation_queue.next_check_at, now());
	return new;
end;
$$;

create trigger sync_catalog_observation_revalidation_queue
	after insert on public.shared_product_observations
	for each row execute function public.sync_catalog_observation_revalidation_queue();

create or replace function public.prioritize_recently_used_catalog_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.shared_product_id is null then
		return new;
	end if;

	update public.catalog_revalidation_queue queue
	set priority = least(queue.priority, 10),
		revalidation_reason = 'recently_used',
		recheck_interval = interval '1 day',
		next_check_at = least(queue.next_check_at, now() + interval '1 day')
	where queue.shared_product_id = new.shared_product_id
		and queue.status <> 'paused';
	return new;
end;
$$;

create trigger prioritize_recently_used_catalog_product
	after insert or update of shared_product_id on public.user_food_list_items
	for each row execute function public.prioritize_recently_used_catalog_product();

create or replace function public.request_catalog_monitor_run()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_settings public.catalog_monitor_settings%rowtype;
	v_project_url text;
	v_cron_secret text;
	v_request_id bigint;
begin
	select * into v_settings
	from public.catalog_monitor_settings setting
	where setting.id
	for update;

	if not coalesce(v_settings.enabled, false) then
		return null;
	end if;

	select decrypted_secret into v_project_url
	from vault.decrypted_secrets
	where name = 'blendcalc_project_url';
	select decrypted_secret into v_cron_secret
	from vault.decrypted_secrets
	where name = 'blendcalc_catalog_monitor_cron_secret';

	if v_project_url is null or v_cron_secret is null then
		update public.catalog_monitor_settings
		set last_invocation_error = 'required_vault_secret_missing'
		where id;
		return null;
	end if;

	select net.http_post(
		url := rtrim(v_project_url, '/') || '/functions/v1/catalog-monitor',
		headers := jsonb_build_object(
			'Content-Type', 'application/json',
			'x-catalog-monitor-secret', v_cron_secret
		),
		body := jsonb_build_object('invocationSource', 'cron')
	)
	into v_request_id;

	update public.catalog_monitor_settings
	set last_invocation_requested_at = now(),
		last_invocation_request_id = v_request_id,
		last_invocation_error = null
	where id;

	return v_request_id;
exception
	when others then
		update public.catalog_monitor_settings
		set last_invocation_error = left(sqlstate || ':' || sqlerrm, 500)
		where id;
		return null;
end;
$$;

alter table public.catalog_monitor_settings enable row level security;
alter table public.catalog_monitor_settings force row level security;
alter table public.catalog_monitor_runs enable row level security;
alter table public.catalog_monitor_runs force row level security;
alter table public.catalog_revalidation_queue enable row level security;
alter table public.catalog_revalidation_queue force row level security;
alter table public.catalog_provider_product_snapshots enable row level security;
alter table public.catalog_provider_product_snapshots force row level security;
alter table public.catalog_provider_change_reviews enable row level security;
alter table public.catalog_provider_change_reviews force row level security;
alter table public.catalog_safety_alert_ingestion_cursors enable row level security;
alter table public.catalog_safety_alert_ingestion_cursors force row level security;
alter table public.official_food_safety_alerts enable row level security;
alter table public.official_food_safety_alerts force row level security;
alter table public.official_food_safety_alert_revisions enable row level security;
alter table public.official_food_safety_alert_revisions force row level security;
alter table public.official_food_safety_alert_identifiers enable row level security;
alter table public.official_food_safety_alert_identifiers force row level security;
alter table public.official_food_safety_alert_matches enable row level security;
alter table public.official_food_safety_alert_matches force row level security;
alter table public.product_safety_alert_notifications enable row level security;
alter table public.product_safety_alert_notifications force row level security;

create policy "Users can read their food safety alert notifications"
	on public.product_safety_alert_notifications
	for select
	to authenticated
	using (user_id = (select auth.uid()));

revoke all on table public.catalog_monitor_settings from public, anon, authenticated;
revoke all on table public.catalog_monitor_runs from public, anon, authenticated;
revoke all on table public.catalog_revalidation_queue from public, anon, authenticated;
revoke all on table public.catalog_provider_product_snapshots from public, anon, authenticated;
revoke all on table public.catalog_provider_change_reviews from public, anon, authenticated;
revoke all on table public.catalog_safety_alert_ingestion_cursors from public, anon, authenticated;
revoke all on table public.official_food_safety_alerts from public, anon, authenticated;
revoke all on table public.official_food_safety_alert_revisions from public, anon, authenticated;
revoke all on table public.official_food_safety_alert_identifiers from public, anon, authenticated;
revoke all on table public.official_food_safety_alert_matches from public, anon, authenticated;
revoke all on table public.product_safety_alert_notifications from public, anon, authenticated;

grant select on table public.product_safety_alert_notifications to authenticated;

grant all on table public.catalog_monitor_settings to service_role;
grant all on table public.catalog_monitor_runs to service_role;
grant all on table public.catalog_revalidation_queue to service_role;
grant all on table public.catalog_provider_product_snapshots to service_role;
grant all on table public.catalog_provider_change_reviews to service_role;
grant all on table public.catalog_safety_alert_ingestion_cursors to service_role;
grant all on table public.official_food_safety_alerts to service_role;
grant all on table public.official_food_safety_alert_revisions to service_role;
grant all on table public.official_food_safety_alert_identifiers to service_role;
grant all on table public.official_food_safety_alert_matches to service_role;
grant all on table public.product_safety_alert_notifications to service_role;

revoke all on function public.prevent_immutable_catalog_monitor_evidence_changes()
	from public, anon, authenticated;
revoke all on function public.claim_catalog_revalidation_jobs(uuid, integer)
	from public, anon, authenticated;
revoke all on function public.complete_catalog_revalidation_job(uuid, uuid, text, text)
	from public, anon, authenticated;
revoke all on function public.record_catalog_provider_snapshot(uuid, uuid, jsonb, jsonb, text, text, timestamptz, timestamptz, jsonb)
	from public, anon, authenticated;
revoke all on function public.confirm_catalog_provider_metadata_unchanged(uuid, uuid, text, timestamptz, timestamptz)
	from public, anon, authenticated;
revoke all on function public.claim_safety_alert_ingestion_sources(uuid, integer)
	from public, anon, authenticated;
revoke all on function public.complete_safety_alert_ingestion_source(text, uuid, boolean, jsonb, timestamptz, text)
	from public, anon, authenticated;
revoke all on function public.enqueue_product_safety_alert_notifications()
	from public, anon, authenticated;
revoke all on function public.record_official_food_safety_alert(text, jsonb, jsonb, jsonb, text, jsonb, jsonb, timestamptz)
	from public, anon, authenticated;
revoke all on function public.sync_catalog_product_revalidation_queue()
	from public, anon, authenticated;
revoke all on function public.sync_catalog_observation_revalidation_queue()
	from public, anon, authenticated;
revoke all on function public.prioritize_recently_used_catalog_product()
	from public, anon, authenticated;
revoke all on function public.mark_product_safety_alert_notification_read(uuid)
	from public, anon, authenticated;
revoke all on function public.get_catalog_monitor_moderation_summary(integer)
	from public, anon, authenticated, service_role;
revoke all on function public.review_official_food_safety_alert_match(uuid, text, text)
	from public, anon, authenticated, service_role;
revoke all on function public.review_catalog_provider_change(uuid, text, text, uuid)
	from public, anon, authenticated, service_role;
revoke all on function public.request_catalog_monitor_run()
	from public, anon, authenticated;

grant execute on function public.claim_catalog_revalidation_jobs(uuid, integer)
	to service_role;
grant execute on function public.complete_catalog_revalidation_job(uuid, uuid, text, text)
	to service_role;
grant execute on function public.record_catalog_provider_snapshot(uuid, uuid, jsonb, jsonb, text, text, timestamptz, timestamptz, jsonb)
	to service_role;
grant execute on function public.confirm_catalog_provider_metadata_unchanged(uuid, uuid, text, timestamptz, timestamptz)
	to service_role;
grant execute on function public.claim_safety_alert_ingestion_sources(uuid, integer)
	to service_role;
grant execute on function public.complete_safety_alert_ingestion_source(text, uuid, boolean, jsonb, timestamptz, text)
	to service_role;
grant execute on function public.request_catalog_monitor_run()
	to service_role;
grant execute on function public.record_official_food_safety_alert(text, jsonb, jsonb, jsonb, text, jsonb, jsonb, timestamptz)
	to service_role;
grant execute on function public.mark_product_safety_alert_notification_read(uuid)
	to authenticated;
grant execute on function public.get_catalog_monitor_moderation_summary(integer)
	to authenticated;
grant execute on function public.review_official_food_safety_alert_match(uuid, text, text)
	to authenticated;
grant execute on function public.review_catalog_provider_change(uuid, text, text, uuid)
	to authenticated;

insert into public.catalog_revalidation_queue (
	shared_product_id,
	provider_key,
	source_reference,
	priority,
	revalidation_reason,
	next_check_at,
	recheck_interval
)
select
	product.id,
	'open-food-facts',
	product.barcode,
	case when recent_user_product.shared_product_id is null then 50 else 10 end,
	case when recent_user_product.shared_product_id is null then 'initial_baseline' else 'recently_used' end,
	now(),
	case
		when recent_user_product.shared_product_id is not null then interval '1 day'
		when product.updated_at >= now() - interval '90 days' then interval '30 days'
		else interval '90 days'
	end
from public.shared_products product
left join (
	select distinct item.shared_product_id
	from public.user_food_list_items item
	where item.shared_product_id is not null
		and item.updated_at >= now() - interval '30 days'
) recent_user_product on recent_user_product.shared_product_id = product.id
where product.status = 'active'
on conflict (shared_product_id, provider_key) do nothing;

insert into public.catalog_revalidation_queue (
	shared_product_id,
	provider_key,
	source_reference,
	priority,
	revalidation_reason,
	next_check_at,
	recheck_interval
)
select
	product.id,
	'usda',
	product.source_reference,
	case when recent_user_product.shared_product_id is null then 50 else 10 end,
	case when recent_user_product.shared_product_id is null then 'initial_baseline' else 'recently_used' end,
	now(),
	case
		when recent_user_product.shared_product_id is not null then interval '1 day'
		when product.updated_at >= now() - interval '90 days' then interval '30 days'
		else interval '90 days'
	end
from public.shared_products product
left join (
	select distinct item.shared_product_id
	from public.user_food_list_items item
	where item.shared_product_id is not null
		and item.updated_at >= now() - interval '30 days'
) recent_user_product on recent_user_product.shared_product_id = product.id
where product.status = 'active'
	and product.source = 'usda'
	and product.source_reference ~ '^[0-9]+$'
on conflict (shared_product_id, provider_key) do nothing;

insert into public.catalog_revalidation_queue (
	shared_product_id,
	provider_key,
	source_reference,
	priority,
	revalidation_reason,
	next_check_at,
	recheck_interval
)
select distinct on (product.id)
	product.id,
	'usda',
	observation.source_reference,
	case when recent_user_product.shared_product_id is null then 50 else 10 end,
	case when recent_user_product.shared_product_id is null then 'initial_baseline' else 'recently_used' end,
	now(),
	case
		when recent_user_product.shared_product_id is not null then interval '1 day'
		when product.updated_at >= now() - interval '90 days' then interval '30 days'
		else interval '90 days'
	end
from public.shared_products product
join public.shared_product_observations observation
	on observation.barcode = product.barcode
	and observation.source = 'usda'
	and observation.source_reference ~ '^[0-9]+$'
left join (
	select distinct item.shared_product_id
	from public.user_food_list_items item
	where item.shared_product_id is not null
		and item.updated_at >= now() - interval '30 days'
) recent_user_product on recent_user_product.shared_product_id = product.id
where product.status = 'active'
order by product.id, observation.observed_at desc, observation.created_at desc
on conflict (shared_product_id, provider_key) do update set
	source_reference = excluded.source_reference;

select cron.unschedule(jobid)
from cron.job
where jobname = 'blendcalc-catalog-monitor-hourly';

select cron.schedule(
	'blendcalc-catalog-monitor-hourly',
	'0 * * * *',
	$$select public.request_catalog_monitor_run();$$
);
