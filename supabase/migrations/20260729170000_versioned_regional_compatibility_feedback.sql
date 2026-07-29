create table public.food_compatibility_policy_versions (
	id uuid primary key default gen_random_uuid(),
	version_number integer not null unique check (version_number > 0),
	status text not null check (status in ('active', 'retired')),
	change_summary text not null check (btrim(change_summary) <> ''),
	match_rule_snapshot jsonb not null default '[]'::jsonb
		check (jsonb_typeof(match_rule_snapshot) = 'array'),
	conflict_rule_snapshot jsonb not null default '[]'::jsonb
		check (jsonb_typeof(conflict_rule_snapshot) = 'array'),
	source_references jsonb not null default '[]'::jsonb
		check (jsonb_typeof(source_references) = 'array'),
	effective_at timestamptz not null,
	reviewed_at timestamptz not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create unique index food_compatibility_policy_versions_one_active_idx
	on public.food_compatibility_policy_versions ((status))
	where status = 'active';

create trigger set_food_compatibility_policy_versions_updated_at
	before update on public.food_compatibility_policy_versions
	for each row execute function public.set_updated_at();

insert into public.food_compatibility_policy_versions (
	version_number,
	status,
	change_summary,
	match_rule_snapshot,
	conflict_rule_snapshot,
	source_references,
	effective_at,
	reviewed_at
)
select
	1,
	'active',
	'Initial complete evidence-based allergen and dietary compatibility policy.',
	coalesce((
		select jsonb_agg(
			jsonb_build_object(
				'tagSlug', tag.slug,
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
			order by rule.priority, tag.slug, rule.id
		)
		from public.food_compatibility_match_rules rule
		join public.compatibility_tags tag on tag.id = rule.tag_id
	), '[]'::jsonb),
	coalesce((
		select jsonb_agg(
			jsonb_build_object(
				'preferenceSlug', preference_tag.slug,
				'factSlug', fact_tag.slug,
				'severity', conflict.severity,
				'warningCode', conflict.warning_code,
				'priority', conflict.priority
			)
			order by conflict.priority, preference_tag.slug, fact_tag.slug
		)
		from public.compatibility_rule_conflicts conflict
		join public.compatibility_tags preference_tag
			on preference_tag.id = conflict.preference_tag_id
		join public.compatibility_tags fact_tag
			on fact_tag.id = conflict.fact_tag_id
	), '[]'::jsonb),
	jsonb_build_array(
		jsonb_build_object(
			'authority', 'U.S. Food and Drug Administration',
			'url', 'https://www.fda.gov/industry/fda-basics-industry/what-major-food-allergen'
		),
		jsonb_build_object(
			'authority', 'Health Canada',
			'url', 'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-allergies-intolerances/food-allergies.html'
		),
		jsonb_build_object(
			'authority', 'United Kingdom Food Standards Agency',
			'url', 'https://www.food.gov.uk/business-guidance/allergen-guidance-for-food-businesses'
		),
		jsonb_build_object(
			'authority', 'European Union',
			'url', 'https://eur-lex.europa.eu/eli/reg/2011/1169'
		),
		jsonb_build_object(
			'authority', 'Food Standards Australia New Zealand',
			'url', 'https://www.foodstandards.gov.au/consumer/labelling/allergen-labelling'
		)
	),
	'2026-07-29T00:00:00Z'::timestamptz,
	'2026-07-29T00:00:00Z'::timestamptz;

create or replace function public.active_food_compatibility_policy_version_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
	select id
	from public.food_compatibility_policy_versions
	where status = 'active'
	order by version_number desc
	limit 1;
$$;

alter table public.product_compatibility_facts
	add column policy_version_id uuid
		references public.food_compatibility_policy_versions(id) on delete restrict;

update public.product_compatibility_facts
set policy_version_id = public.active_food_compatibility_policy_version_id()
where policy_version_id is null;

alter table public.product_compatibility_facts
	alter column policy_version_id
		set default public.active_food_compatibility_policy_version_id(),
	alter column policy_version_id set not null;

create index product_compatibility_facts_policy_version_idx
	on public.product_compatibility_facts (policy_version_id);

create table public.food_allergen_regulatory_profiles (
	id uuid primary key default gen_random_uuid(),
	policy_version_id uuid not null
		references public.food_compatibility_policy_versions(id) on delete restrict,
	profile_key text not null check (profile_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	region_code text not null check (region_code ~ '^[A-Z]{2}(?:-[A-Z]{2})?$'),
	display_name text not null check (btrim(display_name) <> ''),
	authority text not null check (btrim(authority) <> ''),
	policy_reference text not null check (btrim(policy_reference) <> ''),
	source_url text not null check (source_url ~ '^https://'),
	reviewed_at timestamptz not null,
	active boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (policy_version_id, profile_key)
);

create table public.food_allergen_regulatory_profile_tags (
	profile_id uuid not null
		references public.food_allergen_regulatory_profiles(id) on delete cascade,
	tag_id uuid not null
		references public.compatibility_tags(id) on delete restrict,
	classification text not null
		check (
			classification in (
				'major_allergen',
				'priority_allergen',
				'regulated_allergen',
				'gluten_source',
				'regulated_sulphite'
			)
		),
	source_label text not null check (btrim(source_label) <> ''),
	created_at timestamptz not null default now(),
	primary key (profile_id, tag_id, classification)
);

create index food_allergen_regulatory_profiles_region_idx
	on public.food_allergen_regulatory_profiles (
		region_code,
		active,
		policy_version_id
	);

create trigger set_food_allergen_regulatory_profiles_updated_at
	before update on public.food_allergen_regulatory_profiles
	for each row execute function public.set_updated_at();

with active_policy as (
	select id
	from public.food_compatibility_policy_versions
	where status = 'active'
),
profile_values (
	profile_key,
	region_code,
	display_name,
	authority,
	policy_reference,
	source_url
) as (
	values
		(
			'us-fda',
			'US',
			'United States major food allergens',
			'U.S. Food and Drug Administration',
			'Federal Food, Drug, and Cosmetic Act major food allergens',
			'https://www.fda.gov/industry/fda-basics-industry/what-major-food-allergen'
		),
		(
			'ca-health-canada',
			'CA',
			'Canada priority food allergens',
			'Health Canada',
			'Priority food allergens, gluten sources, and added sulphites',
			'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-allergies-intolerances/food-allergies.html'
		),
		(
			'gb-fsa',
			'GB',
			'United Kingdom regulated allergens',
			'Food Standards Agency',
			'Fourteen allergens required to be declared by food law',
			'https://www.food.gov.uk/business-guidance/allergen-guidance-for-food-businesses'
		),
		(
			'eu-1169-2011',
			'EU',
			'European Union regulated allergens',
			'European Union',
			'Regulation (EU) No 1169/2011 Annex II',
			'https://eur-lex.europa.eu/eli/reg/2011/1169'
		),
		(
			'au-nz-fsanz',
			'AU-NZ',
			'Australia and New Zealand regulated allergens',
			'Food Standards Australia New Zealand',
			'Plain English Allergen Labelling requirements',
			'https://www.foodstandards.gov.au/consumer/labelling/allergen-labelling'
		)
)
insert into public.food_allergen_regulatory_profiles (
	policy_version_id,
	profile_key,
	region_code,
	display_name,
	authority,
	policy_reference,
	source_url,
	reviewed_at
)
select
	active_policy.id,
	profile_values.profile_key,
	profile_values.region_code,
	profile_values.display_name,
	profile_values.authority,
	profile_values.policy_reference,
	profile_values.source_url,
	'2026-07-29T00:00:00Z'::timestamptz
from active_policy
cross join profile_values;

with profile_tag_values (
	profile_key,
	tag_slug,
	classification,
	source_label
) as (
	values
		('us-fda', 'milk', 'major_allergen', 'Milk'),
		('us-fda', 'egg', 'major_allergen', 'Egg'),
		('us-fda', 'fish', 'major_allergen', 'Fish'),
		('us-fda', 'shellfish', 'major_allergen', 'Crustacean shellfish'),
		('us-fda', 'tree-nut', 'major_allergen', 'Tree nuts'),
		('us-fda', 'wheat', 'major_allergen', 'Wheat'),
		('us-fda', 'peanut', 'major_allergen', 'Peanuts'),
		('us-fda', 'soy', 'major_allergen', 'Soybeans'),
		('us-fda', 'sesame', 'major_allergen', 'Sesame'),
		('ca-health-canada', 'egg', 'priority_allergen', 'Eggs'),
		('ca-health-canada', 'milk', 'priority_allergen', 'Milk'),
		('ca-health-canada', 'mustard', 'priority_allergen', 'Mustard'),
		('ca-health-canada', 'peanut', 'priority_allergen', 'Peanuts'),
		('ca-health-canada', 'shellfish', 'priority_allergen', 'Crustaceans'),
		('ca-health-canada', 'mollusc', 'priority_allergen', 'Molluscs'),
		('ca-health-canada', 'fish', 'priority_allergen', 'Fish'),
		('ca-health-canada', 'sesame', 'priority_allergen', 'Sesame seeds'),
		('ca-health-canada', 'soy', 'priority_allergen', 'Soy'),
		('ca-health-canada', 'tree-nut', 'priority_allergen', 'Tree nuts'),
		('ca-health-canada', 'wheat', 'priority_allergen', 'Wheat and triticale'),
		('ca-health-canada', 'gluten', 'gluten_source', 'Gluten sources'),
		('ca-health-canada', 'sulfite', 'regulated_sulphite', 'Sulphites'),
		('gb-fsa', 'celery', 'regulated_allergen', 'Celery'),
		('gb-fsa', 'gluten', 'gluten_source', 'Cereals containing gluten'),
		('gb-fsa', 'shellfish', 'regulated_allergen', 'Crustaceans'),
		('gb-fsa', 'egg', 'regulated_allergen', 'Eggs'),
		('gb-fsa', 'fish', 'regulated_allergen', 'Fish'),
		('gb-fsa', 'lupin', 'regulated_allergen', 'Lupin'),
		('gb-fsa', 'milk', 'regulated_allergen', 'Milk'),
		('gb-fsa', 'mollusc', 'regulated_allergen', 'Molluscs'),
		('gb-fsa', 'mustard', 'regulated_allergen', 'Mustard'),
		('gb-fsa', 'peanut', 'regulated_allergen', 'Peanuts'),
		('gb-fsa', 'sesame', 'regulated_allergen', 'Sesame'),
		('gb-fsa', 'soy', 'regulated_allergen', 'Soybeans'),
		('gb-fsa', 'sulfite', 'regulated_sulphite', 'Sulphur dioxide and sulphites'),
		('gb-fsa', 'tree-nut', 'regulated_allergen', 'Tree nuts'),
		('eu-1169-2011', 'celery', 'regulated_allergen', 'Celery'),
		('eu-1169-2011', 'gluten', 'gluten_source', 'Cereals containing gluten'),
		('eu-1169-2011', 'shellfish', 'regulated_allergen', 'Crustaceans'),
		('eu-1169-2011', 'egg', 'regulated_allergen', 'Eggs'),
		('eu-1169-2011', 'fish', 'regulated_allergen', 'Fish'),
		('eu-1169-2011', 'lupin', 'regulated_allergen', 'Lupin'),
		('eu-1169-2011', 'milk', 'regulated_allergen', 'Milk'),
		('eu-1169-2011', 'mollusc', 'regulated_allergen', 'Molluscs'),
		('eu-1169-2011', 'mustard', 'regulated_allergen', 'Mustard'),
		('eu-1169-2011', 'peanut', 'regulated_allergen', 'Peanuts'),
		('eu-1169-2011', 'sesame', 'regulated_allergen', 'Sesame'),
		('eu-1169-2011', 'soy', 'regulated_allergen', 'Soybeans'),
		('eu-1169-2011', 'sulfite', 'regulated_sulphite', 'Sulphur dioxide and sulphites'),
		('eu-1169-2011', 'tree-nut', 'regulated_allergen', 'Tree nuts'),
		('au-nz-fsanz', 'wheat', 'regulated_allergen', 'Wheat'),
		('au-nz-fsanz', 'fish', 'regulated_allergen', 'Fish'),
		('au-nz-fsanz', 'shellfish', 'regulated_allergen', 'Crustacean'),
		('au-nz-fsanz', 'mollusc', 'regulated_allergen', 'Mollusc'),
		('au-nz-fsanz', 'egg', 'regulated_allergen', 'Egg'),
		('au-nz-fsanz', 'milk', 'regulated_allergen', 'Milk'),
		('au-nz-fsanz', 'lupin', 'regulated_allergen', 'Lupin'),
		('au-nz-fsanz', 'peanut', 'regulated_allergen', 'Peanut'),
		('au-nz-fsanz', 'soy', 'regulated_allergen', 'Soy, soya, soybean'),
		('au-nz-fsanz', 'sesame', 'regulated_allergen', 'Sesame'),
		('au-nz-fsanz', 'tree-nut', 'regulated_allergen', 'Tree nuts'),
		('au-nz-fsanz', 'gluten', 'gluten_source', 'Gluten'),
		('au-nz-fsanz', 'sulfite', 'regulated_sulphite', 'Sulphites')
)
insert into public.food_allergen_regulatory_profile_tags (
	profile_id,
	tag_id,
	classification,
	source_label
)
select
	profile.id,
	tag.id,
	profile_tag_values.classification,
	profile_tag_values.source_label
from profile_tag_values
join public.food_allergen_regulatory_profiles profile
	on profile.profile_key = profile_tag_values.profile_key
	and profile.policy_version_id =
		public.active_food_compatibility_policy_version_id()
join public.compatibility_tags tag
	on tag.slug = profile_tag_values.tag_slug;

create table public.food_compatibility_feedback (
	id uuid primary key default gen_random_uuid(),
	reported_by uuid not null references auth.users(id) on delete cascade,
	policy_version_id uuid not null
		references public.food_compatibility_policy_versions(id) on delete restrict
		default public.active_food_compatibility_policy_version_id(),
	shared_product_id uuid references public.shared_products(id) on delete set null,
	source_key text,
	source_id text,
	barcode text,
	food_description text not null check (btrim(food_description) <> ''),
	warning_id text not null check (btrim(warning_id) <> ''),
	issue_code text not null references public.app_issue_codes(code),
	issue_params jsonb not null default '{}'::jsonb
		check (jsonb_typeof(issue_params) = 'object'),
	fact_snapshot jsonb not null default '{}'::jsonb
		check (jsonb_typeof(fact_snapshot) = 'object'),
	report_reason text not null
		check (
			report_reason in (
				'incorrect_match',
				'outdated_source_data',
				'wrong_evidence_type',
				'other'
			)
		),
	report_details text check (
		report_details is null or char_length(report_details) <= 1000
	),
	report_fingerprint text not null check (
		report_fingerprint ~ '^[a-f0-9]{64}$'
	),
	status text not null default 'pending'
		check (status in ('pending', 'confirmed', 'dismissed')),
	resolution_action text not null default 'none'
		check (
			resolution_action in (
				'none',
				'rule_review',
				'source_correction',
				'product_correction',
				'duplicate'
			)
		),
	reviewed_by uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz,
	review_note text check (
		review_note is null or char_length(review_note) <= 2000
	),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint food_compatibility_feedback_identity_check check (
		num_nonnulls(shared_product_id, source_id, barcode) > 0
	),
	constraint food_compatibility_feedback_review_check check (
		(
			status = 'pending'
			and reviewed_by is null
			and reviewed_at is null
		)
		or (
			status in ('confirmed', 'dismissed')
			and reviewed_by is not null
			and reviewed_at is not null
		)
	)
);

create unique index food_compatibility_feedback_pending_report_idx
	on public.food_compatibility_feedback (
		reported_by,
		report_fingerprint
	)
	where status = 'pending';

create index food_compatibility_feedback_moderation_queue_idx
	on public.food_compatibility_feedback (status, created_at);

create index food_compatibility_feedback_product_idx
	on public.food_compatibility_feedback (shared_product_id, status)
	where shared_product_id is not null;

create trigger set_food_compatibility_feedback_updated_at
	before update on public.food_compatibility_feedback
	for each row execute function public.set_updated_at();

create or replace function public.rebuild_shared_product_compatibility_summary(
	p_shared_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_summary jsonb;
	v_policy_version integer;
begin
	select version_number
	into v_policy_version
	from public.food_compatibility_policy_versions
	where status = 'active'
	order by version_number desc
	limit 1;

	select jsonb_build_object(
		'version', 1,
		'policyVersion', coalesce(v_policy_version, 1),
		'generatedAt', now(),
		'allFacts', coalesce(
			jsonb_agg(
				jsonb_build_object(
					'slug', tag.slug,
					'label', tag.label,
					'category', tag.category,
					'factType', fact.fact_type,
					'sourceType', fact.source_type,
					'sourceText', fact.source_text,
					'confidence', fact.confidence
				)
				order by tag.category, tag.label, fact.fact_type
			),
			'[]'::jsonb
		),
		'contains', coalesce(
			jsonb_agg(
				jsonb_build_object(
					'slug', tag.slug,
					'label', tag.label,
					'category', tag.category,
					'factType', fact.fact_type,
					'sourceType', fact.source_type,
					'sourceText', fact.source_text,
					'confidence', fact.confidence
				)
			) filter (where fact.fact_type = 'contains'),
			'[]'::jsonb
		),
		'mayContain', coalesce(
			jsonb_agg(
				jsonb_build_object(
					'slug', tag.slug,
					'label', tag.label,
					'category', tag.category,
					'factType', fact.fact_type,
					'sourceType', fact.source_type,
					'sourceText', fact.source_text,
					'confidence', fact.confidence
				)
			) filter (where fact.fact_type = 'may_contain'),
			'[]'::jsonb
		),
		'dietaryClaims', coalesce(
			jsonb_agg(
				jsonb_build_object(
					'slug', tag.slug,
					'label', tag.label,
					'category', tag.category,
					'factType', fact.fact_type,
					'sourceType', fact.source_type,
					'sourceText', fact.source_text,
					'confidence', fact.confidence
				)
			) filter (where fact.fact_type = 'dietary_claim'),
			'[]'::jsonb
		),
		'ingredientSignals', coalesce(
			jsonb_agg(
				jsonb_build_object(
					'slug', tag.slug,
					'label', tag.label,
					'category', tag.category,
					'factType', fact.fact_type,
					'sourceType', fact.source_type,
					'sourceText', fact.source_text,
					'confidence', fact.confidence
				)
			) filter (where fact.fact_type = 'ingredient_present'),
			'[]'::jsonb
		)
	)
	into v_summary
	from public.product_compatibility_facts fact
	join public.compatibility_tags tag
		on tag.id = fact.tag_id
	where fact.shared_product_id = p_shared_product_id
		and fact.policy_version_id =
			public.active_food_compatibility_policy_version_id();

	update public.shared_products
	set compatibility_summary = coalesce(
			v_summary,
			jsonb_build_object(
				'version', 1,
				'policyVersion', coalesce(v_policy_version, 1),
				'generatedAt', now(),
				'allFacts', '[]'::jsonb,
				'contains', '[]'::jsonb,
				'mayContain', '[]'::jsonb,
				'dietaryClaims', '[]'::jsonb,
				'ingredientSignals', '[]'::jsonb
			)
		),
		updated_at = now()
	where id = p_shared_product_id;
end;
$$;

select public.rebuild_shared_product_compatibility_summary(product.id)
from public.shared_products product;

alter table public.food_compatibility_policy_versions enable row level security;
alter table public.food_compatibility_policy_versions force row level security;
alter table public.food_allergen_regulatory_profiles enable row level security;
alter table public.food_allergen_regulatory_profiles force row level security;
alter table public.food_allergen_regulatory_profile_tags enable row level security;
alter table public.food_allergen_regulatory_profile_tags force row level security;
alter table public.food_compatibility_feedback enable row level security;
alter table public.food_compatibility_feedback force row level security;

create policy "Authenticated users can read active compatibility policy versions"
	on public.food_compatibility_policy_versions
	for select
	to authenticated
	using (status = 'active');

create policy "Authenticated users can read active allergen profiles"
	on public.food_allergen_regulatory_profiles
	for select
	to authenticated
	using (
		active
		and policy_version_id =
			public.active_food_compatibility_policy_version_id()
	);

create policy "Authenticated users can read active allergen profile tags"
	on public.food_allergen_regulatory_profile_tags
	for select
	to authenticated
	using (
		exists (
			select 1
			from public.food_allergen_regulatory_profiles profile
			where profile.id =
				food_allergen_regulatory_profile_tags.profile_id
				and profile.active
				and profile.policy_version_id =
					public.active_food_compatibility_policy_version_id()
		)
	);

create policy "Users can read their compatibility feedback"
	on public.food_compatibility_feedback
	for select
	to authenticated
	using (reported_by = (select auth.uid()));

revoke all on table public.food_compatibility_policy_versions
	from public, anon, authenticated;
revoke all on table public.food_allergen_regulatory_profiles
	from public, anon, authenticated;
revoke all on table public.food_allergen_regulatory_profile_tags
	from public, anon, authenticated;
revoke all on table public.food_compatibility_feedback
	from public, anon, authenticated;

grant select on table public.food_compatibility_policy_versions
	to authenticated, service_role;
grant select on table public.food_allergen_regulatory_profiles
	to authenticated, service_role;
grant select on table public.food_allergen_regulatory_profile_tags
	to authenticated, service_role;
grant select on table public.food_compatibility_feedback
	to authenticated;
grant all on table public.food_compatibility_feedback
	to service_role;

revoke all on function public.active_food_compatibility_policy_version_id()
	from public, anon, authenticated;
grant execute on function public.active_food_compatibility_policy_version_id()
	to authenticated, service_role;

comment on table public.food_compatibility_policy_versions is
	'Versioned snapshots of the active evidence-matching and preference-conflict policy. Product facts and feedback retain the policy version used for evaluation.';

comment on table public.food_allergen_regulatory_profiles is
	'Reviewed jurisdiction-specific allergen declaration profiles derived from official regulatory sources. Profiles provide context and coverage; they do not suppress a user-selected warning.';

comment on table public.food_allergen_regulatory_profile_tags is
	'Normalized compatibility tags included in each reviewed regional allergen profile, preserving the authority source label and classification.';

comment on table public.food_compatibility_feedback is
	'User reports of potentially incorrect compatibility warnings. Reports retain product identity, warning evidence, and policy version for privileged moderation review.';
