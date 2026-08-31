create schema blendcalc_api;

revoke all on schema blendcalc_api from public, anon, authenticated;
grant usage on schema blendcalc_api to service_role;

create table blendcalc_api.publication_generations (
	id uuid primary key default gen_random_uuid(),
	source_project_ref text not null,
	source_catalog_hash text not null check (source_catalog_hash ~ '^[0-9a-f]{64}$'),
	status text not null default 'building' check (
		status in ('building', 'ready', 'active', 'retired', 'failed')
	),
	expected_product_count integer not null check (expected_product_count >= 0),
	expected_revision_count integer not null check (expected_revision_count >= 0),
	expected_category_count integer not null check (expected_category_count >= 0),
	expected_attribution_count integer not null check (expected_attribution_count >= 0),
	source_snapshot_at timestamptz not null,
	created_at timestamptz not null default now(),
	ready_at timestamptz,
	activated_at timestamptz,
	retired_at timestamptz,
	failed_at timestamptz,
	failure_code text,
	check (
		(status = 'building' and ready_at is null)
		or (status in ('ready', 'active', 'retired') and ready_at is not null)
		or (status = 'failed' and failed_at is not null and failure_code is not null)
	),
	check (status <> 'active' or activated_at is not null),
	check (status <> 'retired' or retired_at is not null)
);

create unique index publication_generations_one_active_idx
	on blendcalc_api.publication_generations ((status))
	where status = 'active';

create table blendcalc_api.publication_products (
	generation_id uuid not null references blendcalc_api.publication_generations(id) on delete cascade,
	source_product_id uuid not null,
	source_revision_id uuid not null,
	gtin14 text not null check (gtin14 ~ '^[0-9]{14}$'),
	product_name text not null check (btrim(product_name) <> ''),
	brand_owner text,
	category_key text,
	search_text text not null check (btrim(search_text) <> ''),
	detail_payload jsonb not null check (jsonb_typeof(detail_payload) = 'object'),
	search_payload jsonb not null check (jsonb_typeof(search_payload) = 'object'),
	content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
	source_updated_at timestamptz not null,
	primary key (generation_id, gtin14),
	unique (generation_id, source_product_id)
);

create index publication_products_search_idx
	on blendcalc_api.publication_products
	using gin (to_tsvector('simple', search_text));

create index publication_products_category_idx
	on blendcalc_api.publication_products (generation_id, category_key, product_name, gtin14);

create table blendcalc_api.publication_product_revisions (
	generation_id uuid not null references blendcalc_api.publication_generations(id) on delete cascade,
	gtin14 text not null,
	source_revision_id uuid not null,
	revision_number integer not null check (revision_number > 0),
	published_at timestamptz not null,
	revision_payload jsonb not null check (jsonb_typeof(revision_payload) = 'object'),
	content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
	primary key (generation_id, gtin14, source_revision_id),
	unique (generation_id, gtin14, revision_number),
	foreign key (generation_id, gtin14)
		references blendcalc_api.publication_products(generation_id, gtin14)
		on delete cascade
);

create table blendcalc_api.publication_categories (
	generation_id uuid not null references blendcalc_api.publication_generations(id) on delete cascade,
	category_key text not null check (btrim(category_key) <> ''),
	display_name text not null check (btrim(display_name) <> ''),
	sort_order integer not null default 0,
	category_payload jsonb not null check (jsonb_typeof(category_payload) = 'object'),
	content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
	primary key (generation_id, category_key)
);

create table blendcalc_api.publication_source_attributions (
	generation_id uuid not null references blendcalc_api.publication_generations(id) on delete cascade,
	source_key text not null check (btrim(source_key) <> ''),
	attribution_payload jsonb not null check (jsonb_typeof(attribution_payload) = 'object'),
	content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
	primary key (generation_id, source_key)
);

create table blendcalc_api.publication_generation_events (
	id bigint generated always as identity primary key,
	generation_id uuid not null references blendcalc_api.publication_generations(id),
	event_type text not null check (event_type in ('ready', 'activated', 'retired', 'failed')),
	replaced_generation_id uuid references blendcalc_api.publication_generations(id),
	event_at timestamptz not null default now()
);

alter table blendcalc_api.publication_generations enable row level security;
alter table blendcalc_api.publication_products enable row level security;
alter table blendcalc_api.publication_product_revisions enable row level security;
alter table blendcalc_api.publication_categories enable row level security;
alter table blendcalc_api.publication_source_attributions enable row level security;
alter table blendcalc_api.publication_generation_events enable row level security;

alter table blendcalc_api.publication_generations force row level security;
alter table blendcalc_api.publication_products force row level security;
alter table blendcalc_api.publication_product_revisions force row level security;
alter table blendcalc_api.publication_categories force row level security;
alter table blendcalc_api.publication_source_attributions force row level security;
alter table blendcalc_api.publication_generation_events force row level security;

revoke all on all tables in schema blendcalc_api from public, anon, authenticated;
revoke all on all sequences in schema blendcalc_api from public, anon, authenticated;

grant select, insert, update, delete on all tables in schema blendcalc_api to service_role;
grant usage, select on all sequences in schema blendcalc_api to service_role;

create function blendcalc_api.mark_publication_generation_ready(p_generation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	generation blendcalc_api.publication_generations%rowtype;
	actual_product_count integer;
	actual_revision_count integer;
	actual_category_count integer;
	actual_attribution_count integer;
begin
	select *
	into generation
	from blendcalc_api.publication_generations
	where id = p_generation_id
	for update;

	if generation.id is null then
		raise exception using errcode = 'P0002', message = 'publication_generation_not_found';
	end if;

	if generation.status <> 'building' then
		raise exception using errcode = 'P0001', message = 'publication_generation_not_building';
	end if;

	select count(*)::integer into actual_product_count
	from blendcalc_api.publication_products
	where generation_id = p_generation_id;

	select count(*)::integer into actual_revision_count
	from blendcalc_api.publication_product_revisions
	where generation_id = p_generation_id;

	select count(*)::integer into actual_category_count
	from blendcalc_api.publication_categories
	where generation_id = p_generation_id;

	select count(*)::integer into actual_attribution_count
	from blendcalc_api.publication_source_attributions
	where generation_id = p_generation_id;

	if actual_product_count <> generation.expected_product_count
		or actual_revision_count <> generation.expected_revision_count
		or actual_category_count <> generation.expected_category_count
		or actual_attribution_count <> generation.expected_attribution_count then
		raise exception using errcode = 'P0001', message = 'publication_generation_count_mismatch';
	end if;

	update blendcalc_api.publication_generations
	set status = 'ready', ready_at = now()
	where id = p_generation_id;

	insert into blendcalc_api.publication_generation_events (generation_id, event_type)
	values (p_generation_id, 'ready');
end;
$$;

create function blendcalc_api.activate_publication_generation(p_generation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	target_generation blendcalc_api.publication_generations%rowtype;
	previous_generation_id uuid;
begin
	select *
	into target_generation
	from blendcalc_api.publication_generations
	where id = p_generation_id
	for update;

	if target_generation.id is null then
		raise exception using errcode = 'P0002', message = 'publication_generation_not_found';
	end if;

	if target_generation.status not in ('ready', 'retired') then
		raise exception using errcode = 'P0001', message = 'publication_generation_not_activatable';
	end if;

	select id
	into previous_generation_id
	from blendcalc_api.publication_generations
	where status = 'active'
	for update;

	if previous_generation_id is not null then
		update blendcalc_api.publication_generations
		set status = 'retired', retired_at = now()
		where id = previous_generation_id;

		insert into blendcalc_api.publication_generation_events (
			generation_id,
			event_type,
			replaced_generation_id
		)
		values (previous_generation_id, 'retired', p_generation_id);
	end if;

	update blendcalc_api.publication_generations
	set status = 'active', activated_at = now(), retired_at = null
	where id = p_generation_id;

	insert into blendcalc_api.publication_generation_events (
		generation_id,
		event_type,
		replaced_generation_id
	)
	values (p_generation_id, 'activated', previous_generation_id);
end;
$$;

create function blendcalc_api.fail_publication_generation(
	p_generation_id uuid,
	p_failure_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if nullif(btrim(p_failure_code), '') is null then
		raise exception using errcode = '22023', message = 'publication_failure_code_required';
	end if;

	update blendcalc_api.publication_generations
	set status = 'failed', failed_at = now(), failure_code = p_failure_code
	where id = p_generation_id
		and status in ('building', 'ready');

	if not found then
		raise exception using errcode = 'P0001', message = 'publication_generation_not_failable';
	end if;

	insert into blendcalc_api.publication_generation_events (generation_id, event_type)
	values (p_generation_id, 'failed');
end;
$$;

create view blendcalc_api.active_publication_products
with (security_invoker = true)
as
select product.*
from blendcalc_api.publication_products product
join blendcalc_api.publication_generations generation
	on generation.id = product.generation_id
where generation.status = 'active';

create view blendcalc_api.active_publication_product_revisions
with (security_invoker = true)
as
select revision.*
from blendcalc_api.publication_product_revisions revision
join blendcalc_api.publication_generations generation
	on generation.id = revision.generation_id
where generation.status = 'active';

create view blendcalc_api.active_publication_categories
with (security_invoker = true)
as
select category.*
from blendcalc_api.publication_categories category
join blendcalc_api.publication_generations generation
	on generation.id = category.generation_id
where generation.status = 'active';

create view blendcalc_api.active_publication_source_attributions
with (security_invoker = true)
as
select attribution.*
from blendcalc_api.publication_source_attributions attribution
join blendcalc_api.publication_generations generation
	on generation.id = attribution.generation_id
where generation.status = 'active';

revoke all on all functions in schema blendcalc_api from public, anon, authenticated;
revoke all on all tables in schema blendcalc_api from public, anon, authenticated;

grant execute on function blendcalc_api.mark_publication_generation_ready(uuid) to service_role;
grant execute on function blendcalc_api.activate_publication_generation(uuid) to service_role;
grant execute on function blendcalc_api.fail_publication_generation(uuid, text) to service_role;
grant select on blendcalc_api.active_publication_products to service_role;
grant select on blendcalc_api.active_publication_product_revisions to service_role;
grant select on blendcalc_api.active_publication_categories to service_role;
grant select on blendcalc_api.active_publication_source_attributions to service_role;

alter default privileges in schema blendcalc_api
	revoke all on tables from public, anon, authenticated;
alter default privileges in schema blendcalc_api
	revoke all on sequences from public, anon, authenticated;
alter default privileges in schema blendcalc_api
	revoke execute on functions from public, anon, authenticated;
