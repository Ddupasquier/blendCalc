create table public.ingredient_source_options (
	value text primary key check (btrim(value) <> ''),
	filter_label text not null check (btrim(filter_label) <> ''),
	badge_label text check (badge_label is null or btrim(badge_label) <> ''),
	display_order integer not null check (display_order >= 0),
	filter_enabled boolean not null default true,
	badge_enabled boolean not null default true,
	description text not null default '' check (btrim(description) <> '' or description = ''),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create unique index ingredient_source_options_display_order_idx
	on public.ingredient_source_options (display_order);

create index ingredient_source_options_filter_enabled_idx
	on public.ingredient_source_options (filter_enabled, display_order)
	where filter_enabled is true;

create index ingredient_source_options_badge_enabled_idx
	on public.ingredient_source_options (badge_enabled, value)
	where badge_enabled is true;

insert into public.ingredient_source_options (
	value,
	filter_label,
	badge_label,
	display_order,
	filter_enabled,
	badge_enabled,
	description
)
values
	(
		'all',
		'All sources',
		null,
		0,
		true,
		false,
		'Filter option that includes every saved ingredient source.'
	),
	(
		'fdc',
		'USDA FDC',
		'FDC',
		10,
		true,
		true,
		'Foods sourced from USDA FoodData Central or USDA-backed lookup paths.'
	),
	(
		'shared',
		'Shared & verified',
		'Shared',
		20,
		true,
		true,
		'Foods from the reviewed shared product catalog.'
	),
	(
		'custom',
		'Custom',
		'Custom',
		30,
		true,
		true,
		'Foods manually created by the current user.'
	);

create trigger set_ingredient_source_options_updated_at
	before update on public.ingredient_source_options
	for each row execute function public.set_updated_at();

alter table public.ingredient_source_options enable row level security;
alter table public.ingredient_source_options force row level security;

create policy "Authenticated users can read ingredient source options"
	on public.ingredient_source_options
	for select
	to authenticated
	using (true);

revoke all on table public.ingredient_source_options
	from public, anon, authenticated;
grant select on table public.ingredient_source_options to authenticated;
grant all on table public.ingredient_source_options to service_role;
