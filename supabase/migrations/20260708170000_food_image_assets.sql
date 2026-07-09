create table if not exists public.food_image_assets (
	id uuid primary key default gen_random_uuid(),
	barcode text check (barcode is null or barcode ~ '^[0-9]{14}$'),
	shared_product_id uuid references public.shared_products(id) on delete cascade,
	source text not null
		check (source in ('open-food-facts', 'wikimedia-commons', 'community-reviewed')),
	source_reference text,
	image_role text not null
		check (image_role in ('front', 'nutrition', 'barcode', 'ingredient', 'generic')),
	image_url text not null check (image_url ~ '^https?://'),
	thumbnail_url text check (thumbnail_url is null or thumbnail_url ~ '^https?://'),
	storage_path text,
	license_name text not null,
	license_url text,
	attribution_text text,
	confidence text not null default 'imported'
		check (confidence in ('source-verified', 'moderator-reviewed', 'imported')),
	status text not null default 'active'
		check (status in ('active', 'retired')),
	fetched_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (barcode is not null or shared_product_id is not null or image_role = 'generic')
);

create index if not exists food_image_assets_active_barcode_role_idx
	on public.food_image_assets (barcode, image_role, confidence, fetched_at desc)
	where status = 'active' and barcode is not null;

create index if not exists food_image_assets_shared_product_idx
	on public.food_image_assets (shared_product_id, image_role, fetched_at desc)
	where status = 'active' and shared_product_id is not null;

create index if not exists food_image_assets_generic_role_idx
	on public.food_image_assets (image_role, confidence, fetched_at desc)
	where status = 'active' and image_role = 'generic';

create unique index if not exists food_image_assets_source_reference_role_idx
	on public.food_image_assets (source, source_reference, image_role)
	where source_reference is not null;

drop trigger if exists set_food_image_assets_updated_at on public.food_image_assets;
create trigger set_food_image_assets_updated_at
	before update on public.food_image_assets
	for each row
	execute function public.set_updated_at();

alter table public.food_image_assets enable row level security;
alter table public.food_image_assets force row level security;

drop policy if exists "Authenticated users can read active food images"
	on public.food_image_assets;
create policy "Authenticated users can read active food images"
	on public.food_image_assets
	for select
	to authenticated
	using (status = 'active');

revoke all on table public.food_image_assets from public, anon, authenticated;
grant select on table public.food_image_assets to authenticated;
grant all on table public.food_image_assets to service_role;
