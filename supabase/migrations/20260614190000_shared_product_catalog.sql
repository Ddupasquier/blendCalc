create extension if not exists pg_trgm;

create table public.shared_product_submissions (
	id uuid primary key default gen_random_uuid(),
	submitted_by uuid not null references auth.users(id) on delete cascade,
	barcode text not null check (barcode ~ '^[0-9]{14}$'),
	product_name text not null check (btrim(product_name) <> ''),
	brand_owner text,
	food jsonb not null check (jsonb_typeof(food) = 'object'),
	consent_to_share boolean not null check (consent_to_share),
	status text not null default 'pending'
		check (status in ('pending', 'approved', 'rejected')),
	verification_status text not null default 'unverified'
		check (verification_status in ('unverified', 'source_verified', 'manual_review')),
	matched_source text check (matched_source is null or matched_source in ('usda', 'open-food-facts')),
	matched_reference text,
	validation_report jsonb not null default '{}'::jsonb
		check (jsonb_typeof(validation_report) = 'object'),
	reviewed_by uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz,
	review_note text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table public.shared_products (
	id uuid primary key default gen_random_uuid(),
	barcode text not null unique check (barcode ~ '^[0-9]{14}$'),
	product_name text not null check (btrim(product_name) <> ''),
	brand_owner text,
	search_text text not null check (btrim(search_text) <> ''),
	food jsonb not null check (jsonb_typeof(food) = 'object'),
	source text not null check (source in ('usda', 'community-reviewed')),
	source_reference text,
	confidence text not null check (confidence in ('source-verified', 'moderator-reviewed')),
	status text not null default 'active' check (status in ('active', 'retired')),
	approved_submission_id uuid references public.shared_product_submissions(id) on delete set null,
	approved_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table public.shared_product_revisions (
	id uuid primary key default gen_random_uuid(),
	shared_product_id uuid not null references public.shared_products(id) on delete cascade,
	revision_number integer not null check (revision_number > 0),
	food jsonb not null check (jsonb_typeof(food) = 'object'),
	source text not null check (source in ('usda', 'community-reviewed')),
	source_reference text,
	created_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	unique (shared_product_id, revision_number)
);

create index shared_product_submissions_submitter_created_idx
	on public.shared_product_submissions (submitted_by, created_at desc);

create index shared_product_submissions_pending_created_idx
	on public.shared_product_submissions (created_at)
	where status = 'pending';

create unique index shared_product_submissions_user_pending_barcode_unique
	on public.shared_product_submissions (submitted_by, barcode)
	where status = 'pending';

create index shared_products_active_search_trgm_idx
	on public.shared_products using gin (search_text gin_trgm_ops)
	where status = 'active';

create index shared_product_revisions_product_created_idx
	on public.shared_product_revisions (shared_product_id, created_at desc);

create trigger set_shared_product_submissions_updated_at
	before update on public.shared_product_submissions
	for each row execute function public.set_updated_at();

create trigger set_shared_products_updated_at
	before update on public.shared_products
	for each row execute function public.set_updated_at();

alter table public.shared_product_submissions enable row level security;
alter table public.shared_product_submissions force row level security;
alter table public.shared_products enable row level security;
alter table public.shared_products force row level security;
alter table public.shared_product_revisions enable row level security;
alter table public.shared_product_revisions force row level security;

create policy "Users can read their product submissions"
	on public.shared_product_submissions
	for select
	to authenticated
	using (submitted_by = (select auth.uid()));

create policy "Authenticated users can read active shared products"
	on public.shared_products
	for select
	to authenticated
	using (status = 'active');

revoke all on table public.shared_product_submissions from anon, authenticated;
revoke all on table public.shared_products from anon, authenticated;
revoke all on table public.shared_product_revisions from anon, authenticated;

grant select on table public.shared_product_submissions to authenticated;
grant select on table public.shared_products to authenticated;

create or replace function public.publish_shared_product_submission(
	p_submission_id uuid,
	p_food jsonb,
	p_product_name text,
	p_brand_owner text,
	p_source text,
	p_source_reference text,
	p_confidence text,
	p_approved_by uuid default null
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
begin
	if p_source not in ('usda', 'community-reviewed') then
		raise exception 'Unsupported shared product source';
	end if;
	if p_confidence not in ('source-verified', 'moderator-reviewed') then
		raise exception 'Unsupported shared product confidence';
	end if;
	if jsonb_typeof(p_food) <> 'object' then
		raise exception 'Shared product food must be a JSON object';
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

	-- Serialize publication and revision assignment for the same barcode.
	perform pg_advisory_xact_lock(hashtext(v_submission.barcode));

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
		approved_by
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
		p_approved_by
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
		updated_at = now()
	returning id into v_product_id;

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

revoke all on function public.publish_shared_product_submission(uuid, jsonb, text, text, text, text, text, uuid)
	from public, anon, authenticated;
grant execute on function public.publish_shared_product_submission(uuid, jsonb, text, text, text, text, text, uuid)
	to service_role;
