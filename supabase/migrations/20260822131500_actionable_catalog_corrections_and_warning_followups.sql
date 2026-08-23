alter table public.food_compatibility_feedback
	add column follow_up_status text not null default 'not_required';

alter table public.food_compatibility_feedback
	add constraint food_compatibility_feedback_follow_up_status_check
		check (follow_up_status in ('not_required', 'open', 'completed'));

create table public.food_warning_policy_review_cases (
	id uuid primary key default gen_random_uuid(),
	feedback_id uuid not null unique
		references public.food_compatibility_feedback(id) on delete cascade,
	case_type text not null check (case_type in ('rule_review', 'source_correction')),
	responsible_group text not null
		check (responsible_group in ('food_policy_review', 'data_operations')),
	shared_product_id uuid references public.shared_products(id) on delete set null,
	source_key text,
	status text not null default 'open'
		check (status in ('open', 'resolved', 'dismissed', 'deferred')),
	opened_by uuid references auth.users(id) on delete set null,
	resolved_by uuid references auth.users(id) on delete set null,
	resolution_note text check (
		resolution_note is null or char_length(resolution_note) <= 2000
	),
	created_at timestamptz not null default now(),
	resolved_at timestamptz,
	updated_at timestamptz not null default now(),
	check (
		(status in ('open', 'deferred') and resolved_at is null)
		or (status in ('resolved', 'dismissed') and resolved_at is not null)
	)
);

create trigger set_food_warning_policy_review_cases_updated_at
	before update on public.food_warning_policy_review_cases
	for each row execute function public.set_updated_at();

create index food_warning_policy_review_cases_work_idx
	on public.food_warning_policy_review_cases (responsible_group, status, created_at)
	where status in ('open', 'deferred');

create table public.catalog_correction_origins (
	id uuid primary key default gen_random_uuid(),
	shared_product_id uuid not null
		references public.shared_products(id) on delete cascade,
	base_revision_id uuid not null
		references public.shared_product_revisions(id) on delete restrict,
	origin_type text not null
		check (origin_type in ('provider_change', 'catalog_conflict', 'food_warning_report')),
	provider_change_review_id uuid
		references public.catalog_provider_change_reviews(id) on delete cascade,
	shared_product_conflict_id uuid
		references public.shared_product_conflicts(id) on delete cascade,
	food_compatibility_feedback_id uuid
		references public.food_compatibility_feedback(id) on delete cascade,
	affected_field_paths text[] not null
		check (cardinality(affected_field_paths) > 0),
	prefilled_food jsonb not null
		check (jsonb_typeof(prefilled_food) = 'object'),
	submission_id uuid
		references public.shared_product_submissions(id) on delete set null,
	status text not null default 'waiting_for_correction'
		check (status in ('waiting_for_correction', 'linked', 'resolved', 'dismissed')),
	resolved_revision_id uuid
		references public.shared_product_revisions(id) on delete restrict,
	resolution_note text check (
		resolution_note is null or char_length(resolution_note) <= 2000
	),
	created_at timestamptz not null default now(),
	resolved_at timestamptz,
	updated_at timestamptz not null default now(),
	check (
		num_nonnulls(
			provider_change_review_id,
			shared_product_conflict_id,
			food_compatibility_feedback_id
		) = 1
	),
	check (
		(origin_type = 'provider_change' and provider_change_review_id is not null)
		or (origin_type = 'catalog_conflict' and shared_product_conflict_id is not null)
		or (origin_type = 'food_warning_report' and food_compatibility_feedback_id is not null)
	),
	check (
		(status = 'waiting_for_correction'
			and submission_id is null
			and resolved_revision_id is null
			and resolved_at is null)
		or (status = 'linked'
			and submission_id is not null
			and resolved_revision_id is null
			and resolved_at is null)
		or (status = 'resolved'
			and submission_id is not null
			and resolved_revision_id is not null
			and resolved_at is not null)
		or (status = 'dismissed'
			and resolved_revision_id is null
			and resolved_at is not null)
	)
);

create trigger set_catalog_correction_origins_updated_at
	before update on public.catalog_correction_origins
	for each row execute function public.set_updated_at();

create unique index catalog_correction_origins_provider_change_unique
	on public.catalog_correction_origins (provider_change_review_id)
	where provider_change_review_id is not null;

create unique index catalog_correction_origins_conflict_unique
	on public.catalog_correction_origins (shared_product_conflict_id)
	where shared_product_conflict_id is not null;

create unique index catalog_correction_origins_warning_report_unique
	on public.catalog_correction_origins (food_compatibility_feedback_id)
	where food_compatibility_feedback_id is not null;

create index catalog_correction_origins_work_idx
	on public.catalog_correction_origins (shared_product_id, status, created_at)
	where status in ('waiting_for_correction', 'linked');

create or replace function public.validate_catalog_correction_origin()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_origin_product_id uuid;
	v_origin_revision_id uuid;
begin
	if new.provider_change_review_id is not null then
		select review.shared_product_id
		into v_origin_product_id
		from public.catalog_provider_change_reviews review
		where review.id = new.provider_change_review_id;
	elsif new.shared_product_conflict_id is not null then
		select conflict.shared_product_id
		into v_origin_product_id
		from public.shared_product_conflicts conflict
		where conflict.id = new.shared_product_conflict_id;
	else
		select feedback.shared_product_id, feedback.shared_product_revision_id
		into v_origin_product_id, v_origin_revision_id
		from public.food_compatibility_feedback feedback
		where feedback.id = new.food_compatibility_feedback_id;
	end if;

	if v_origin_product_id is null or v_origin_product_id <> new.shared_product_id then
		raise exception 'Catalog correction origin does not belong to the target product';
	end if;
	if v_origin_revision_id is not null
		and v_origin_revision_id <> new.base_revision_id then
		raise exception 'Catalog correction origin does not match its reported revision';
	end if;

	if new.submission_id is not null and not exists (
		select 1
		from public.shared_product_submissions submission
		where submission.id = new.submission_id
			and submission.submission_kind = 'product_update'
			and submission.submission_intent = 'catalog_correction'
			and submission.target_shared_product_id = new.shared_product_id
			and submission.base_revision_id = new.base_revision_id
	) then
		raise exception 'Catalog correction origin must link to a matching correction submission';
	end if;

	return new;
end;
$$;

create trigger validate_catalog_correction_origin
	before insert or update of
		shared_product_id,
		base_revision_id,
		provider_change_review_id,
		shared_product_conflict_id,
		food_compatibility_feedback_id,
		submission_id
	on public.catalog_correction_origins
	for each row execute function public.validate_catalog_correction_origin();

create or replace function public.attach_catalog_correction_origins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_changed_fields text[];
	v_product_food jsonb;
begin
	if new.status <> 'pending'
		or new.submission_kind <> 'product_update'
		or new.submission_intent <> 'catalog_correction' then
		return new;
	end if;

	select array_agg(distinct change ->> 'field')
	into v_changed_fields
	from jsonb_array_elements(new.change_summary -> 'changes') change;

	if coalesce(cardinality(v_changed_fields), 0) = 0 then
		return new;
	end if;

	select product.food
	into v_product_food
	from public.shared_products product
	where product.id = new.target_shared_product_id;

	insert into public.catalog_correction_origins (
		shared_product_id,
		base_revision_id,
		origin_type,
		provider_change_review_id,
		affected_field_paths,
		prefilled_food,
		submission_id,
		status
	)
	select
		review.shared_product_id,
		new.base_revision_id,
		'provider_change',
		review.id,
		review.material_field_paths,
		v_product_food,
		new.id,
		'linked'
	from public.catalog_provider_change_reviews review
	where review.shared_product_id = new.target_shared_product_id
		and review.status = 'pending'
		and review.material_field_paths && v_changed_fields
	on conflict (provider_change_review_id)
		where provider_change_review_id is not null
	do nothing;

	insert into public.catalog_correction_origins (
		shared_product_id,
		base_revision_id,
		origin_type,
		shared_product_conflict_id,
		affected_field_paths,
		prefilled_food,
		submission_id,
		status
	)
	select
		conflict.shared_product_id,
		new.base_revision_id,
		'catalog_conflict',
		conflict.id,
		array[conflict.field_path],
		v_product_food,
		new.id,
		'linked'
	from public.shared_product_conflicts conflict
	where conflict.shared_product_id = new.target_shared_product_id
		and conflict.status = 'open'
		and conflict.field_path = any(v_changed_fields)
	on conflict (shared_product_conflict_id)
		where shared_product_conflict_id is not null
	do nothing;

	update public.catalog_correction_origins origin
	set submission_id = new.id,
		status = 'linked'
	where origin.shared_product_id = new.target_shared_product_id
		and origin.base_revision_id = new.base_revision_id
		and origin.status = 'waiting_for_correction'
		and origin.affected_field_paths && v_changed_fields;

	return new;
end;
$$;

create trigger attach_catalog_correction_origins
	after insert on public.shared_product_submissions
	for each row execute function public.attach_catalog_correction_origins();

create or replace function public.resolve_catalog_correction_origins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_revision_id uuid;
begin
	if old.status = new.status then
		return new;
	end if;

	if new.status = 'approved' then
		select revision.id
		into v_revision_id
		from public.shared_product_revisions revision
		where revision.submission_id = new.id
		order by revision.revision_number desc
		limit 1;

		if v_revision_id is null and exists (
			select 1
			from public.catalog_correction_origins origin
			where origin.submission_id = new.id
				and origin.status = 'linked'
		) then
			raise exception 'Approved catalog correction is missing its immutable revision';
		end if;

		update public.catalog_provider_change_reviews review
		set status = 'accepted',
			reviewed_by = new.reviewed_by,
			reviewed_at = coalesce(new.reviewed_at, now()),
			review_note = coalesce(new.review_note, 'Resolved by the approved catalog correction.'),
			accepted_revision_id = v_revision_id
		from public.catalog_correction_origins origin
		where origin.submission_id = new.id
			and origin.status = 'linked'
			and origin.provider_change_review_id = review.id
			and review.status = 'pending';

		update public.shared_product_conflicts conflict
		set status = 'superseded'
		from public.catalog_correction_origins origin
		where origin.submission_id = new.id
			and origin.status = 'linked'
			and origin.shared_product_conflict_id = conflict.id
			and conflict.status = 'open';

		update public.food_compatibility_feedback feedback
		set follow_up_status = 'completed'
		from public.catalog_correction_origins origin
		where origin.submission_id = new.id
			and origin.status = 'linked'
			and origin.food_compatibility_feedback_id = feedback.id;

		update public.catalog_correction_origins
		set status = 'resolved',
			resolved_revision_id = v_revision_id,
			resolved_at = now(),
			resolution_note = coalesce(new.review_note, 'Resolved by the approved catalog correction.')
		where submission_id = new.id
			and status = 'linked';
	elsif new.status in ('rejected', 'auto_declined') then
		update public.catalog_correction_origins
		set status = 'waiting_for_correction',
			submission_id = null
		where submission_id = new.id
			and status = 'linked';
	end if;

	return new;
end;
$$;

create trigger resolve_catalog_correction_origins
	after update of status on public.shared_product_submissions
	for each row execute function public.resolve_catalog_correction_origins();

create or replace function public.review_food_compatibility_feedback(
	p_feedback_id uuid,
	p_status text,
	p_resolution_action text,
	p_review_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_feedback public.food_compatibility_feedback%rowtype;
	v_case_id uuid;
	v_follow_up_status text := 'not_required';
	v_revision_id uuid;
	v_product_food jsonb;
	v_affected_fields text[];
begin
	if not public.authorize_app_permission('moderation.warnings.review') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified food-warning review access is required.';
	end if;
	if p_status not in ('confirmed', 'dismissed') then
		raise exception 'Food-warning review outcome is invalid';
	end if;
	if p_resolution_action not in (
		'none',
		'rule_review',
		'source_correction',
		'product_correction',
		'duplicate'
	) then
		raise exception 'Food-warning follow-up action is invalid';
	end if;
	if btrim(coalesce(p_review_note, '')) = '' then
		raise exception 'A review note is required';
	end if;
	if p_status = 'dismissed' and p_resolution_action not in ('none', 'duplicate') then
		raise exception 'Dismissed reports cannot create correction work';
	end if;

	select *
	into v_feedback
	from public.food_compatibility_feedback feedback
	where feedback.id = p_feedback_id
		and feedback.status = 'pending'
	for update;
	if not found then
		return jsonb_build_object('reviewed', false);
	end if;

	if p_status = 'confirmed'
		and p_resolution_action in ('rule_review', 'source_correction', 'product_correction') then
		v_follow_up_status := 'open';
	end if;

	update public.food_compatibility_feedback
	set status = p_status,
		resolution_action = p_resolution_action,
		follow_up_status = v_follow_up_status,
		reviewed_by = (select auth.uid()),
		reviewed_at = now(),
		review_note = left(btrim(p_review_note), 2000)
	where id = p_feedback_id;

	if v_follow_up_status = 'open'
		and p_resolution_action in ('rule_review', 'source_correction') then
		insert into public.food_warning_policy_review_cases (
			feedback_id,
			case_type,
			responsible_group,
			shared_product_id,
			source_key,
			opened_by
		)
		values (
			p_feedback_id,
			p_resolution_action,
			case when p_resolution_action = 'rule_review'
				then 'food_policy_review'
				else 'data_operations'
			end,
			v_feedback.shared_product_id,
			v_feedback.source_key,
			(select auth.uid())
		)
		returning id into v_case_id;
	elsif v_follow_up_status = 'open'
		and p_resolution_action = 'product_correction' then
		if v_feedback.shared_product_id is null then
			raise exception 'Product corrections require a shared catalog product';
		end if;

		select revision.id, product.food
		into v_revision_id, v_product_food
		from public.shared_products product
		join lateral (
			select candidate.id
			from public.shared_product_revisions candidate
			where candidate.shared_product_id = product.id
			order by candidate.revision_number desc
			limit 1
		) revision on true
		where product.id = v_feedback.shared_product_id;

		if v_revision_id is null then
			raise exception 'Product correction cannot start without a current revision';
		end if;

		v_affected_fields := case
			when v_feedback.feedback_type = 'missing_warning'
				then array['ingredients', 'allergens', 'traces', 'precautionaryStatements']
			else array['ingredients', 'allergens', 'traces', 'precautionaryStatements', 'dietaryTags']
		end;

		insert into public.catalog_correction_origins (
			shared_product_id,
			base_revision_id,
			origin_type,
			food_compatibility_feedback_id,
			affected_field_paths,
			prefilled_food
		)
		values (
			v_feedback.shared_product_id,
			v_revision_id,
			'food_warning_report',
			p_feedback_id,
			v_affected_fields,
			v_product_food
		)
		returning id into v_case_id;
	end if;

	return jsonb_build_object(
		'reviewed', true,
		'followUpStatus', v_follow_up_status,
		'followUpType', case
			when v_follow_up_status = 'open' then p_resolution_action
			else null
		end,
		'followUpId', v_case_id
	);
end;
$$;

alter table public.food_warning_policy_review_cases enable row level security;
alter table public.food_warning_policy_review_cases force row level security;
alter table public.catalog_correction_origins enable row level security;
alter table public.catalog_correction_origins force row level security;

revoke all on table public.food_warning_policy_review_cases
	from public, anon, authenticated;
revoke all on table public.catalog_correction_origins
	from public, anon, authenticated;
grant select, insert, update on table public.food_warning_policy_review_cases
	to service_role;
grant select, insert, update on table public.catalog_correction_origins
	to service_role;

revoke all on function public.review_food_compatibility_feedback(uuid, text, text, text)
	from public, anon, authenticated, service_role;
grant execute on function public.review_food_compatibility_feedback(uuid, text, text, text)
	to authenticated;

comment on table public.catalog_correction_origins is
	'Links evidence-backed provider changes, product conflicts, and food-warning reports to the catalog correction and immutable revision that resolved them. Unlinked rows preserve a safe prefilled starting point without publishing unchanged or invented data.';

comment on table public.food_warning_policy_review_cases is
	'Tracks confirmed warning-rule and source-mapping follow-up work separately from the originating user report.';

comment on function public.review_food_compatibility_feedback(uuid, text, text, text) is
	'Atomically records an AAL2 food-warning decision and creates its required correction or policy follow-up without flattening the originating report.';
