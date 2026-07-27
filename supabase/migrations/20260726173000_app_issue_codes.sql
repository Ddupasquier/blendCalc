create table public.app_issue_codes (
	code text primary key check (code ~ '^[A-Z][A-Z0-9_]*$'),
	kind text not null check (kind in ('error', 'warning')),
	domain text not null check (btrim(domain) <> ''),
	description text not null check (btrim(description) <> ''),
	enabled boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

comment on table public.app_issue_codes is
	'Stable machine-readable application issue codes. User-facing wording belongs in the versioned application message catalog, never in this table.';
comment on column public.app_issue_codes.description is
	'Developer-facing contract description; this text must not be rendered as UI copy.';

create trigger set_app_issue_codes_updated_at
	before update on public.app_issue_codes
	for each row execute function public.set_updated_at();

insert into public.app_issue_codes (code, kind, domain, description)
values
	('AUTH_REQUIRED', 'error', 'auth', 'The operation requires an authenticated user.'),
	('ACCESS_DENIED', 'error', 'auth', 'The authenticated user cannot perform the operation.'),
	('INVALID_REQUEST', 'error', 'request', 'The request payload or parameters are invalid.'),
	('ROUTE_NOT_FOUND', 'error', 'routing', 'The requested application route does not exist.'),
	('RESOURCE_NOT_FOUND', 'error', 'request', 'The requested application resource does not exist.'),
	('SERVICE_UNAVAILABLE', 'error', 'system', 'A required application service is temporarily unavailable.'),
	('UNEXPECTED_ERROR', 'error', 'system', 'An unexpected application failure occurred.'),
	('MODERATION_DATA_UNAVAILABLE', 'error', 'moderation', 'Required moderation data could not be read.'),
	('MODERATION_SELF_ACTION_FORBIDDEN', 'error', 'moderation', 'A moderator attempted a restricted action on their own account.'),
	('MODERATION_TARGET_NOT_FOUND', 'error', 'moderation', 'The moderation target does not exist.'),
	('MODERATION_TARGET_FORBIDDEN', 'error', 'moderation', 'The actor role cannot moderate the target role.'),
	('SEARCH_PAGINATION_INVALID', 'error', 'search', 'Search pagination parameters are outside supported bounds.'),
	('SEARCH_QUERY_TOO_LONG', 'error', 'search', 'The search query exceeds the supported length.'),
	('SEARCH_FILTER_INVALID', 'error', 'search', 'A search filter value is unsupported.'),
	('FOOD_SEARCH_UNAVAILABLE', 'error', 'search', 'All required food-search sources are unavailable.'),
	('INVALID_BARCODE', 'error', 'catalog', 'The supplied barcode is not a valid normalized GTIN.'),
	('PRODUCT_NOT_FOUND', 'error', 'catalog', 'No matching product could be found.'),
	('PRODUCT_NAME_REQUIRED', 'error', 'catalog', 'A product name is required for the operation.'),
	('PRODUCT_NAME_CONFLICT', 'warning', 'catalog', 'A supplied product name conflicts with the product resolved for its barcode.'),
	('CATEGORY_REQUIRED', 'warning', 'catalog', 'A canonical category must be selected before continuing.'),
	('IMAGE_PLACEMENT_INVALID', 'error', 'images', 'Image placement data is invalid or unsupported.'),
	('IMAGE_NOT_FOUND', 'error', 'images', 'The requested product image does not exist.'),
	('IMAGE_PLACEMENT_SAVE_UNCONFIRMED', 'error', 'images', 'An image placement write could not be confirmed.'),
	('CATALOG_VALIDATION_UNAVAILABLE', 'error', 'catalog', 'Catalog submission eligibility could not be evaluated.'),
	('CATALOG_SUBMISSION_INVALID', 'error', 'catalog', 'Catalog submission product data is invalid.'),
	('CATALOG_CONSENT_REQUIRED', 'error', 'catalog', 'Catalog sharing consent is required.'),
	('CATALOG_REVIEW_FLAGS_INVALID', 'error', 'catalog', 'Catalog review flags are invalid.'),
	('CATALOG_SUBMISSION_BLOCKED', 'error', 'catalog', 'Catalog submissions are temporarily blocked for an account.'),
	('CATALOG_SUBMISSION_FAILED', 'error', 'catalog', 'Catalog submission persistence failed.'),
	('TUTORIAL_CHOICE_INVALID', 'error', 'tutorial', 'The submitted tutorial choice is unsupported.'),
	('TUTORIAL_SAVE_FAILED', 'error', 'tutorial', 'The tutorial choice could not be persisted.'),
	('NUTRIENT_CHILD_EXCEEDS_PARENT', 'warning', 'nutrition', 'A child nutrient exceeds its configured parent nutrient.'),
	('FOOD_ALLERGEN_CONTAINS', 'warning', 'compatibility', 'A product explicitly reports a selected allergen.'),
	('FOOD_ALLERGEN_MAY_CONTAIN', 'warning', 'compatibility', 'A product reports a possible trace of a selected allergen.'),
	('FOOD_INGREDIENT_PRESENT', 'warning', 'compatibility', 'A compatibility fact is present in structured ingredients.'),
	('FOOD_IDENTITY_CONFIRMED', 'warning', 'compatibility', 'The source identity confirms a compatibility fact.'),
	('FOOD_IDENTITY_POSSIBLE', 'warning', 'compatibility', 'The source identity suggests a possible compatibility fact.'),
	('FOOD_RESTRICTION_CONFLICT', 'warning', 'compatibility', 'A selected dietary restriction conflicts with structured product evidence.');

alter table public.app_issue_codes enable row level security;
alter table public.app_issue_codes force row level security;

revoke all on table public.app_issue_codes from public, anon, authenticated;
grant all on table public.app_issue_codes to service_role;

alter table public.compatibility_rule_conflicts
	add column warning_code text;

update public.compatibility_rule_conflicts
set warning_code = 'FOOD_RESTRICTION_CONFLICT';

alter table public.compatibility_rule_conflicts
	alter column warning_code set not null,
	add constraint compatibility_rule_conflicts_warning_code_fkey
		foreign key (warning_code)
		references public.app_issue_codes(code);

alter table public.nutrient_relationship_rules
	add column issue_code text;

update public.nutrient_relationship_rules
set issue_code = 'NUTRIENT_CHILD_EXCEEDS_PARENT';

alter table public.nutrient_relationship_rules
	alter column issue_code set not null,
	add constraint nutrient_relationship_rules_issue_code_fkey
		foreign key (issue_code)
		references public.app_issue_codes(code),
	drop column message;
