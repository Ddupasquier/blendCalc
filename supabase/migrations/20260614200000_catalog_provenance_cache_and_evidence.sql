alter table public.shared_product_submissions
	add column if not exists evidence_paths jsonb not null default '{}'::jsonb
		check (jsonb_typeof(evidence_paths) = 'object'),
	add column if not exists evidence_complete boolean not null default false;

alter table public.shared_products
	add column if not exists last_verified_at timestamptz,
	add column if not exists canonical_provenance jsonb not null default '{}'::jsonb
		check (jsonb_typeof(canonical_provenance) = 'object');

create table public.shared_product_observations (
	id uuid primary key default gen_random_uuid(),
	barcode text not null check (barcode ~ '^[0-9]{14}$'),
	source text not null
		check (source in ('usda', 'user-label', 'manufacturer', 'gs1')),
	source_reference text,
	source_license text not null,
	submission_id uuid references public.shared_product_submissions(id) on delete set null,
	submitted_by uuid references auth.users(id) on delete set null,
	raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
	normalized_food jsonb check (
		normalized_food is null or jsonb_typeof(normalized_food) = 'object'
	),
	content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
	observed_at timestamptz not null default now(),
	expires_at timestamptz,
	created_at timestamptz not null default now()
);

create index shared_product_observations_barcode_observed_idx
	on public.shared_product_observations (barcode, observed_at desc);

create index shared_product_observations_submission_idx
	on public.shared_product_observations (submission_id)
	where submission_id is not null;

create table public.shared_product_field_provenance (
	id uuid primary key default gen_random_uuid(),
	shared_product_id uuid not null references public.shared_products(id) on delete cascade,
	observation_id uuid not null references public.shared_product_observations(id) on delete restrict,
	field_path text not null check (btrim(field_path) <> ''),
	source_value jsonb not null,
	normalized_value jsonb not null,
	selected boolean not null default true,
	confidence text not null
		check (confidence in ('source-verified', 'moderator-reviewed', 'corroborated')),
	verification_method text not null
		check (verification_method in ('exact-barcode', 'label-review', 'cross-source')),
	created_at timestamptz not null default now(),
	unique (shared_product_id, observation_id, field_path)
);

create unique index shared_product_field_provenance_selected_unique
	on public.shared_product_field_provenance (shared_product_id, field_path)
	where selected;

create index shared_product_field_provenance_observation_idx
	on public.shared_product_field_provenance (observation_id);

create table public.shared_product_conflicts (
	id uuid primary key default gen_random_uuid(),
	shared_product_id uuid not null references public.shared_products(id) on delete cascade,
	barcode text not null check (barcode ~ '^[0-9]{14}$'),
	field_path text not null check (btrim(field_path) <> ''),
	observed_values jsonb not null check (jsonb_typeof(observed_values) = 'array'),
	severity text not null check (severity in ('low', 'medium', 'high')),
	status text not null default 'open' check (status in ('open', 'resolved', 'superseded')),
	resolution_note text,
	resolved_by uuid references auth.users(id) on delete set null,
	resolved_at timestamptz,
	created_at timestamptz not null default now()
);

create index shared_product_conflicts_open_product_idx
	on public.shared_product_conflicts (shared_product_id, severity, created_at desc)
	where status = 'open';

create table public.product_api_cache (
	provider text not null check (provider = 'usda'),
	cache_key text not null,
	request_kind text not null check (request_kind in ('search', 'barcode-search', 'food-detail')),
	status_code integer not null check (status_code between 100 and 599),
	response jsonb not null,
	fetched_at timestamptz not null default now(),
	expires_at timestamptz not null,
	etag text,
	primary key (provider, cache_key)
);

create index product_api_cache_expiry_idx
	on public.product_api_cache (expires_at);

alter table public.shared_product_observations enable row level security;
alter table public.shared_product_observations force row level security;
alter table public.shared_product_field_provenance enable row level security;
alter table public.shared_product_field_provenance force row level security;
alter table public.shared_product_conflicts enable row level security;
alter table public.shared_product_conflicts force row level security;
alter table public.product_api_cache enable row level security;
alter table public.product_api_cache force row level security;

revoke all on table public.shared_product_observations from public, anon, authenticated;
revoke all on table public.shared_product_field_provenance from public, anon, authenticated;
revoke all on table public.shared_product_conflicts from public, anon, authenticated;
revoke all on table public.product_api_cache from public, anon, authenticated;

insert into storage.buckets (
	id,
	name,
	public,
	file_size_limit,
	allowed_mime_types
)
values (
	'product-submission-evidence',
	'product-submission-evidence',
	false,
	8388608,
	array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
	public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their product evidence"
	on storage.objects
	for select
	to authenticated
	using (
		bucket_id = 'product-submission-evidence'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

create policy "Users can upload their product evidence"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'product-submission-evidence'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

create policy "Users can delete their product evidence"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'product-submission-evidence'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

drop function if exists public.publish_shared_product_submission(
	uuid, jsonb, text, text, text, text, text, uuid
);

create function public.publish_shared_product_submission(
	p_submission_id uuid,
	p_food jsonb,
	p_product_name text,
	p_brand_owner text,
	p_source text,
	p_source_reference text,
	p_confidence text,
	p_approved_by uuid default null,
	p_observations jsonb default '[]'::jsonb,
	p_provenance jsonb default '[]'::jsonb,
	p_conflicts jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_submission public.shared_product_submissions%rowtype;
	v_product_id uuid;
	v_revision_number integer;
	v_observation jsonb;
	v_provenance jsonb;
	v_conflict jsonb;
	v_observation_id uuid;
	v_observation_ids jsonb := '{}'::jsonb;
	v_canonical_provenance jsonb := '{}'::jsonb;
begin
	if p_source not in ('usda', 'community-reviewed') then
		raise exception 'Unsupported shared product source';
	end if;
	if p_confidence not in ('source-verified', 'moderator-reviewed', 'corroborated') then
		raise exception 'Unsupported shared product confidence';
	end if;
	if jsonb_typeof(p_food) <> 'object' then
		raise exception 'Shared product food must be a JSON object';
	end if;
	if jsonb_typeof(p_observations) <> 'array'
		or jsonb_typeof(p_provenance) <> 'array'
		or jsonb_typeof(p_conflicts) <> 'array' then
		raise exception 'Catalog verification metadata must use arrays';
	end if;
	if btrim(p_product_name) = '' then
		raise exception 'Shared product name cannot be blank';
	end if;

	select *
	into v_submission
	from public.shared_product_submissions
	where id = p_submission_id
	for update;

	if not found then
		raise exception 'Shared product submission not found';
	end if;
	if v_submission.status <> 'pending' then
		raise exception 'Shared product submission has already been reviewed';
	end if;

	perform pg_advisory_xact_lock(hashtext(v_submission.barcode));

	for v_observation in select value from jsonb_array_elements(p_observations)
	loop
		insert into public.shared_product_observations (
			barcode,
			source,
			source_reference,
			source_license,
			submission_id,
			submitted_by,
			raw_payload,
			normalized_food,
			content_hash,
			observed_at,
			expires_at
		)
		values (
			v_submission.barcode,
			v_observation ->> 'source',
			nullif(v_observation ->> 'sourceReference', ''),
			v_observation ->> 'sourceLicense',
			v_submission.id,
			case when v_observation ->> 'source' = 'user-label'
				then v_submission.submitted_by else null end,
			coalesce(v_observation -> 'rawPayload', '{}'::jsonb),
			v_observation -> 'normalizedFood',
			v_observation ->> 'contentHash',
			coalesce((v_observation ->> 'observedAt')::timestamptz, now()),
			case when v_observation ? 'expiresAt'
				then (v_observation ->> 'expiresAt')::timestamptz else null end
		)
		returning id into v_observation_id;

		v_observation_ids := jsonb_set(
			v_observation_ids,
			array[v_observation ->> 'key'],
			to_jsonb(v_observation_id::text),
			true
		);
	end loop;

	insert into public.shared_products (
		barcode,
		product_name,
		brand_owner,
		search_text,
		food,
		source,
		source_reference,
		confidence,
		status,
		approved_submission_id,
		approved_by,
		last_verified_at
	)
	values (
		v_submission.barcode,
		btrim(p_product_name),
		nullif(btrim(p_brand_owner), ''),
		lower(concat_ws(' ', p_product_name, p_brand_owner, v_submission.barcode)),
		p_food,
		p_source,
		p_source_reference,
		p_confidence,
		'active',
		v_submission.id,
		p_approved_by,
		now()
	)
	on conflict (barcode) do update
	set product_name = excluded.product_name,
		brand_owner = excluded.brand_owner,
		search_text = excluded.search_text,
		food = excluded.food,
		source = excluded.source,
		source_reference = excluded.source_reference,
		confidence = excluded.confidence,
		status = 'active',
		approved_submission_id = excluded.approved_submission_id,
		approved_by = excluded.approved_by,
		last_verified_at = now(),
		updated_at = now()
	returning id into v_product_id;

	update public.shared_product_field_provenance
	set selected = false
	where shared_product_id = v_product_id and selected;

	for v_provenance in select value from jsonb_array_elements(p_provenance)
	loop
		v_observation_id := (v_observation_ids ->> (v_provenance ->> 'observationKey'))::uuid;
		insert into public.shared_product_field_provenance (
			shared_product_id,
			observation_id,
			field_path,
			source_value,
			normalized_value,
			selected,
			confidence,
			verification_method
		)
		values (
			v_product_id,
			v_observation_id,
			v_provenance ->> 'fieldPath',
			v_provenance -> 'sourceValue',
			v_provenance -> 'normalizedValue',
			true,
			v_provenance ->> 'confidence',
			v_provenance ->> 'verificationMethod'
		);

		v_canonical_provenance := jsonb_set(
			v_canonical_provenance,
			array[v_provenance ->> 'fieldPath'],
			jsonb_build_object(
				'source', v_provenance ->> 'observationKey',
				'confidence', v_provenance ->> 'confidence',
				'verificationMethod', v_provenance ->> 'verificationMethod'
			),
			true
		);
	end loop;

	update public.shared_products
	set canonical_provenance = v_canonical_provenance
	where id = v_product_id;

	update public.shared_product_conflicts
	set status = 'superseded'
	where shared_product_id = v_product_id and status = 'open';

	for v_conflict in select value from jsonb_array_elements(p_conflicts)
	loop
		insert into public.shared_product_conflicts (
			shared_product_id,
			barcode,
			field_path,
			observed_values,
			severity
		)
		values (
			v_product_id,
			v_submission.barcode,
			v_conflict ->> 'fieldPath',
			v_conflict -> 'observedValues',
			v_conflict ->> 'severity'
		);
	end loop;

	select coalesce(max(revision_number), 0) + 1
	into v_revision_number
	from public.shared_product_revisions
	where shared_product_id = v_product_id;

	insert into public.shared_product_revisions (
		shared_product_id,
		revision_number,
		food,
		source,
		source_reference,
		created_by
	)
	values (
		v_product_id,
		v_revision_number,
		p_food,
		p_source,
		p_source_reference,
		p_approved_by
	);

	update public.shared_product_submissions
	set status = 'approved',
		verification_status = case
			when p_source = 'usda' then 'source_verified'
			else 'manual_review'
		end,
		reviewed_by = p_approved_by,
		reviewed_at = now()
	where id = v_submission.id;

	return v_product_id;
end;
$$;

revoke all on function public.publish_shared_product_submission(
	uuid, jsonb, text, text, text, text, text, uuid, jsonb, jsonb, jsonb
)
	from public, anon, authenticated;
grant execute on function public.publish_shared_product_submission(
	uuid, jsonb, text, text, text, text, text, uuid, jsonb, jsonb, jsonb
)
	to service_role;
