create table public.product_regulatory_disclosure_profiles (
	key text primary key check (btrim(key) <> ''),
	display_name text not null check (btrim(display_name) <> ''),
	user_description text not null check (btrim(user_description) <> ''),
	disclosure_kind text not null check (
		disclosure_kind in (
			'standard-nutrition',
			'regulated-alcohol',
			'permitted-sparse',
			'case-specific',
			'unknown'
		)
	),
	nutrition_evaluation_mode text not null check (
		nutrition_evaluation_mode in (
			'profile',
			'sparse-accepted',
			'case-specific',
			'unknown'
		)
	),
	nutrition_profile_key text
		references public.nutrition_completeness_profiles(key) on delete restrict,
	region_code text not null default '' check (region_code = upper(region_code)),
	authority_name text not null check (btrim(authority_name) <> ''),
	requires_alcohol_by_volume boolean not null default false,
	requires_moderator_review boolean not null default true,
	user_selectable boolean not null default true,
	source_key text not null
		references public.product_data_sources(key) on delete restrict,
	source_reference text not null check (btrim(source_reference) <> ''),
	reviewed_at timestamptz not null,
	sort_order integer not null check (sort_order >= 0),
	is_default boolean not null default false,
	enabled boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint product_regulatory_disclosure_profiles_nutrition_owner_check check (
		(
			nutrition_evaluation_mode = 'profile'
			and nutrition_profile_key is not null
		)
		or (
			nutrition_evaluation_mode <> 'profile'
			and nutrition_profile_key is null
		)
	)
);

create trigger set_product_regulatory_disclosure_profiles_updated_at
	before update on public.product_regulatory_disclosure_profiles
	for each row execute function public.set_updated_at();

create unique index product_regulatory_disclosure_profiles_default_idx
	on public.product_regulatory_disclosure_profiles (region_code)
	where is_default and enabled;

create index product_regulatory_disclosure_profiles_runtime_idx
	on public.product_regulatory_disclosure_profiles (
		region_code,
		user_selectable desc,
		sort_order,
		key
	)
	where enabled;

insert into public.product_regulatory_disclosure_profiles (
	key,
	display_name,
	user_description,
	disclosure_kind,
	nutrition_evaluation_mode,
	nutrition_profile_key,
	region_code,
	authority_name,
	requires_alcohol_by_volume,
	requires_moderator_review,
	user_selectable,
	source_key,
	source_reference,
	reviewed_at,
	sort_order,
	is_default,
	enabled
)
values
	(
		'unknown-label-context-v1',
		'Not sure which label applies',
		'Keep omitted nutrition unknown until the package disclosure is confirmed.',
		'unknown',
		'unknown',
		null,
		'',
		'blendCalc policy',
		false,
		true,
		true,
		'blendcalc-nutrition-policy',
		'blendCalc regulatory disclosure policy version 1',
		'2026-08-14T00:00:00Z'::timestamptz,
		90,
		true,
		true
	),
	(
		'us-standard-nutrition-facts-v1',
		'Standard Nutrition Facts',
		'The package uses the standard U.S. Nutrition Facts disclosure.',
		'standard-nutrition',
		'profile',
		'us-packaged-label-v1',
		'US',
		'U.S. Food and Drug Administration',
		false,
		false,
		true,
		'fda-nutrition-facts',
		'https://www.fda.gov/food/nutrition-facts-label/how-understand-and-use-nutrition-facts-label',
		'2026-08-14T00:00:00Z'::timestamptz,
		10,
		true,
		true
	),
	(
		'us-ttb-alcohol-beverage-v1',
		'Alcohol beverage label',
		'The package is reviewed under U.S. alcohol-beverage labeling rather than assumed to use an ordinary Nutrition Facts panel.',
		'regulated-alcohol',
		'sparse-accepted',
		null,
		'US',
		'U.S. Alcohol and Tobacco Tax and Trade Bureau',
		true,
		true,
		true,
		'blendcalc-nutrition-policy',
		'https://www.ttb.gov/regulated-commodities/beverage-alcohol/wine/labeling-wine/alcohol-beverage-labeling',
		'2026-08-14T00:00:00Z'::timestamptz,
		20,
		false,
		true
	),
	(
		'us-ttb-kombucha-case-specific-v1',
		'Kombucha label',
		'Kombucha labeling depends on alcohol content and formulation, so missing nutrition remains unknown until review.',
		'case-specific',
		'case-specific',
		null,
		'US',
		'U.S. Alcohol and Tobacco Tax and Trade Bureau',
		false,
		true,
		true,
		'blendcalc-nutrition-policy',
		'https://www.ttb.gov/regulated-commodities/beverage-alcohol/kombucha/labeling',
		'2026-08-14T00:00:00Z'::timestamptz,
		30,
		false,
		true
	),
	(
		'us-permitted-sparse-label-v1',
		'Package omits standard nutrition',
		'The package may qualify for a U.S. nutrition-labeling exception; review is required before treating omissions as expected.',
		'permitted-sparse',
		'sparse-accepted',
		null,
		'US',
		'U.S. Food and Drug Administration',
		false,
		true,
		true,
		'blendcalc-nutrition-policy',
		'https://www.fda.gov/food/labeling-nutrition-guidance-documents-regulatory-information/small-business-nutrition-labeling-exemption',
		'2026-08-14T00:00:00Z'::timestamptz,
		40,
		false,
		true
	);

create or replace function public.food_alcohol_disclosure_is_valid(p_food jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_alcohol jsonb;
	v_disclosure jsonb;
	v_percent numeric;
	v_status text;
begin
	if p_food is null or jsonb_typeof(p_food) <> 'object' then
		return false;
	end if;

	v_alcohol := p_food -> 'alcoholByVolume';
	if v_alcohol is not null then
		if jsonb_typeof(v_alcohol) <> 'object'
			or jsonb_typeof(v_alcohol -> 'percent') <> 'number'
			or v_alcohol ->> 'basis' <> 'volume-percent'
			or nullif(btrim(v_alcohol ->> 'sourceUnit'), '') is null
		then
			return false;
		end if;

		v_percent := (v_alcohol ->> 'percent')::numeric;
		v_status := v_alcohol ->> 'valueStatus';
		if v_percent < 0 or v_percent > 100
			or v_status not in ('reported', 'reported-zero')
			or (v_status = 'reported-zero' and v_percent <> 0)
			or (v_status = 'reported' and v_percent = 0)
		then
			return false;
		end if;
	end if;

	v_disclosure := p_food -> 'regulatoryDisclosure';
	if v_disclosure is not null and (
		jsonb_typeof(v_disclosure) <> 'object'
		or nullif(btrim(v_disclosure ->> 'profileKey'), '') is null
		or v_disclosure ->> 'evidenceStatus' not in (
			'source-reported',
			'user-reported',
			'moderator-reviewed'
		)
	) then
		return false;
	end if;

	return true;
exception
	when invalid_text_representation or numeric_value_out_of_range then
		return false;
end;
$$;

create or replace function public.validate_food_regulatory_disclosure_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_profile_key text;
begin
	v_profile_key := nullif(btrim(new.food #>> '{regulatoryDisclosure,profileKey}'), '');
	if v_profile_key is not null and not exists (
		select 1
		from public.product_regulatory_disclosure_profiles profile
		where profile.key = v_profile_key
	) then
		raise exception 'Unknown regulatory disclosure profile %', v_profile_key;
	end if;
	return new;
end;
$$;

alter table public.shared_product_submissions
	add constraint shared_product_submissions_alcohol_disclosure_check
	check (public.food_alcohol_disclosure_is_valid(food)) not valid;

alter table public.shared_products
	add constraint shared_products_alcohol_disclosure_check
	check (public.food_alcohol_disclosure_is_valid(food)) not valid;

alter table public.shared_product_revisions
	add constraint shared_product_revisions_alcohol_disclosure_check
	check (public.food_alcohol_disclosure_is_valid(food)) not valid;

alter table public.shared_product_submissions
	validate constraint shared_product_submissions_alcohol_disclosure_check;
alter table public.shared_products
	validate constraint shared_products_alcohol_disclosure_check;
alter table public.shared_product_revisions
	validate constraint shared_product_revisions_alcohol_disclosure_check;

create trigger validate_shared_product_submission_disclosure_profile
	before insert or update of food on public.shared_product_submissions
	for each row execute function public.validate_food_regulatory_disclosure_profile();

create trigger validate_shared_product_disclosure_profile
	before insert or update of food on public.shared_products
	for each row execute function public.validate_food_regulatory_disclosure_profile();

create trigger validate_shared_product_revision_disclosure_profile
	before insert or update of food on public.shared_product_revisions
	for each row execute function public.validate_food_regulatory_disclosure_profile();

create index shared_products_regulatory_disclosure_profile_idx
	on public.shared_products ((food #>> '{regulatoryDisclosure,profileKey}'))
	where food ? 'regulatoryDisclosure';

create index shared_products_alcohol_by_volume_idx
	on public.shared_products (((food #>> '{alcoholByVolume,percent}')::numeric))
	where food ? 'alcoholByVolume';

alter table public.product_regulatory_disclosure_profiles enable row level security;
alter table public.product_regulatory_disclosure_profiles force row level security;

revoke all on table public.product_regulatory_disclosure_profiles
	from public, anon, authenticated;
grant select on table public.product_regulatory_disclosure_profiles to authenticated;
grant all on table public.product_regulatory_disclosure_profiles to service_role;

create policy product_regulatory_disclosure_profiles_authenticated_read
	on public.product_regulatory_disclosure_profiles
	for select
	to authenticated
	using (enabled);

comment on table public.product_regulatory_disclosure_profiles is
	'Versioned, reviewed label-disclosure contexts used to evaluate sparse product nutrition without name or category inference.';
comment on function public.food_alcohol_disclosure_is_valid(jsonb) is
	'Validates explicit ABV and regulatory-disclosure JSON while preserving missing values as absent rather than zero.';
