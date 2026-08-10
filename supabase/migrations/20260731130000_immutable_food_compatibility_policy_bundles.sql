alter table public.food_compatibility_policy_versions
	drop constraint food_compatibility_policy_versions_status_check,
	add constraint food_compatibility_policy_versions_status_check
		check (status in ('draft', 'active', 'retired')),
	add column alias_snapshot jsonb not null default '[]'::jsonb
		check (jsonb_typeof(alias_snapshot) = 'array'),
	add column relationship_snapshot jsonb not null default '[]'::jsonb
		check (jsonb_typeof(relationship_snapshot) = 'array'),
	add column exemption_snapshot jsonb not null default '[]'::jsonb
		check (jsonb_typeof(exemption_snapshot) = 'array'),
	add column regional_profile_snapshot jsonb not null default '[]'::jsonb
		check (jsonb_typeof(regional_profile_snapshot) = 'array'),
	add column bundle_content_hash text
		check (
			bundle_content_hash is null
			or bundle_content_hash ~ '^[a-f0-9]{64}$'
		);

alter table public.compatibility_rule_conflicts
	add column policy_version_id uuid
		references public.food_compatibility_policy_versions(id) on delete restrict;

update public.compatibility_rule_conflicts
set policy_version_id = public.active_food_compatibility_policy_version_id()
where policy_version_id is null;

alter table public.compatibility_rule_conflicts
	alter column policy_version_id set not null,
	drop constraint compatibility_rule_conflicts_pkey,
	add primary key (
		policy_version_id,
		preference_tag_id,
		fact_tag_id
	);

alter table public.food_compatibility_match_rules
	add column policy_version_id uuid
		references public.food_compatibility_policy_versions(id) on delete restrict;

update public.food_compatibility_match_rules
set policy_version_id = public.active_food_compatibility_policy_version_id()
where policy_version_id is null;

alter table public.food_compatibility_match_rules
	alter column policy_version_id set not null,
	drop constraint food_compatibility_match_rule_tag_id_source_key_field_name__key,
	add unique nulls not distinct (
		policy_version_id,
		tag_id,
		source_key,
		field_name,
		match_pattern,
		fact_type
	);

alter table public.ingredient_term_aliases
	add column policy_version_id uuid
		references public.food_compatibility_policy_versions(id) on delete restrict;

update public.ingredient_term_aliases
set policy_version_id = public.active_food_compatibility_policy_version_id()
where policy_version_id is null;

alter table public.ingredient_term_aliases
	alter column policy_version_id set not null;

drop index ingredient_term_aliases_identity_idx;

create unique index ingredient_term_aliases_identity_idx
	on public.ingredient_term_aliases (
		policy_version_id,
		ingredient_term_id,
		normalized_alias,
		language_code,
		alias_type,
		source_key
	) nulls not distinct;

alter table public.ingredient_term_relationships
	add column policy_version_id uuid
		references public.food_compatibility_policy_versions(id) on delete restrict;

update public.ingredient_term_relationships
set policy_version_id = public.active_food_compatibility_policy_version_id()
where policy_version_id is null;

alter table public.ingredient_term_relationships
	alter column policy_version_id set not null;

drop index ingredient_term_relationships_identity_idx;

create unique index ingredient_term_relationships_identity_idx
	on public.ingredient_term_relationships (
		policy_version_id,
		child_term_id,
		parent_term_id,
		relationship_type,
		processing_state,
		jurisdiction_code
	) nulls not distinct;

alter table public.compatibility_rule_conflicts
	rename to food_compatibility_policy_conflicts;

alter table public.food_compatibility_match_rules
	rename to food_compatibility_policy_match_rules;

alter table public.ingredient_term_aliases
	rename to food_compatibility_policy_ingredient_aliases;

alter table public.ingredient_term_relationships
	rename to food_compatibility_policy_ingredient_relationships;

create table public.food_compatibility_policy_exemptions (
	id uuid primary key default gen_random_uuid(),
	policy_version_id uuid not null
		references public.food_compatibility_policy_versions(id) on delete restrict,
	jurisdiction_code text not null check (btrim(jurisdiction_code) <> ''),
	ingredient_term_id uuid
		references public.ingredient_terms(id) on delete restrict,
	parent_term_id uuid
		references public.ingredient_terms(id) on delete restrict,
	fact_tag_id uuid
		references public.compatibility_tags(id) on delete restrict,
	processing_state text,
	exemption_type text not null
		check (exemption_type in ('labeling', 'threshold', 'processing')),
	warning_behavior text not null default 'context-only'
		check (warning_behavior = 'context-only'),
	source_reference text not null check (btrim(source_reference) <> ''),
	reviewed_at timestamptz not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint food_compatibility_policy_exemptions_subject_check check (
		num_nonnulls(ingredient_term_id, fact_tag_id) >= 1
	),
	unique nulls not distinct (
		policy_version_id,
		jurisdiction_code,
		ingredient_term_id,
		parent_term_id,
		fact_tag_id,
		processing_state,
		exemption_type
	)
);

create trigger set_food_compatibility_policy_exemptions_updated_at
	before update on public.food_compatibility_policy_exemptions
	for each row execute function public.set_updated_at();

create index food_compatibility_policy_exemptions_lookup_idx
	on public.food_compatibility_policy_exemptions (
		policy_version_id,
		jurisdiction_code,
		ingredient_term_id,
		fact_tag_id
	);

create view public.compatibility_rule_conflicts
with (security_invoker = true)
as
select
	conflict.preference_tag_id,
	conflict.fact_tag_id,
	conflict.severity,
	conflict.created_at,
	conflict.updated_at,
	conflict.warning_code,
	conflict.priority,
	conflict.policy_version_id
from public.food_compatibility_policy_conflicts conflict
where conflict.policy_version_id =
	public.active_food_compatibility_policy_version_id();

create view public.food_compatibility_match_rules
with (security_invoker = true)
as
select
	rule.id,
	rule.tag_id,
	rule.source_key,
	rule.field_name,
	rule.match_pattern,
	rule.fact_type,
	rule.source_type,
	rule.confidence,
	rule.priority,
	rule.enabled,
	rule.created_at,
	rule.updated_at,
	rule.exclude_pattern,
	rule.policy_version_id
from public.food_compatibility_policy_match_rules rule
where rule.policy_version_id =
	public.active_food_compatibility_policy_version_id();

create view public.ingredient_term_aliases
with (security_invoker = true)
as
select
	alias.id,
	alias.ingredient_term_id,
	alias.alias,
	alias.normalized_alias,
	alias.language_code,
	alias.alias_type,
	alias.review_status,
	alias.source_key,
	alias.source_reference,
	alias.reviewed_by,
	alias.reviewed_at,
	alias.created_at,
	alias.updated_at,
	alias.policy_version_id
from public.food_compatibility_policy_ingredient_aliases alias
where alias.policy_version_id =
	public.active_food_compatibility_policy_version_id();

create view public.ingredient_term_relationships
with (security_invoker = true)
as
select
	relationship.id,
	relationship.child_term_id,
	relationship.parent_term_id,
	relationship.relationship_type,
	relationship.processing_state,
	relationship.jurisdiction_code,
	relationship.conflict_inheritance,
	relationship.review_status,
	relationship.source_key,
	relationship.source_reference,
	relationship.reviewed_by,
	relationship.reviewed_at,
	relationship.created_at,
	relationship.updated_at,
	relationship.policy_version_id
from public.food_compatibility_policy_ingredient_relationships relationship
where relationship.policy_version_id =
	public.active_food_compatibility_policy_version_id();

drop policy if exists "Authenticated users can read compatibility conflicts"
	on public.food_compatibility_policy_conflicts;
create policy "Authenticated users can read active compatibility conflicts"
	on public.food_compatibility_policy_conflicts
	for select
	to authenticated
	using (
		policy_version_id = public.active_food_compatibility_policy_version_id()
	);

drop policy if exists "Authenticated users can read food compatibility match rules"
	on public.food_compatibility_policy_match_rules;
create policy "Authenticated users can read active compatibility match rules"
	on public.food_compatibility_policy_match_rules
	for select
	to authenticated
	using (
		enabled
		and policy_version_id =
			public.active_food_compatibility_policy_version_id()
	);

drop policy if exists "Authenticated users can read reviewed ingredient aliases"
	on public.food_compatibility_policy_ingredient_aliases;
create policy "Authenticated users can read active reviewed ingredient aliases"
	on public.food_compatibility_policy_ingredient_aliases
	for select
	to authenticated
	using (
		review_status = 'reviewed'
		and policy_version_id =
			public.active_food_compatibility_policy_version_id()
	);

drop policy if exists "Authenticated users can read reviewed ingredient relationships"
	on public.food_compatibility_policy_ingredient_relationships;
create policy "Authenticated users can read active reviewed ingredient relationships"
	on public.food_compatibility_policy_ingredient_relationships
	for select
	to authenticated
	using (
		review_status = 'reviewed'
		and policy_version_id =
			public.active_food_compatibility_policy_version_id()
	);

alter table public.food_compatibility_policy_exemptions enable row level security;
alter table public.food_compatibility_policy_exemptions force row level security;

create or replace function public.enforce_food_compatibility_policy_child_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_policy_version_id uuid;
	v_status text;
begin
	if current_setting('blendcalc.policy_bundle_write', true) = 'on' then
		if tg_op = 'DELETE' then return old; end if;
		return new;
	end if;

	v_policy_version_id := case
		when tg_op = 'DELETE' then old.policy_version_id
		else new.policy_version_id
	end;

	select status
	into v_status
	from public.food_compatibility_policy_versions
	where id = v_policy_version_id;

	if v_status is distinct from 'draft' then
		raise exception 'Compatibility policy rows are immutable after activation.';
	end if;

	if tg_op = 'UPDATE' and old.policy_version_id <> new.policy_version_id then
		raise exception 'Compatibility policy rows cannot move between versions.';
	end if;

	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;

create or replace function public.enforce_food_compatibility_profile_tag_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_profile_id uuid;
	v_status text;
begin
	if current_setting('blendcalc.policy_bundle_write', true) = 'on' then
		if tg_op = 'DELETE' then return old; end if;
		return new;
	end if;

	v_profile_id := case when tg_op = 'DELETE' then old.profile_id else new.profile_id end;

	select version.status
	into v_status
	from public.food_allergen_regulatory_profiles profile
	join public.food_compatibility_policy_versions version
		on version.id = profile.policy_version_id
	where profile.id = v_profile_id;

	if v_status is distinct from 'draft' then
		raise exception 'Compatibility policy rows are immutable after activation.';
	end if;

	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;

create or replace function public.enforce_food_compatibility_policy_version_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if current_setting('blendcalc.policy_bundle_write', true) = 'on' then
		if tg_op = 'DELETE' then return old; end if;
		return new;
	end if;

	if tg_op = 'INSERT' and new.status <> 'draft' then
		raise exception 'New compatibility policy versions must begin as drafts.';
	elsif tg_op = 'UPDATE' and (
		old.status <> 'draft'
		or new.status <> 'draft'
	) then
		raise exception 'Compatibility policy versions are immutable after activation.';
	elsif tg_op = 'DELETE' and old.status <> 'draft' then
		raise exception 'Compatibility policy versions are immutable after activation.';
	end if;

	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;

create trigger enforce_food_compatibility_policy_match_rule_immutability
	before insert or update or delete
	on public.food_compatibility_policy_match_rules
	for each row execute function
		public.enforce_food_compatibility_policy_child_immutability();

create trigger enforce_food_compatibility_policy_conflict_immutability
	before insert or update or delete
	on public.food_compatibility_policy_conflicts
	for each row execute function
		public.enforce_food_compatibility_policy_child_immutability();

create trigger enforce_food_compatibility_policy_alias_immutability
	before insert or update or delete
	on public.food_compatibility_policy_ingredient_aliases
	for each row execute function
		public.enforce_food_compatibility_policy_child_immutability();

create trigger enforce_food_compatibility_policy_relationship_immutability
	before insert or update or delete
	on public.food_compatibility_policy_ingredient_relationships
	for each row execute function
		public.enforce_food_compatibility_policy_child_immutability();

create trigger enforce_food_compatibility_policy_exemption_immutability
	before insert or update or delete
	on public.food_compatibility_policy_exemptions
	for each row execute function
		public.enforce_food_compatibility_policy_child_immutability();

create trigger enforce_food_compatibility_regional_profile_immutability
	before insert or update or delete
	on public.food_allergen_regulatory_profiles
	for each row execute function
		public.enforce_food_compatibility_policy_child_immutability();

create trigger enforce_food_compatibility_regional_profile_tag_immutability
	before insert or update or delete
	on public.food_allergen_regulatory_profile_tags
	for each row execute function
		public.enforce_food_compatibility_profile_tag_immutability();

create trigger enforce_food_compatibility_policy_version_immutability
	before insert or update or delete
	on public.food_compatibility_policy_versions
	for each row execute function
		public.enforce_food_compatibility_policy_version_immutability();

create or replace function public.validate_product_compatibility_fact_policy_binding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_match_policy_version_id uuid;
begin
	if new.match_rule_id is null then
		return new;
	end if;

	select policy_version_id
	into v_match_policy_version_id
	from public.food_compatibility_policy_match_rules
	where id = new.match_rule_id;

	if v_match_policy_version_id is distinct from new.policy_version_id then
		raise exception 'Compatibility fact and extraction rule policy versions must match.';
	end if;

	return new;
end;
$$;

create trigger validate_product_compatibility_fact_policy_binding
	before insert or update of match_rule_id, policy_version_id
	on public.product_compatibility_facts
	for each row execute function
		public.validate_product_compatibility_fact_policy_binding();

create or replace function public.create_food_compatibility_policy_draft(
	p_version_number integer,
	p_change_summary text,
	p_source_references jsonb,
	p_effective_at timestamptz,
	p_reviewed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	v_active_policy_id uuid;
	v_draft_policy_id uuid;
	v_profile record;
	v_new_profile_id uuid;
begin
	if p_version_number <= 0
		or nullif(btrim(p_change_summary), '') is null
		or jsonb_typeof(p_source_references) <> 'array'
		or p_effective_at is null
		or p_reviewed_at is null then
		raise exception 'A complete compatibility policy draft is required.';
	end if;

	select id
	into v_active_policy_id
	from public.food_compatibility_policy_versions
	where status = 'active'
	order by version_number desc
	limit 1;

	insert into public.food_compatibility_policy_versions (
		version_number,
		status,
		change_summary,
		source_references,
		effective_at,
		reviewed_at
	)
	values (
		p_version_number,
		'draft',
		btrim(p_change_summary),
		p_source_references,
		p_effective_at,
		p_reviewed_at
	)
	returning id into v_draft_policy_id;

	if v_active_policy_id is null then
		return v_draft_policy_id;
	end if;

	insert into public.food_compatibility_policy_match_rules (
		policy_version_id,
		tag_id,
		source_key,
		field_name,
		match_pattern,
		fact_type,
		source_type,
		confidence,
		priority,
		enabled,
		exclude_pattern
	)
	select
		v_draft_policy_id,
		rule.tag_id,
		rule.source_key,
		rule.field_name,
		rule.match_pattern,
		rule.fact_type,
		rule.source_type,
		rule.confidence,
		rule.priority,
		rule.enabled,
		rule.exclude_pattern
	from public.food_compatibility_policy_match_rules rule
	where rule.policy_version_id = v_active_policy_id;

	insert into public.food_compatibility_policy_conflicts (
		policy_version_id,
		preference_tag_id,
		fact_tag_id,
		severity,
		warning_code,
		priority
	)
	select
		v_draft_policy_id,
		conflict.preference_tag_id,
		conflict.fact_tag_id,
		conflict.severity,
		conflict.warning_code,
		conflict.priority
	from public.food_compatibility_policy_conflicts conflict
	where conflict.policy_version_id = v_active_policy_id;

	insert into public.food_compatibility_policy_ingredient_aliases (
		policy_version_id,
		ingredient_term_id,
		alias,
		language_code,
		alias_type,
		review_status,
		source_key,
		source_reference,
		reviewed_by,
		reviewed_at
	)
	select
		v_draft_policy_id,
		alias.ingredient_term_id,
		alias.alias,
		alias.language_code,
		alias.alias_type,
		alias.review_status,
		alias.source_key,
		alias.source_reference,
		alias.reviewed_by,
		alias.reviewed_at
	from public.food_compatibility_policy_ingredient_aliases alias
	where alias.policy_version_id = v_active_policy_id;

	insert into public.food_compatibility_policy_ingredient_relationships (
		policy_version_id,
		child_term_id,
		parent_term_id,
		relationship_type,
		processing_state,
		jurisdiction_code,
		conflict_inheritance,
		review_status,
		source_key,
		source_reference,
		reviewed_by,
		reviewed_at
	)
	select
		v_draft_policy_id,
		relationship.child_term_id,
		relationship.parent_term_id,
		relationship.relationship_type,
		relationship.processing_state,
		relationship.jurisdiction_code,
		relationship.conflict_inheritance,
		relationship.review_status,
		relationship.source_key,
		relationship.source_reference,
		relationship.reviewed_by,
		relationship.reviewed_at
	from public.food_compatibility_policy_ingredient_relationships relationship
	where relationship.policy_version_id = v_active_policy_id;

	insert into public.food_compatibility_policy_exemptions (
		policy_version_id,
		jurisdiction_code,
		ingredient_term_id,
		parent_term_id,
		fact_tag_id,
		processing_state,
		exemption_type,
		warning_behavior,
		source_reference,
		reviewed_at
	)
	select
		v_draft_policy_id,
		exemption.jurisdiction_code,
		exemption.ingredient_term_id,
		exemption.parent_term_id,
		exemption.fact_tag_id,
		exemption.processing_state,
		exemption.exemption_type,
		exemption.warning_behavior,
		exemption.source_reference,
		exemption.reviewed_at
	from public.food_compatibility_policy_exemptions exemption
	where exemption.policy_version_id = v_active_policy_id;

	for v_profile in
		select *
		from public.food_allergen_regulatory_profiles
		where policy_version_id = v_active_policy_id
	loop
		insert into public.food_allergen_regulatory_profiles (
			policy_version_id,
			profile_key,
			region_code,
			display_name,
			authority,
			policy_reference,
			source_url,
			reviewed_at,
			active
		)
		values (
			v_draft_policy_id,
			v_profile.profile_key,
			v_profile.region_code,
			v_profile.display_name,
			v_profile.authority,
			v_profile.policy_reference,
			v_profile.source_url,
			v_profile.reviewed_at,
			v_profile.active
		)
		returning id into v_new_profile_id;

		insert into public.food_allergen_regulatory_profile_tags (
			profile_id,
			tag_id,
			classification,
			source_label
		)
		select
			v_new_profile_id,
			profile_tag.tag_id,
			profile_tag.classification,
			profile_tag.source_label
		from public.food_allergen_regulatory_profile_tags profile_tag
		where profile_tag.profile_id = v_profile.id;
	end loop;

	return v_draft_policy_id;
end;
$$;

create or replace function public.activate_food_compatibility_policy_version(
	p_policy_version_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
	v_policy_version integer;
	v_match_snapshot jsonb;
	v_conflict_snapshot jsonb;
	v_alias_snapshot jsonb;
	v_relationship_snapshot jsonb;
	v_exemption_snapshot jsonb;
	v_regional_snapshot jsonb;
	v_bundle_content_hash text;
	v_prior_bundle_write text;
begin
	v_prior_bundle_write := current_setting('blendcalc.policy_bundle_write', true);
	lock table public.food_compatibility_policy_versions in exclusive mode;

	select version_number
	into v_policy_version
	from public.food_compatibility_policy_versions
	where id = p_policy_version_id
		and status in ('draft', 'active', 'retired');

	if v_policy_version is null then
		raise exception 'Only a complete compatibility policy can be activated.';
	end if;

	if not exists (
		select 1
		from public.food_compatibility_policy_match_rules
		where policy_version_id = p_policy_version_id
			and enabled
	) or not exists (
		select 1
		from public.food_compatibility_policy_conflicts
		where policy_version_id = p_policy_version_id
	) then
		raise exception 'Compatibility policy activation requires extraction and conflict rules.';
	end if;

	select coalesce(jsonb_agg(
		jsonb_build_object(
			'id', rule.id,
			'tagId', rule.tag_id,
			'sourceKey', rule.source_key,
			'fieldName', rule.field_name,
			'matchPattern', rule.match_pattern,
			'excludePattern', rule.exclude_pattern,
			'factType', rule.fact_type,
			'sourceType', rule.source_type,
			'confidence', rule.confidence,
			'priority', rule.priority,
			'enabled', rule.enabled
		)
		order by rule.priority, rule.id
	), '[]'::jsonb)
	into v_match_snapshot
	from public.food_compatibility_policy_match_rules rule
	where rule.policy_version_id = p_policy_version_id;

	select coalesce(jsonb_agg(
		jsonb_build_object(
			'preferenceTagId', conflict.preference_tag_id,
			'factTagId', conflict.fact_tag_id,
			'severity', conflict.severity,
			'warningCode', conflict.warning_code,
			'priority', conflict.priority
		)
		order by conflict.priority, conflict.preference_tag_id, conflict.fact_tag_id
	), '[]'::jsonb)
	into v_conflict_snapshot
	from public.food_compatibility_policy_conflicts conflict
	where conflict.policy_version_id = p_policy_version_id;

	select coalesce(jsonb_agg(
		jsonb_build_object(
			'ingredientTermId', alias.ingredient_term_id,
			'alias', alias.alias,
			'languageCode', alias.language_code,
			'aliasType', alias.alias_type,
			'reviewStatus', alias.review_status,
			'sourceKey', alias.source_key,
			'sourceReference', alias.source_reference
		)
		order by alias.ingredient_term_id, alias.normalized_alias, alias.id
	), '[]'::jsonb)
	into v_alias_snapshot
	from public.food_compatibility_policy_ingredient_aliases alias
	where alias.policy_version_id = p_policy_version_id;

	select coalesce(jsonb_agg(
		jsonb_build_object(
			'childTermId', relationship.child_term_id,
			'parentTermId', relationship.parent_term_id,
			'relationshipType', relationship.relationship_type,
			'processingState', relationship.processing_state,
			'jurisdictionCode', relationship.jurisdiction_code,
			'conflictInheritance', relationship.conflict_inheritance,
			'reviewStatus', relationship.review_status,
			'sourceReference', relationship.source_reference
		)
		order by relationship.child_term_id, relationship.parent_term_id, relationship.id
	), '[]'::jsonb)
	into v_relationship_snapshot
	from public.food_compatibility_policy_ingredient_relationships relationship
	where relationship.policy_version_id = p_policy_version_id;

	select coalesce(jsonb_agg(
		jsonb_build_object(
			'jurisdictionCode', exemption.jurisdiction_code,
			'ingredientTermId', exemption.ingredient_term_id,
			'parentTermId', exemption.parent_term_id,
			'factTagId', exemption.fact_tag_id,
			'processingState', exemption.processing_state,
			'exemptionType', exemption.exemption_type,
			'warningBehavior', exemption.warning_behavior,
			'sourceReference', exemption.source_reference,
			'reviewedAt', exemption.reviewed_at
		)
		order by exemption.jurisdiction_code, exemption.id
	), '[]'::jsonb)
	into v_exemption_snapshot
	from public.food_compatibility_policy_exemptions exemption
	where exemption.policy_version_id = p_policy_version_id;

	select coalesce(jsonb_agg(
		jsonb_build_object(
			'profileKey', profile.profile_key,
			'regionCode', profile.region_code,
			'displayName', profile.display_name,
			'authority', profile.authority,
			'policyReference', profile.policy_reference,
			'sourceUrl', profile.source_url,
			'reviewedAt', profile.reviewed_at,
			'active', profile.active,
			'tags', coalesce((
				select jsonb_agg(jsonb_build_object(
					'tagId', profile_tag.tag_id,
					'classification', profile_tag.classification,
					'sourceLabel', profile_tag.source_label
				) order by profile_tag.classification, profile_tag.tag_id)
				from public.food_allergen_regulatory_profile_tags profile_tag
				where profile_tag.profile_id = profile.id
			), '[]'::jsonb)
		)
		order by profile.region_code, profile.profile_key
	), '[]'::jsonb)
	into v_regional_snapshot
	from public.food_allergen_regulatory_profiles profile
	where profile.policy_version_id = p_policy_version_id;

	v_bundle_content_hash := encode(
		extensions.digest(
			convert_to(
				concat_ws(
					'|',
					v_match_snapshot::text,
					v_conflict_snapshot::text,
					v_alias_snapshot::text,
					v_relationship_snapshot::text,
					v_exemption_snapshot::text,
					v_regional_snapshot::text
				),
				'UTF8'
			),
			'sha256'
		),
		'hex'
	);

	perform set_config('blendcalc.policy_bundle_write', 'on', true);

	update public.food_compatibility_policy_versions
	set
		match_rule_snapshot = v_match_snapshot,
		conflict_rule_snapshot = v_conflict_snapshot,
		alias_snapshot = v_alias_snapshot,
		relationship_snapshot = v_relationship_snapshot,
		exemption_snapshot = v_exemption_snapshot,
		regional_profile_snapshot = v_regional_snapshot,
		bundle_content_hash = v_bundle_content_hash,
		updated_at = now()
	where id = p_policy_version_id;

	update public.food_compatibility_policy_versions
	set status = 'retired', updated_at = now()
	where status = 'active'
		and id <> p_policy_version_id;

	update public.food_compatibility_policy_versions
	set status = 'active', updated_at = now()
	where id = p_policy_version_id;

	perform public.extract_product_compatibility_facts(
		product.id,
		null,
		null,
		product.food,
		'shared_product_metadata'
	)
	from public.shared_products product;

	perform public.extract_product_compatibility_facts(
		null,
		observation.id,
		null,
		coalesce(observation.normalized_food, '{}'::jsonb),
		'shared_observation_metadata'
	)
	from public.shared_product_observations observation;

	perform public.extract_product_compatibility_facts(
		null,
		null,
		submission.id,
		submission.food,
		'shared_submission_metadata'
	)
	from public.shared_product_submissions submission;

	perform public.rebuild_food_preference_option_catalog();
	perform set_config(
		'blendcalc.policy_bundle_write',
		coalesce(v_prior_bundle_write, ''),
		true
	);

	return v_policy_version;
end;
$$;

do $$
declare
	v_active_policy_id uuid;
begin
	select id
	into v_active_policy_id
	from public.food_compatibility_policy_versions
	where status = 'active';

	perform public.activate_food_compatibility_policy_version(v_active_policy_id);
end;
$$;

revoke all on table public.food_compatibility_policy_match_rules
	from public, anon, authenticated;
revoke all on table public.food_compatibility_policy_conflicts
	from public, anon, authenticated;
revoke all on table public.food_compatibility_policy_ingredient_aliases
	from public, anon, authenticated;
revoke all on table public.food_compatibility_policy_ingredient_relationships
	from public, anon, authenticated;
revoke all on table public.food_compatibility_policy_exemptions
	from public, anon, authenticated;

grant select on table public.food_compatibility_policy_match_rules
	to authenticated, service_role;
grant select on table public.food_compatibility_policy_conflicts
	to authenticated, service_role;
grant select on table public.food_compatibility_policy_ingredient_aliases
	to authenticated, service_role;
grant select on table public.food_compatibility_policy_ingredient_relationships
	to authenticated, service_role;
grant select on table public.food_compatibility_policy_exemptions
	to service_role;

revoke all on public.compatibility_rule_conflicts
	from public, anon, authenticated;
revoke all on public.food_compatibility_match_rules
	from public, anon, authenticated;
revoke all on public.ingredient_term_aliases
	from public, anon, authenticated;
revoke all on public.ingredient_term_relationships
	from public, anon, authenticated;

grant select on public.compatibility_rule_conflicts
	to authenticated, service_role;
grant select on public.food_compatibility_match_rules
	to authenticated, service_role;
grant select on public.ingredient_term_aliases
	to authenticated, service_role;
grant select on public.ingredient_term_relationships
	to authenticated, service_role;

revoke all on function public.create_food_compatibility_policy_draft(
	integer,
	text,
	jsonb,
	timestamptz,
	timestamptz
) from public, anon, authenticated;
revoke all on function public.activate_food_compatibility_policy_version(uuid)
	from public, anon, authenticated;
revoke all on function public.enforce_food_compatibility_policy_child_immutability()
	from public, anon, authenticated;
revoke all on function public.enforce_food_compatibility_profile_tag_immutability()
	from public, anon, authenticated;
revoke all on function public.enforce_food_compatibility_policy_version_immutability()
	from public, anon, authenticated;
revoke all on function public.validate_product_compatibility_fact_policy_binding()
	from public, anon, authenticated;

grant execute on function public.create_food_compatibility_policy_draft(
	integer,
	text,
	jsonb,
	timestamptz,
	timestamptz
) to service_role;
grant execute on function public.activate_food_compatibility_policy_version(uuid)
	to service_role;

comment on table public.food_compatibility_policy_match_rules is
	'Immutable extraction rules bound to one compatibility policy version. The active compatibility view exposes only the active version.';
comment on table public.food_compatibility_policy_conflicts is
	'Immutable preference-to-fact conflict rules bound to one compatibility policy version. The active compatibility view exposes only the active version.';
comment on table public.food_compatibility_policy_ingredient_aliases is
	'Language- and source-aware reviewed ingredient aliases bound to one immutable compatibility policy version.';
comment on table public.food_compatibility_policy_ingredient_relationships is
	'Reviewed parent, derivative, and processing relationships bound to one immutable compatibility policy version.';
comment on table public.food_compatibility_policy_exemptions is
	'Jurisdiction- and processing-aware reviewed labeling exemptions. They provide context only and cannot suppress a personal warning.';
comment on function public.activate_food_compatibility_policy_version(uuid) is
	'Atomically activates or rolls back a complete immutable policy bundle, refreshes every compatibility fact, and prevents mixed-version reads.';
