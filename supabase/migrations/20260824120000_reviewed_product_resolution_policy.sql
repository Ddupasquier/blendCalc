create table public.product_resolution_policy_versions (
	key text primary key check (btrim(key) <> ''),
	version integer not null check (version > 0),
	display_name text not null check (btrim(display_name) <> ''),
	minimum_related_name_token_overlap numeric not null check (
		minimum_related_name_token_overlap >= 0
		and minimum_related_name_token_overlap <= 1
	),
	numeric_difference_ratio_floor numeric not null check (
		numeric_difference_ratio_floor > 0
	),
	serving_weight_tolerance_grams numeric not null check (
		serving_weight_tolerance_grams >= 0
	),
	category_suggestion_minimum_score numeric not null,
	source_reference text not null check (btrim(source_reference) <> ''),
	reviewed_at timestamptz not null,
	is_default boolean not null default false,
	enabled boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (version)
);

create trigger set_product_resolution_policy_versions_updated_at
	before update on public.product_resolution_policy_versions
	for each row execute function public.set_updated_at();

create unique index product_resolution_policy_versions_default_idx
	on public.product_resolution_policy_versions (is_default)
	where is_default and enabled;

create table public.product_resolution_rank_values (
	policy_key text not null
		references public.product_resolution_policy_versions(key) on delete cascade,
	ranking_context text not null check (ranking_context ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	value_key text not null check (btrim(value_key) <> ''),
	rank_value numeric not null,
	created_at timestamptz not null default now(),
	primary key (policy_key, ranking_context, value_key)
);

create table public.product_resolution_scoring_weights (
	policy_key text not null
		references public.product_resolution_policy_versions(key) on delete cascade,
	scoring_context text not null check (btrim(scoring_context) <> ''),
	metric_key text not null check (metric_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	weight numeric not null,
	created_at timestamptz not null default now(),
	primary key (policy_key, scoring_context, metric_key)
);

create table public.product_resolution_difference_thresholds (
	policy_key text not null
		references public.product_resolution_policy_versions(key) on delete cascade,
	comparison_context text not null check (
		comparison_context ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
	),
	severity text not null check (severity in ('low', 'medium', 'high')),
	minimum_difference_ratio numeric not null check (
		minimum_difference_ratio >= 0
		and minimum_difference_ratio <= 1
	),
	minimum_absolute_difference numeric not null check (
		minimum_absolute_difference >= 0
	),
	evaluation_order integer not null check (evaluation_order >= 0),
	created_at timestamptz not null default now(),
	primary key (policy_key, comparison_context, severity),
	unique (policy_key, comparison_context, evaluation_order)
);

create table public.product_resolution_ignored_terms (
	policy_key text not null
		references public.product_resolution_policy_versions(key) on delete cascade,
	term_context text not null check (term_context ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	term text not null check (term = lower(btrim(term)) and btrim(term) <> ''),
	created_at timestamptz not null default now(),
	primary key (policy_key, term_context, term)
);

create table public.product_source_field_coverage_policies (
	policy_key text not null
		references public.product_resolution_policy_versions(key) on delete cascade,
	provider_key text not null
		references public.product_data_sources(key) on delete cascade,
	reported_coverage_ttl_seconds bigint not null check (reported_coverage_ttl_seconds > 0),
	not_reported_coverage_ttl_seconds bigint not null check (
		not_reported_coverage_ttl_seconds > 0
	),
	not_found_coverage_ttl_seconds bigint not null check (
		not_found_coverage_ttl_seconds > 0
	),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (policy_key, provider_key)
);

create trigger set_product_source_field_coverage_policies_updated_at
	before update on public.product_source_field_coverage_policies
	for each row execute function public.set_updated_at();

create table public.product_source_field_coverage (
	barcode text not null check (barcode ~ '^[0-9]{14}$'),
	provider_key text not null
		references public.product_data_sources(key) on delete cascade,
	field_path text not null check (btrim(field_path) <> ''),
	coverage_status text not null check (
		coverage_status in ('reported', 'not-reported', 'not-applicable', 'product-not-found')
	),
	policy_key text not null
		references public.product_resolution_policy_versions(key) on delete restrict,
	source_reference text,
	provider_revision text,
	checked_at timestamptz not null,
	expires_at timestamptz not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (barcode, provider_key, field_path),
	constraint product_source_field_coverage_expiry_check check (expires_at > checked_at),
	constraint product_source_field_coverage_not_found_field_check check (
		coverage_status <> 'product-not-found' or field_path = 'productIdentity'
	),
	constraint product_source_field_coverage_policy_provider_fkey
		foreign key (policy_key, provider_key)
		references public.product_source_field_coverage_policies (
			policy_key,
			provider_key
		) on delete restrict
);

create trigger set_product_source_field_coverage_updated_at
	before update on public.product_source_field_coverage
	for each row execute function public.set_updated_at();

create index product_source_field_coverage_active_lookup_idx
	on public.product_source_field_coverage (
		barcode,
		provider_key,
		expires_at,
		field_path
	);

insert into public.product_resolution_policy_versions (
	key,
	version,
	display_name,
	minimum_related_name_token_overlap,
	numeric_difference_ratio_floor,
	serving_weight_tolerance_grams,
	category_suggestion_minimum_score,
	source_reference,
	reviewed_at,
	is_default,
	enabled
)
values (
	'exact-barcode-resolution-v1',
	1,
	'Exact-barcode product resolution version 1',
	0.2,
	0.001,
	0.1,
	70,
	'blendCalc exact-barcode product resolution review 2026-08-24',
	'2026-08-24T00:00:00Z'::timestamptz,
	true,
	true
);

insert into public.product_resolution_rank_values (
	policy_key,
	ranking_context,
	value_key,
	rank_value
)
values
	('exact-barcode-resolution-v1', 'field-confidence', 'unknown', 0),
	('exact-barcode-resolution-v1', 'field-confidence', 'imported', 1),
	('exact-barcode-resolution-v1', 'field-confidence', 'user-reported', 2),
	('exact-barcode-resolution-v1', 'field-confidence', 'source-verified', 3),
	('exact-barcode-resolution-v1', 'field-confidence', 'corroborated', 4),
	('exact-barcode-resolution-v1', 'field-confidence', 'moderator-reviewed', 5),
	('exact-barcode-resolution-v1', 'usda-generic-data-type', 'foundation', 0),
	('exact-barcode-resolution-v1', 'usda-generic-data-type', 'sr legacy', 1),
	('exact-barcode-resolution-v1', 'usda-generic-data-type', 'survey (fndds)', 2),
	('exact-barcode-resolution-v1', 'usda-generic-data-type', 'branded', 3);

insert into public.product_resolution_scoring_weights (
	policy_key,
	scoring_context,
	metric_key,
	weight
)
values
	('exact-barcode-resolution-v1', 'field:productName', 'text-character', 1),
	('exact-barcode-resolution-v1', 'field:brandOwner', 'text-character', 1),
	('exact-barcode-resolution-v1', 'field:image', 'primary-image', 1),
	('exact-barcode-resolution-v1', 'field:image', 'thumbnail-image', 1),
	('exact-barcode-resolution-v1', 'field:categories', 'source-item', 1),
	('exact-barcode-resolution-v1', 'field:categories', 'canonical-resolution', 10),
	('exact-barcode-resolution-v1', 'field:categories', 'canonical-value', 1),
	('exact-barcode-resolution-v1', 'field:serving', 'source-serving', 10),
	('exact-barcode-resolution-v1', 'field:serving', 'positive-weight', 1),
	('exact-barcode-resolution-v1', 'field:serving', 'display-label', 1),
	('exact-barcode-resolution-v1', 'field:serving', 'volume-equivalent', 1),
	('exact-barcode-resolution-v1', 'field:serving', 'known-origin', 1),
	('exact-barcode-resolution-v1', 'field:ingredients', 'text-character', 1),
	('exact-barcode-resolution-v1', 'field:ingredients', 'structured-item', 10),
	('exact-barcode-resolution-v1', 'field:allergens', 'source-item', 1),
	('exact-barcode-resolution-v1', 'field:traces', 'source-item', 1),
	('exact-barcode-resolution-v1', 'field:precautionaryStatements', 'source-item', 1),
	('exact-barcode-resolution-v1', 'field:dietaryTags', 'source-item', 1),
	('exact-barcode-resolution-v1', 'field:labels', 'source-item', 1),
	('exact-barcode-resolution-v1', 'field:structuredIngredients', 'source-item', 1),
	('exact-barcode-resolution-v1', 'field:ingredientAnalysis', 'populated-property', 1),
	('exact-barcode-resolution-v1', 'field:additives', 'source-item', 1),
	('exact-barcode-resolution-v1', 'field:package', 'populated-property', 1),
	('exact-barcode-resolution-v1', 'field:alcoholByVolume', 'reported-value', 1),
	('exact-barcode-resolution-v1', 'field:regulatoryDisclosure', 'profile-key', 1),
	('exact-barcode-resolution-v1', 'field:sourceMetadata', 'populated-property', 1),
	('exact-barcode-resolution-v1', 'field:nutrition', 'source-item', 1),
	('exact-barcode-resolution-v1', 'category-candidate', 'category-coverage', 70),
	('exact-barcode-resolution-v1', 'category-candidate', 'overlap-count', 18),
	('exact-barcode-resolution-v1', 'category-candidate', 'context-coverage', 10),
	('exact-barcode-resolution-v1', 'category-candidate', 'source-count', 3),
	('exact-barcode-resolution-v1', 'category-candidate', 'observation-log', 1),
	('exact-barcode-resolution-v1', 'category-candidate', 'context-contains-category', 35),
	('exact-barcode-resolution-v1', 'category-candidate', 'query-exact', 120),
	('exact-barcode-resolution-v1', 'category-candidate', 'query-starts-with', 70),
	('exact-barcode-resolution-v1', 'category-candidate', 'query-contains', 45);

insert into public.product_resolution_difference_thresholds (
	policy_key,
	comparison_context,
	severity,
	minimum_difference_ratio,
	minimum_absolute_difference,
	evaluation_order
)
values
	('exact-barcode-resolution-v1', 'catalog-submission-nutrient', 'high', 0.75, 1, 10),
	('exact-barcode-resolution-v1', 'catalog-submission-nutrient', 'medium', 0.35, 0.5, 20),
	('exact-barcode-resolution-v1', 'catalog-submission-nutrient', 'low', 0.1, 0.1, 30),
	('exact-barcode-resolution-v1', 'catalog-verification-numeric', 'high', 0.25, 0, 10),
	('exact-barcode-resolution-v1', 'catalog-verification-numeric', 'medium', 0.1, 0, 20),
	('exact-barcode-resolution-v1', 'catalog-verification-numeric', 'low', 0.03, 0, 30);

insert into public.product_resolution_ignored_terms (policy_key, term_context, term)
values
	('exact-barcode-resolution-v1', 'category-token', 'and'),
	('exact-barcode-resolution-v1', 'category-token', 'for'),
	('exact-barcode-resolution-v1', 'category-token', 'from'),
	('exact-barcode-resolution-v1', 'category-token', 'other'),
	('exact-barcode-resolution-v1', 'category-token', 'the'),
	('exact-barcode-resolution-v1', 'category-token', 'with');

insert into public.product_source_field_coverage_policies (
	policy_key,
	provider_key,
	reported_coverage_ttl_seconds,
	not_reported_coverage_ttl_seconds,
	not_found_coverage_ttl_seconds
)
values
	('exact-barcode-resolution-v1', 'usda', 2592000, 2592000, 2592000),
	('exact-barcode-resolution-v1', 'open-food-facts', 604800, 604800, 43200),
	('exact-barcode-resolution-v1', 'cola-cloud', 86400, 86400, 43200);

alter table public.nutrition_completeness_profiles
	add column assessment_policy_key text
		references public.product_resolution_policy_versions(key) on delete restrict,
	add column exact_source_score integer not null default 3 check (exact_source_score >= 0),
	add column mapped_source_score integer not null default 2 check (mapped_source_score >= 0),
	add column derived_source_score integer not null default 1 check (derived_source_score >= 0),
	add column missing_source_score integer not null default 0 check (missing_source_score >= 0),
	add column required_nutrient_weight integer not null default 4 check (required_nutrient_weight > 0),
	add column recommended_nutrient_weight integer not null default 1 check (recommended_nutrient_weight > 0),
	add column partial_minimum_ratio numeric not null default 0.6 check (
		partial_minimum_ratio >= 0 and partial_minimum_ratio <= 1
	),
	add constraint nutrition_completeness_profiles_source_score_order_check check (
		exact_source_score >= mapped_source_score
		and mapped_source_score >= derived_source_score
		and derived_source_score >= missing_source_score
	);

update public.nutrition_completeness_profiles
set assessment_policy_key = 'exact-barcode-resolution-v1'
where assessment_policy_key is null;

alter table public.nutrition_completeness_profiles
	alter column assessment_policy_key set not null;

alter table public.product_resolution_policy_versions enable row level security;
alter table public.product_resolution_policy_versions force row level security;
alter table public.product_resolution_rank_values enable row level security;
alter table public.product_resolution_rank_values force row level security;
alter table public.product_resolution_scoring_weights enable row level security;
alter table public.product_resolution_scoring_weights force row level security;
alter table public.product_resolution_difference_thresholds enable row level security;
alter table public.product_resolution_difference_thresholds force row level security;
alter table public.product_resolution_ignored_terms enable row level security;
alter table public.product_resolution_ignored_terms force row level security;
alter table public.product_source_field_coverage_policies enable row level security;
alter table public.product_source_field_coverage_policies force row level security;
alter table public.product_source_field_coverage enable row level security;
alter table public.product_source_field_coverage force row level security;

revoke all on table public.product_resolution_policy_versions from public, anon, authenticated;
revoke all on table public.product_resolution_rank_values from public, anon, authenticated;
revoke all on table public.product_resolution_scoring_weights from public, anon, authenticated;
revoke all on table public.product_resolution_difference_thresholds from public, anon, authenticated;
revoke all on table public.product_resolution_ignored_terms from public, anon, authenticated;
revoke all on table public.product_source_field_coverage_policies from public, anon, authenticated;
revoke all on table public.product_source_field_coverage from public, anon, authenticated;

grant all on table public.product_resolution_policy_versions to service_role;
grant all on table public.product_resolution_rank_values to service_role;
grant all on table public.product_resolution_scoring_weights to service_role;
grant all on table public.product_resolution_difference_thresholds to service_role;
grant all on table public.product_resolution_ignored_terms to service_role;
grant all on table public.product_source_field_coverage_policies to service_role;
grant all on table public.product_source_field_coverage to service_role;

comment on table public.product_resolution_policy_versions is
	'Reviewed, versioned thresholds shared by exact-barcode identity, comparison, ranking, completeness, and field-resolution behavior.';
comment on table public.product_source_field_coverage is
	'Expiring provider-field lookup outcomes. These rows prevent redundant lookups but never become canonical product evidence.';
