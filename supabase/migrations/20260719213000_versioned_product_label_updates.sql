alter table public.shared_product_submissions
	add column if not exists submission_kind text not null default 'new_product',
	add column if not exists target_shared_product_id uuid references public.shared_products(id),
	add column if not exists base_revision_id uuid references public.shared_product_revisions(id),
	add column if not exists change_summary jsonb not null default '{}'::jsonb,
	add column if not exists label_observed_at timestamptz;

update public.shared_product_submissions
set label_observed_at = created_at
where label_observed_at is null;

alter table public.shared_product_submissions
	alter column label_observed_at set default now(),
	alter column label_observed_at set not null,
	drop constraint if exists shared_product_submissions_submission_kind_check,
	add constraint shared_product_submissions_submission_kind_check
		check (submission_kind in ('new_product', 'product_update')),
	drop constraint if exists shared_product_submissions_change_summary_check,
	add constraint shared_product_submissions_change_summary_check
		check (jsonb_typeof(change_summary) = 'object'),
	drop constraint if exists shared_product_submissions_update_target_check,
	add constraint shared_product_submissions_update_target_check
		check (
			(
				submission_kind = 'new_product'
				and target_shared_product_id is null
				and base_revision_id is null
			)
			or (
				submission_kind = 'product_update'
				and target_shared_product_id is not null
				and base_revision_id is not null
				and jsonb_typeof(change_summary -> 'changes') = 'array'
			)
		);

create unique index if not exists shared_product_submissions_pending_update_unique
	on public.shared_product_submissions (target_shared_product_id)
	where status = 'pending' and submission_kind = 'product_update';

create index if not exists shared_product_submissions_update_history_idx
	on public.shared_product_submissions (target_shared_product_id, label_observed_at desc)
	where submission_kind = 'product_update';

alter table public.shared_product_revisions
	add column if not exists submission_id uuid references public.shared_product_submissions(id),
	add column if not exists supersedes_revision_id uuid references public.shared_product_revisions(id),
	add column if not exists change_summary jsonb not null default '{}'::jsonb,
	add column if not exists label_observed_at timestamptz;

update public.shared_product_revisions
set label_observed_at = created_at
where label_observed_at is null;

alter table public.shared_product_revisions
	alter column label_observed_at set default now(),
	alter column label_observed_at set not null,
	drop constraint if exists shared_product_revisions_change_summary_check,
	add constraint shared_product_revisions_change_summary_check
		check (jsonb_typeof(change_summary) = 'object');

with ordered_revisions as (
	select
		id,
		lag(id) over (
			partition by shared_product_id
			order by revision_number
		) as previous_revision_id
	from public.shared_product_revisions
)
update public.shared_product_revisions revision
set supersedes_revision_id = ordered.previous_revision_id
from ordered_revisions ordered
where revision.id = ordered.id
	and revision.supersedes_revision_id is null
	and ordered.previous_revision_id is not null;

with latest_revisions as (
	select distinct on (shared_product_id)
		id,
		shared_product_id
	from public.shared_product_revisions
	order by shared_product_id, revision_number desc
)
update public.shared_product_revisions revision
set submission_id = product.approved_submission_id
from latest_revisions latest
join public.shared_products product on product.id = latest.shared_product_id
where revision.id = latest.id
	and revision.submission_id is null
	and product.approved_submission_id is not null;

create index if not exists shared_product_revisions_submission_idx
	on public.shared_product_revisions (submission_id)
	where submission_id is not null;

create table public.shared_product_revision_changes (
	id uuid primary key default gen_random_uuid(),
	revision_id uuid not null references public.shared_product_revisions(id) on delete cascade,
	field_path text not null check (btrim(field_path) <> ''),
	field_label text not null check (btrim(field_label) <> ''),
	change_type text not null check (change_type in ('added', 'removed', 'changed')),
	previous_value jsonb,
	new_value jsonb,
	severity text not null check (severity in ('low', 'medium', 'high')),
	created_at timestamptz not null default now(),
	unique (revision_id, field_path)
);

create index shared_product_revision_changes_field_idx
	on public.shared_product_revision_changes (field_path, created_at desc);

alter table public.shared_product_revision_changes enable row level security;
alter table public.shared_product_revision_changes force row level security;
revoke all on table public.shared_product_revision_changes from public, anon, authenticated;

create or replace function public.validate_shared_product_update_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_target_barcode text;
	v_base_product_id uuid;
begin
	if new.submission_kind = 'new_product' then
		if new.target_shared_product_id is not null or new.base_revision_id is not null then
			raise exception 'New product submissions cannot target an existing revision';
		end if;
		return new;
	end if;

	select barcode
	into v_target_barcode
	from public.shared_products
	where id = new.target_shared_product_id;

	if v_target_barcode is null or v_target_barcode <> new.barcode then
		raise exception 'Catalog update target does not match the submitted barcode';
	end if;

	select shared_product_id
	into v_base_product_id
	from public.shared_product_revisions
	where id = new.base_revision_id;

	if v_base_product_id is null or v_base_product_id <> new.target_shared_product_id then
		raise exception 'Catalog update base revision does not belong to the target product';
	end if;

	return new;
end;
$$;

create trigger validate_shared_product_update_submission
	before insert or update of barcode, submission_kind, target_shared_product_id, base_revision_id
	on public.shared_product_submissions
	for each row execute function public.validate_shared_product_update_submission();

create or replace function public.assert_shared_product_update_is_current()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_submission public.shared_product_submissions%rowtype;
	v_latest_revision_id uuid;
begin
	if new.approved_submission_id is null
		or new.approved_submission_id is not distinct from old.approved_submission_id then
		return new;
	end if;

	select *
	into v_submission
	from public.shared_product_submissions
	where id = new.approved_submission_id;

	if v_submission.submission_kind <> 'product_update' then
		return new;
	end if;

	if v_submission.target_shared_product_id <> old.id then
		raise exception 'Catalog update targets a different product';
	end if;

	select id
	into v_latest_revision_id
	from public.shared_product_revisions
	where shared_product_id = old.id
	order by revision_number desc
	limit 1;

	if v_latest_revision_id is distinct from v_submission.base_revision_id then
		raise exception 'Catalog update is stale because this product changed after submission';
	end if;

	return new;
end;
$$;

create trigger assert_shared_product_update_is_current
	before update of approved_submission_id
	on public.shared_products
	for each row execute function public.assert_shared_product_update_is_current();

create or replace function public.set_shared_product_revision_update_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_submission public.shared_product_submissions%rowtype;
begin
	select submission.*
	into v_submission
	from public.shared_products product
	join public.shared_product_submissions submission
		on submission.id = product.approved_submission_id
	where product.id = new.shared_product_id
		and submission.status = 'pending';

	if not found then
		return new;
	end if;

	new.submission_id := v_submission.id;
	new.label_observed_at := v_submission.label_observed_at;
	if v_submission.submission_kind = 'product_update' then
		new.supersedes_revision_id := v_submission.base_revision_id;
		new.change_summary := v_submission.change_summary;
	end if;

	return new;
end;
$$;

create trigger set_shared_product_revision_update_metadata
	before insert on public.shared_product_revisions
	for each row execute function public.set_shared_product_revision_update_metadata();

create or replace function public.record_shared_product_revision_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_change jsonb;
begin
	for v_change in
		select value
		from jsonb_array_elements(coalesce(new.change_summary -> 'changes', '[]'::jsonb))
	loop
		insert into public.shared_product_revision_changes (
			revision_id,
			field_path,
			field_label,
			change_type,
			previous_value,
			new_value,
			severity
		)
		values (
			new.id,
			v_change ->> 'field',
			v_change ->> 'label',
			v_change ->> 'changeType',
			v_change -> 'previousValue',
			v_change -> 'submittedValue',
			v_change ->> 'severity'
		);
	end loop;

	return new;
end;
$$;

create trigger record_shared_product_revision_changes
	after insert on public.shared_product_revisions
	for each row execute function public.record_shared_product_revision_changes();

revoke all on function public.validate_shared_product_update_submission()
	from public, anon, authenticated;
revoke all on function public.assert_shared_product_update_is_current()
	from public, anon, authenticated;
revoke all on function public.set_shared_product_revision_update_metadata()
	from public, anon, authenticated;
revoke all on function public.record_shared_product_revision_changes()
	from public, anon, authenticated;
