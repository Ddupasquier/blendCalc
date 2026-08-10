alter table public.food_compatibility_policy_versions
	add column preference_mapping_snapshot jsonb not null default '[]'::jsonb
		check (jsonb_typeof(preference_mapping_snapshot) = 'array');

create table public.food_compatibility_policy_preference_term_mappings (
	id uuid primary key default gen_random_uuid(),
	policy_version_id uuid not null
		references public.food_compatibility_policy_versions(id) on delete restrict,
	ingredient_term_id uuid not null
		references public.ingredient_terms(id) on delete restrict,
	preference_tag_id uuid not null
		references public.compatibility_tags(id) on delete restrict,
	preference_rule_type text not null
		check (preference_rule_type in ('allergen', 'dietary_restriction')),
	source_reference text not null check (btrim(source_reference) <> ''),
	reviewed_by uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (
		policy_version_id,
		ingredient_term_id,
		preference_tag_id,
		preference_rule_type
	)
);

create index food_compatibility_preference_term_mapping_lookup_idx
	on public.food_compatibility_policy_preference_term_mappings (
		policy_version_id,
		preference_rule_type,
		ingredient_term_id
	);

create trigger set_food_compatibility_preference_term_mappings_updated_at
	before update on public.food_compatibility_policy_preference_term_mappings
	for each row execute function public.set_updated_at();

create table public.food_preference_mapping_requests (
	id uuid primary key default gen_random_uuid(),
	preference_rule_type text not null
		check (preference_rule_type in ('allergen', 'dietary_restriction')),
	normalized_value text not null check (btrim(normalized_value) <> ''),
	language_code text not null default 'und'
		check (language_code ~ '^[a-z]{2,3}(?:-[A-Z]{2})?$' or language_code = 'und'),
	status text not null default 'pending'
		check (status in ('pending', 'resolved', 'rejected')),
	occurrence_count integer not null default 1 check (occurrence_count > 0),
	resolved_mapping_id uuid
		references public.food_compatibility_policy_preference_term_mappings(id)
		on delete set null,
	resolved_ingredient_term_id uuid
		references public.ingredient_terms(id) on delete set null,
	resolved_preference_tag_id uuid
		references public.compatibility_tags(id) on delete set null,
	reviewed_by uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz,
	review_note text,
	first_seen_at timestamptz not null default now(),
	last_seen_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint food_preference_mapping_requests_resolution_check check (
		(
			status = 'resolved'
			and resolved_mapping_id is not null
			and resolved_ingredient_term_id is not null
			and resolved_preference_tag_id is not null
			and reviewed_at is not null
		)
		or (
			status <> 'resolved'
			and resolved_mapping_id is null
			and resolved_ingredient_term_id is null
			and resolved_preference_tag_id is null
		)
	),
	unique (preference_rule_type, normalized_value, language_code)
);

create index food_preference_mapping_requests_review_queue_idx
	on public.food_preference_mapping_requests (status, last_seen_at desc);

create trigger set_food_preference_mapping_requests_updated_at
	before update on public.food_preference_mapping_requests
	for each row execute function public.set_updated_at();

alter table public.user_compatibility_rules
	add column resolution_status text not null default 'unresolved'
		constraint user_compatibility_rules_resolution_status_value_check
		check (resolution_status in ('resolved', 'unresolved')),
	add column resolution_method text not null default 'unresolved'
		constraint user_compatibility_rules_resolution_method_value_check
		check (
			resolution_method in (
				'direct_tag',
				'canonical_ingredient',
				'ingredient_alias',
				'unresolved'
			)
		),
	add column resolution_policy_version_id uuid
		references public.food_compatibility_policy_versions(id) on delete restrict,
	add column resolution_language_code text not null default 'und'
		check (
			resolution_language_code ~ '^[a-z]{2,3}(?:-[A-Z]{2})?$'
			or resolution_language_code = 'und'
		),
	add column ingredient_term_id uuid
		references public.ingredient_terms(id) on delete restrict,
	add column ingredient_alias_id uuid
		references public.food_compatibility_policy_ingredient_aliases(id)
		on delete restrict,
	add column preference_term_mapping_id uuid
		references public.food_compatibility_policy_preference_term_mappings(id)
		on delete restrict;

update public.user_compatibility_rules
set
	resolution_status = case when tag_id is null then 'unresolved' else 'resolved' end,
	resolution_method = case when tag_id is null then 'unresolved' else 'direct_tag' end,
	resolution_policy_version_id =
		public.active_food_compatibility_policy_version_id();

alter table public.user_compatibility_rules
	alter column resolution_policy_version_id set not null,
	add constraint user_compatibility_rules_resolution_check check (
		(
			resolution_status = 'resolved'
			and tag_id is not null
			and resolution_method <> 'unresolved'
		)
		or (
			resolution_status = 'unresolved'
			and tag_id is null
			and resolution_method = 'unresolved'
			and ingredient_term_id is null
			and ingredient_alias_id is null
			and preference_term_mapping_id is null
		)
	),
	add constraint user_compatibility_rules_resolution_method_check check (
		(
			resolution_method = 'direct_tag'
			and ingredient_term_id is null
			and ingredient_alias_id is null
			and preference_term_mapping_id is null
		)
		or (
			resolution_method = 'canonical_ingredient'
			and ingredient_term_id is not null
			and ingredient_alias_id is null
			and preference_term_mapping_id is not null
		)
		or (
			resolution_method = 'ingredient_alias'
			and ingredient_term_id is not null
			and ingredient_alias_id is not null
			and preference_term_mapping_id is not null
		)
		or resolution_method = 'unresolved'
	);

create index user_compatibility_rules_resolution_idx
	on public.user_compatibility_rules (
		user_id,
		resolution_status,
		rule_type,
		active
	);

create or replace function public.validate_food_compatibility_preference_term_mapping()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_policy_status text;
	v_term_status text;
	v_tag_category text;
begin
	select status into v_policy_status
	from public.food_compatibility_policy_versions
	where id = new.policy_version_id;

	select review_status into v_term_status
	from public.ingredient_terms
	where id = new.ingredient_term_id;

	select category into v_tag_category
	from public.compatibility_tags
	where id = new.preference_tag_id;

	if v_policy_status is distinct from 'draft' then
		raise exception 'Preference mappings can only be added to draft policies.';
	end if;
	if v_term_status is distinct from 'reviewed' then
		raise exception 'Preference mappings require a reviewed canonical ingredient.';
	end if;
	if (
		new.preference_rule_type = 'allergen'
		and v_tag_category is distinct from 'allergen'
	) or (
		new.preference_rule_type = 'dietary_restriction'
		and v_tag_category is distinct from 'dietary'
	) then
		raise exception 'Preference mapping type and compatibility tag category must match.';
	end if;

	return new;
end;
$$;

create trigger validate_food_compatibility_preference_term_mapping
	before insert or update
	on public.food_compatibility_policy_preference_term_mappings
	for each row execute function
		public.validate_food_compatibility_preference_term_mapping();

create trigger enforce_food_compatibility_preference_term_mapping_immutability
	before insert or update or delete
	on public.food_compatibility_policy_preference_term_mappings
	for each row execute function
		public.enforce_food_compatibility_policy_child_immutability();

create or replace function public.clone_food_compatibility_preference_term_mappings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_active_policy_id uuid;
	v_prior_bundle_write text;
begin
	if new.status <> 'draft' then return new; end if;

	select id into v_active_policy_id
	from public.food_compatibility_policy_versions
	where status = 'active'
	order by version_number desc
	limit 1;

	if v_active_policy_id is null then return new; end if;

	v_prior_bundle_write := current_setting('blendcalc.policy_bundle_write', true);
	perform set_config('blendcalc.policy_bundle_write', 'on', true);

	insert into public.food_compatibility_policy_preference_term_mappings (
		policy_version_id,
		ingredient_term_id,
		preference_tag_id,
		preference_rule_type,
		source_reference,
		reviewed_by,
		reviewed_at
	)
	select
		new.id,
		mapping.ingredient_term_id,
		mapping.preference_tag_id,
		mapping.preference_rule_type,
		mapping.source_reference,
		mapping.reviewed_by,
		mapping.reviewed_at
	from public.food_compatibility_policy_preference_term_mappings mapping
	where mapping.policy_version_id = v_active_policy_id;

	perform set_config(
		'blendcalc.policy_bundle_write',
		coalesce(v_prior_bundle_write, ''),
		true
	);
	return new;
end;
$$;

create trigger clone_food_compatibility_preference_term_mappings
	after insert on public.food_compatibility_policy_versions
	for each row when (new.status = 'draft')
	execute function public.clone_food_compatibility_preference_term_mappings();

create or replace function public.sync_user_compatibility_rules(
	p_user_id uuid,
	p_allergens text[] default '{}'::text[],
	p_dietary_restrictions text[] default '{}'::text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_active_policy_id uuid;
	v_rule record;
	v_direct_tag_id uuid;
	v_candidate_count integer;
	v_mapping_id uuid;
	v_mapped_tag_id uuid;
	v_ingredient_term_id uuid;
	v_ingredient_alias_id uuid;
	v_resolution_method text;
	v_resolution_language_code text;
begin
	select public.active_food_compatibility_policy_version_id()
	into v_active_policy_id;

	if v_active_policy_id is null then
		raise exception 'An active food compatibility policy is required.';
	end if;

	delete from public.user_compatibility_rules
	where user_id = p_user_id;

	for v_rule in
		select
			values_with_rules.rule_type,
			values_with_rules.raw_value,
			values_with_rules.normalized_value
		from (
			select
				'allergen'::text as rule_type,
				raw_value,
				public.compatibility_normalize_text(raw_value) as normalized_value
			from unnest(coalesce(p_allergens, '{}'::text[])) as raw_value
			union all
			select
				'dietary_restriction'::text,
				raw_value,
				public.compatibility_normalize_text(raw_value)
			from unnest(coalesce(p_dietary_restrictions, '{}'::text[])) as raw_value
		) values_with_rules
		where values_with_rules.normalized_value <> ''
	loop
		v_direct_tag_id := null;
		v_mapping_id := null;
		v_mapped_tag_id := null;
		v_ingredient_term_id := null;
		v_ingredient_alias_id := null;
		v_resolution_method := 'unresolved';
		v_resolution_language_code := 'und';

		select case when count(*) = 1 then min(tag.id::text)::uuid else null end
		into v_direct_tag_id
		from public.compatibility_tags tag
		where tag.category = case
			when v_rule.rule_type = 'allergen' then 'allergen'
			else 'dietary'
		end
			and (
				public.compatibility_normalize_text(tag.slug) =
					v_rule.normalized_value
				or public.compatibility_normalize_text(tag.label) =
					v_rule.normalized_value
			);

		if v_direct_tag_id is not null then
			insert into public.user_compatibility_rules (
				user_id,
				tag_id,
				rule_type,
				severity,
				raw_value,
				normalized_value,
				resolution_status,
				resolution_method,
				resolution_policy_version_id,
				resolution_language_code
			)
			values (
				p_user_id,
				v_direct_tag_id,
				v_rule.rule_type,
				'warn',
				v_rule.raw_value,
				v_rule.normalized_value,
				'resolved',
				'direct_tag',
				v_active_policy_id,
				'und'
			);
			continue;
		end if;

		with candidates as (
			select
				mapping.id as mapping_id,
				mapping.preference_tag_id,
				term.id as ingredient_term_id,
				null::uuid as ingredient_alias_id,
				'canonical_ingredient'::text as resolution_method,
				coalesce(term.default_language_code, 'und') as language_code
			from public.ingredient_terms term
			join public.food_compatibility_policy_preference_term_mappings mapping
				on mapping.ingredient_term_id = term.id
				and mapping.policy_version_id = v_active_policy_id
				and mapping.preference_rule_type = v_rule.rule_type
			where term.review_status = 'reviewed'
				and (
					public.compatibility_normalize_text(term.display_name) =
						v_rule.normalized_value
					or public.compatibility_normalize_text(term.canonical_key) =
						v_rule.normalized_value
				)
			union all
			select
				mapping.id,
				mapping.preference_tag_id,
				term.id,
				alias.id,
				'ingredient_alias'::text,
				coalesce(alias.language_code, term.default_language_code, 'und')
			from public.food_compatibility_policy_ingredient_aliases alias
			join public.ingredient_terms term
				on term.id = alias.ingredient_term_id
			join public.food_compatibility_policy_preference_term_mappings mapping
				on mapping.ingredient_term_id = term.id
				and mapping.policy_version_id = v_active_policy_id
				and mapping.preference_rule_type = v_rule.rule_type
			where alias.policy_version_id = v_active_policy_id
				and alias.review_status = 'reviewed'
				and term.review_status = 'reviewed'
				and alias.normalized_alias = v_rule.normalized_value
		), unique_mappings as (
			select distinct mapping_id
			from candidates
		)
		select count(*) into v_candidate_count
		from unique_mappings;

		if v_candidate_count = 1 then
			with candidates as (
				select
					mapping.id as mapping_id,
					mapping.preference_tag_id,
					term.id as ingredient_term_id,
					null::uuid as ingredient_alias_id,
					'canonical_ingredient'::text as resolution_method,
					coalesce(term.default_language_code, 'und') as language_code,
					1 as method_priority
				from public.ingredient_terms term
				join public.food_compatibility_policy_preference_term_mappings mapping
					on mapping.ingredient_term_id = term.id
					and mapping.policy_version_id = v_active_policy_id
					and mapping.preference_rule_type = v_rule.rule_type
				where term.review_status = 'reviewed'
					and (
						public.compatibility_normalize_text(term.display_name) =
							v_rule.normalized_value
						or public.compatibility_normalize_text(term.canonical_key) =
							v_rule.normalized_value
					)
				union all
				select
					mapping.id,
					mapping.preference_tag_id,
					term.id,
					alias.id,
					'ingredient_alias'::text,
					coalesce(alias.language_code, term.default_language_code, 'und'),
					2
				from public.food_compatibility_policy_ingredient_aliases alias
				join public.ingredient_terms term
					on term.id = alias.ingredient_term_id
				join public.food_compatibility_policy_preference_term_mappings mapping
					on mapping.ingredient_term_id = term.id
					and mapping.policy_version_id = v_active_policy_id
					and mapping.preference_rule_type = v_rule.rule_type
				where alias.policy_version_id = v_active_policy_id
					and alias.review_status = 'reviewed'
					and term.review_status = 'reviewed'
					and alias.normalized_alias = v_rule.normalized_value
			)
			select
				mapping_id,
				preference_tag_id,
				ingredient_term_id,
				ingredient_alias_id,
				resolution_method,
				language_code
			into
				v_mapping_id,
				v_mapped_tag_id,
				v_ingredient_term_id,
				v_ingredient_alias_id,
				v_resolution_method,
				v_resolution_language_code
			from candidates
			order by method_priority
			limit 1;
		end if;

		if v_mapping_id is not null then
			insert into public.user_compatibility_rules (
				user_id,
				tag_id,
				rule_type,
				severity,
				raw_value,
				normalized_value,
				resolution_status,
				resolution_method,
				resolution_policy_version_id,
				resolution_language_code,
				ingredient_term_id,
				ingredient_alias_id,
				preference_term_mapping_id
			)
			values (
				p_user_id,
				v_mapped_tag_id,
				v_rule.rule_type,
				'warn',
				v_rule.raw_value,
				v_rule.normalized_value,
				'resolved',
				v_resolution_method,
				v_active_policy_id,
				v_resolution_language_code,
				v_ingredient_term_id,
				v_ingredient_alias_id,
				v_mapping_id
			);

			insert into public.food_preference_mapping_requests (
				preference_rule_type,
				normalized_value,
				language_code,
				status,
				resolved_mapping_id,
				resolved_ingredient_term_id,
				resolved_preference_tag_id,
				reviewed_at
			)
			values (
				v_rule.rule_type,
				v_rule.normalized_value,
				'und',
				'resolved',
				v_mapping_id,
				v_ingredient_term_id,
				v_mapped_tag_id,
				now()
			)
			on conflict (preference_rule_type, normalized_value, language_code)
			do update set
				status = 'resolved',
				resolved_mapping_id = excluded.resolved_mapping_id,
				resolved_ingredient_term_id = excluded.resolved_ingredient_term_id,
				resolved_preference_tag_id = excluded.resolved_preference_tag_id,
				reviewed_at = excluded.reviewed_at,
				last_seen_at = now(),
				updated_at = now();
		else
			insert into public.user_compatibility_rules (
				user_id,
				tag_id,
				rule_type,
				severity,
				raw_value,
				normalized_value,
				resolution_status,
				resolution_method,
				resolution_policy_version_id,
				resolution_language_code
			)
			values (
				p_user_id,
				null,
				v_rule.rule_type,
				'warn',
				v_rule.raw_value,
				v_rule.normalized_value,
				'unresolved',
				'unresolved',
				v_active_policy_id,
				'und'
			);

			insert into public.food_preference_mapping_requests (
				preference_rule_type,
				normalized_value,
				language_code
			)
			values (v_rule.rule_type, v_rule.normalized_value, 'und')
			on conflict (preference_rule_type, normalized_value, language_code)
			do update set
				occurrence_count =
					public.food_preference_mapping_requests.occurrence_count + 1,
				status = case
					when public.food_preference_mapping_requests.status = 'resolved'
						then 'pending'
					else public.food_preference_mapping_requests.status
				end,
				resolved_mapping_id = null,
				resolved_ingredient_term_id = null,
				resolved_preference_tag_id = null,
				reviewed_at = case
					when public.food_preference_mapping_requests.status = 'resolved'
						then null
					else public.food_preference_mapping_requests.reviewed_at
				end,
				last_seen_at = now(),
				updated_at = now();
		end if;
	end loop;
end;
$$;

create or replace function public.refresh_food_compatibility_preference_mapping_bundle(
	p_policy_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_mapping_snapshot jsonb;
	v_bundle_content_hash text;
	v_prior_bundle_write text;
begin
	select coalesce(jsonb_agg(
		jsonb_build_object(
			'id', mapping.id,
			'ingredientTermId', mapping.ingredient_term_id,
			'preferenceTagId', mapping.preference_tag_id,
			'preferenceRuleType', mapping.preference_rule_type,
			'sourceReference', mapping.source_reference,
			'reviewedAt', mapping.reviewed_at
		)
		order by mapping.preference_rule_type, mapping.ingredient_term_id, mapping.id
	), '[]'::jsonb)
	into v_mapping_snapshot
	from public.food_compatibility_policy_preference_term_mappings mapping
	where mapping.policy_version_id = p_policy_version_id;

	select encode(
		extensions.digest(
			convert_to(
				concat_ws(
					'|',
					version.match_rule_snapshot::text,
					version.conflict_rule_snapshot::text,
					version.alias_snapshot::text,
					version.relationship_snapshot::text,
					version.exemption_snapshot::text,
					version.regional_profile_snapshot::text,
					v_mapping_snapshot::text
				),
				'UTF8'
			),
			'sha256'
		),
		'hex'
	)
	into v_bundle_content_hash
	from public.food_compatibility_policy_versions version
	where version.id = p_policy_version_id;

	if v_bundle_content_hash is null then
		raise exception 'Unknown compatibility policy version.';
	end if;

	v_prior_bundle_write := current_setting('blendcalc.policy_bundle_write', true);
	perform set_config('blendcalc.policy_bundle_write', 'on', true);
	update public.food_compatibility_policy_versions
	set
		preference_mapping_snapshot = v_mapping_snapshot,
		bundle_content_hash = v_bundle_content_hash,
		updated_at = now()
	where id = p_policy_version_id;
	perform set_config(
		'blendcalc.policy_bundle_write',
		coalesce(v_prior_bundle_write, ''),
		true
	);
end;
$$;

create or replace function public.activate_food_preference_resolution_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	perform public.refresh_food_compatibility_preference_mapping_bundle(new.id);

	perform public.sync_user_compatibility_rules(
		preferences.user_id,
		preferences.allergens,
		preferences.dietary_restrictions
	)
	from public.user_food_preferences preferences;

	return new;
end;
$$;

create trigger activate_food_preference_resolution_policy
	after update of status on public.food_compatibility_policy_versions
	for each row
	when (new.status = 'active' and old.status is distinct from new.status)
	execute function public.activate_food_preference_resolution_policy();

create view public.food_compatibility_preference_term_mappings
with (security_invoker = true)
as
select
	mapping.id,
	mapping.policy_version_id,
	mapping.ingredient_term_id,
	mapping.preference_tag_id,
	mapping.preference_rule_type,
	mapping.source_reference,
	mapping.reviewed_by,
	mapping.reviewed_at,
	mapping.created_at,
	mapping.updated_at
from public.food_compatibility_policy_preference_term_mappings mapping
where mapping.policy_version_id =
	public.active_food_compatibility_policy_version_id();

alter table public.food_compatibility_policy_preference_term_mappings
	enable row level security;
alter table public.food_compatibility_policy_preference_term_mappings
	force row level security;
alter table public.food_preference_mapping_requests enable row level security;
alter table public.food_preference_mapping_requests force row level security;

drop policy if exists "Users can create their compatibility rules"
	on public.user_compatibility_rules;
drop policy if exists "Users can update their compatibility rules"
	on public.user_compatibility_rules;
drop policy if exists "Users can delete their compatibility rules"
	on public.user_compatibility_rules;

revoke all on table public.food_compatibility_policy_preference_term_mappings
	from public, anon, authenticated;
revoke all on table public.food_preference_mapping_requests
	from public, anon, authenticated;
revoke all on public.food_compatibility_preference_term_mappings
	from public, anon, authenticated;
revoke insert, update, delete on table public.user_compatibility_rules
	from authenticated;

grant select, insert, update, delete
	on table public.food_compatibility_policy_preference_term_mappings
	to service_role;
grant select, insert, update, delete
	on table public.food_preference_mapping_requests
	to service_role;
grant select on public.food_compatibility_preference_term_mappings
	to service_role;

revoke all on function public.validate_food_compatibility_preference_term_mapping()
	from public, anon, authenticated;
revoke all on function public.clone_food_compatibility_preference_term_mappings()
	from public, anon, authenticated;
revoke all on function public.refresh_food_compatibility_preference_mapping_bundle(uuid)
	from public, anon, authenticated;
revoke all on function public.activate_food_preference_resolution_policy()
	from public, anon, authenticated;
revoke all on function public.sync_user_compatibility_rules(uuid, text[], text[])
	from public, anon, authenticated;

grant execute on function public.sync_user_compatibility_rules(uuid, text[], text[])
	to service_role;
grant execute on function public.refresh_food_compatibility_preference_mapping_bundle(uuid)
	to service_role;

do $$
declare
	v_active_policy_id uuid;
begin
	v_active_policy_id := public.active_food_compatibility_policy_version_id();
	perform public.refresh_food_compatibility_preference_mapping_bundle(
		v_active_policy_id
	);

	perform public.sync_user_compatibility_rules(
		preferences.user_id,
		preferences.allergens,
		preferences.dietary_restrictions
	)
	from public.user_food_preferences preferences;
end;
$$;

comment on table public.food_compatibility_policy_preference_term_mappings is
	'Reviewed, immutable policy-version relationships that map exact canonical ingredient terminology to a compatibility preference tag.';
comment on table public.food_preference_mapping_requests is
	'Privacy-safe review queue for unmatched normalized food preferences. Raw user wording and user identifiers remain in user-owned tables.';
comment on column public.user_compatibility_rules.resolution_status is
	'Whether the saved preference has one exact reviewed mapping and can participate in automated checks.';
comment on function public.sync_user_compatibility_rules(uuid, text[], text[]) is
	'Resolves exact saved food preferences against the active reviewed policy. Ambiguous and unmatched text stays explicitly unresolved.';
