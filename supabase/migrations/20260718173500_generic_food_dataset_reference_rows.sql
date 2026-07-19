create table public.generic_food_dataset_reference_rows (
	dataset_key text not null references public.generic_food_datasets(key) on delete cascade,
	reference_type text not null check (btrim(reference_type) <> ''),
	source_key text not null check (btrim(source_key) <> ''),
	payload jsonb not null check (jsonb_typeof(payload) = 'object'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (dataset_key, reference_type, source_key)
);

create trigger set_generic_food_dataset_reference_rows_updated_at
	before update on public.generic_food_dataset_reference_rows
	for each row execute function public.set_updated_at();

create index generic_food_dataset_reference_rows_lookup_idx
	on public.generic_food_dataset_reference_rows (
		dataset_key,
		reference_type,
		source_key
	);

alter table public.generic_food_dataset_reference_rows enable row level security;
alter table public.generic_food_dataset_reference_rows force row level security;

create policy "Authenticated users can read active generic food reference rows"
	on public.generic_food_dataset_reference_rows
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

revoke all on table public.generic_food_dataset_reference_rows from public, anon, authenticated;
grant select on table public.generic_food_dataset_reference_rows to authenticated;
grant all on table public.generic_food_dataset_reference_rows to service_role;
