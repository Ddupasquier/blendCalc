insert into public.product_data_sources (
	key,
	display_name,
	source_type,
	homepage_url,
	terms_url,
	attribution_text,
	enabled,
	provenance
)
values
	(
		'health-canada-cnf',
		'Health Canada Canadian Nutrient File',
		'standards_api',
		'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/canadian-nutrient-file-about-us.html',
		'https://open.canada.ca/en/open-government-licence-canada',
		'Contains information licensed under the Open Government Licence – Canada.',
		true,
		jsonb_build_object('dataset_kind', 'government_food_composition')
	),
	(
		'uk-cofid',
		'UK Composition of Foods Integrated Dataset',
		'standards_api',
		'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid',
		'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
		'Contains public sector information licensed under the Open Government Licence v3.0.',
		true,
		jsonb_build_object('dataset_kind', 'government_food_composition')
	),
	(
		'fsanz-afcd',
		'Australian Food Composition Database',
		'standards_api',
		'https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd',
		'https://www.foodstandards.gov.au/science-data/monitoringnutrients/afcd/datauserlicenceagreement',
		'Food Standards Australia New Zealand, Australian Food Composition Database.',
		true,
		jsonb_build_object(
			'dataset_kind', 'government_food_composition',
			'license_requires_acceptance', true,
			'share_alike', true
		)
	)
on conflict (key) do update
set
	display_name = excluded.display_name,
	source_type = excluded.source_type,
	homepage_url = excluded.homepage_url,
	terms_url = excluded.terms_url,
	attribution_text = excluded.attribution_text,
	enabled = excluded.enabled,
	provenance = excluded.provenance;

create table public.generic_food_datasets (
	key text primary key check (btrim(key) <> ''),
	source_key text not null references public.product_data_sources(key) on delete restrict,
	display_name text not null check (btrim(display_name) <> ''),
	version text not null check (btrim(version) <> ''),
	region_code text not null check (region_code = upper(region_code) and btrim(region_code) <> ''),
	source_url text not null check (source_url ~ '^https://'),
	download_url text not null check (download_url ~ '^https://'),
	license_name text not null check (btrim(license_name) <> ''),
	license_url text not null check (license_url ~ '^https://'),
	attribution_text text not null check (btrim(attribution_text) <> ''),
	license_review_status text not null check (
		license_review_status in ('approved', 'requires_acceptance', 'blocked')
	),
	import_enabled boolean not null default false,
	active boolean not null default false,
	imported_at timestamptz,
	source_file_sha256 text check (
		source_file_sha256 is null or source_file_sha256 ~ '^[a-f0-9]{64}$'
	),
	food_count integer not null default 0 check (food_count >= 0),
	nutrient_value_count integer not null default 0 check (nutrient_value_count >= 0),
	measure_count integer not null default 0 check (measure_count >= 0),
	metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (not import_enabled or license_review_status = 'approved'),
	check (not active or import_enabled)
);

create trigger set_generic_food_datasets_updated_at
	before update on public.generic_food_datasets
	for each row execute function public.set_updated_at();

create index generic_food_datasets_active_idx
	on public.generic_food_datasets (region_code, source_key, key)
	where active and import_enabled;

create table public.generic_food_records (
	dataset_key text not null references public.generic_food_datasets(key) on delete cascade,
	source_food_key text not null check (btrim(source_food_key) <> ''),
	description text not null check (btrim(description) <> ''),
	alternate_description text,
	food_group_key text,
	food_group_name text,
	source_food_code text,
	external_reference text,
	scientific_name text,
	preparation text,
	search_text text not null check (btrim(search_text) <> ''),
	search_vector tsvector generated always as (
		to_tsvector('simple'::regconfig, search_text)
	) stored,
	source_updated_at date,
	metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (dataset_key, source_food_key)
);

create trigger set_generic_food_records_updated_at
	before update on public.generic_food_records
	for each row execute function public.set_updated_at();

create index generic_food_records_search_vector_idx
	on public.generic_food_records using gin (search_vector);

create index generic_food_records_search_trgm_idx
	on public.generic_food_records using gin (search_text gin_trgm_ops);

create index generic_food_records_group_idx
	on public.generic_food_records (dataset_key, food_group_key, source_food_key);

create table public.generic_food_nutrients (
	dataset_key text not null,
	source_food_key text not null,
	source_nutrient_key text not null check (btrim(source_nutrient_key) <> ''),
	nutrient_id bigint references public.nutrient_definitions(nutrient_id) on delete restrict,
	source_nutrient_name text not null check (btrim(source_nutrient_name) <> ''),
	unit_name text not null check (btrim(unit_name) <> ''),
	amount_per_100g numeric not null check (amount_per_100g >= 0),
	standard_error numeric check (standard_error is null or standard_error >= 0),
	observation_count numeric check (observation_count is null or observation_count >= 0),
	nutrient_source_code text,
	source_updated_at date,
	mapping_status text not null check (
		mapping_status in ('canonical', 'unmapped', 'excluded')
	),
	metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (dataset_key, source_food_key, source_nutrient_key),
	foreign key (dataset_key, source_food_key)
		references public.generic_food_records(dataset_key, source_food_key)
		on delete cascade
);

create trigger set_generic_food_nutrients_updated_at
	before update on public.generic_food_nutrients
	for each row execute function public.set_updated_at();

create index generic_food_nutrients_canonical_idx
	on public.generic_food_nutrients (
		nutrient_id,
		amount_per_100g desc,
		dataset_key,
		source_food_key
	)
	where nutrient_id is not null and mapping_status = 'canonical';

create index generic_food_nutrients_food_idx
	on public.generic_food_nutrients (
		dataset_key,
		source_food_key,
		nutrient_id,
		source_nutrient_key
	);

create index generic_food_nutrients_unmapped_idx
	on public.generic_food_nutrients (dataset_key, source_nutrient_key)
	where mapping_status = 'unmapped';

create table public.generic_food_measures (
	dataset_key text not null,
	source_food_key text not null,
	source_measure_key text not null check (btrim(source_measure_key) <> ''),
	measure_type text not null check (btrim(measure_type) <> ''),
	description text not null check (btrim(description) <> ''),
	gram_weight numeric not null check (gram_weight >= 0),
	is_household_measure boolean not null default false,
	source_updated_at date,
	metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (dataset_key, source_food_key, source_measure_key, measure_type),
	foreign key (dataset_key, source_food_key)
		references public.generic_food_records(dataset_key, source_food_key)
		on delete cascade
);

create trigger set_generic_food_measures_updated_at
	before update on public.generic_food_measures
	for each row execute function public.set_updated_at();

create index generic_food_measures_household_idx
	on public.generic_food_measures (dataset_key, source_food_key, gram_weight)
	where is_household_measure and gram_weight > 0;

insert into public.generic_food_datasets (
	key,
	source_key,
	display_name,
	version,
	region_code,
	source_url,
	download_url,
	license_name,
	license_url,
	attribution_text,
	license_review_status,
	import_enabled,
	active,
	metadata
)
values
	(
		'cnf-2026',
		'health-canada-cnf',
		'Canadian Nutrient File 2026',
		'2026',
		'CA',
		'https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109',
		'https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109/resource/019f2a90-e3a9-489d-b6e1-f74f4ba1d006/download/cnf_fcen_all-files-data_2026.zip',
		'Open Government Licence – Canada',
		'https://open.canada.ca/en/open-government-licence-canada',
		'Contains information licensed under the Open Government Licence – Canada.',
		'approved',
		true,
		false,
		jsonb_build_object('expected_food_count', 5993, 'maximum_nutrient_count', 173)
	),
	(
		'cofid-2021',
		'uk-cofid',
		'UK Composition of Foods Integrated Dataset 2021',
		'2021',
		'GB',
		'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid',
		'https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx',
		'Open Government Licence v3.0',
		'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
		'Contains public sector information licensed under the Open Government Licence v3.0.',
		'approved',
		true,
		false,
		jsonb_build_object('file_format', 'xlsx')
	),
	(
		'afcd-release-3',
		'fsanz-afcd',
		'Australian Food Composition Database Release 3',
		'Release 3',
		'AU',
		'https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/data-files',
		'https://www.foodstandards.gov.au/science-data/monitoringnutrients/afcd/datauserlicenceagreement',
		'FSANZ Data User Licence Agreement based on CC BY-SA 3.0 Australia',
		'https://www.foodstandards.gov.au/science-data/monitoringnutrients/afcd/datauserlicenceagreement',
		'Food Standards Australia New Zealand, Australian Food Composition Database.',
		'requires_acceptance',
		false,
		false,
		jsonb_build_object(
			'legal_note', 'Do not import until the click-through terms and share-alike obligations are accepted for this project.'
		)
	)
on conflict (key) do update
set
	source_key = excluded.source_key,
	display_name = excluded.display_name,
	version = excluded.version,
	region_code = excluded.region_code,
	source_url = excluded.source_url,
	download_url = excluded.download_url,
	license_name = excluded.license_name,
	license_url = excluded.license_url,
	attribution_text = excluded.attribution_text,
	license_review_status = excluded.license_review_status,
	import_enabled = excluded.import_enabled,
	metadata = excluded.metadata;

alter table public.generic_food_datasets enable row level security;
alter table public.generic_food_datasets force row level security;
alter table public.generic_food_records enable row level security;
alter table public.generic_food_records force row level security;
alter table public.generic_food_nutrients enable row level security;
alter table public.generic_food_nutrients force row level security;
alter table public.generic_food_measures enable row level security;
alter table public.generic_food_measures force row level security;

create policy "Authenticated users can read active generic food datasets"
	on public.generic_food_datasets
	for select
	to authenticated
	using (active and import_enabled);

create policy "Authenticated users can read active generic food records"
	on public.generic_food_records
	for select
	to authenticated
	using (
		exists (
			select 1
			from public.generic_food_datasets datasets
			where datasets.key = dataset_key
				and datasets.active
				and datasets.import_enabled
		)
	);

create policy "Authenticated users can read active generic food nutrients"
	on public.generic_food_nutrients
	for select
	to authenticated
	using (
		exists (
			select 1
			from public.generic_food_datasets datasets
			where datasets.key = dataset_key
				and datasets.active
				and datasets.import_enabled
		)
	);

create policy "Authenticated users can read active generic food measures"
	on public.generic_food_measures
	for select
	to authenticated
	using (
		exists (
			select 1
			from public.generic_food_datasets datasets
			where datasets.key = dataset_key
				and datasets.active
				and datasets.import_enabled
		)
	);

revoke all on table public.generic_food_datasets from public, anon, authenticated;
revoke all on table public.generic_food_records from public, anon, authenticated;
revoke all on table public.generic_food_nutrients from public, anon, authenticated;
revoke all on table public.generic_food_measures from public, anon, authenticated;

grant select on table public.generic_food_datasets to authenticated;
grant select on table public.generic_food_records to authenticated;
grant select on table public.generic_food_nutrients to authenticated;
grant select on table public.generic_food_measures to authenticated;

grant all on table public.generic_food_datasets to service_role;
grant all on table public.generic_food_records to service_role;
grant all on table public.generic_food_nutrients to service_role;
grant all on table public.generic_food_measures to service_role;
