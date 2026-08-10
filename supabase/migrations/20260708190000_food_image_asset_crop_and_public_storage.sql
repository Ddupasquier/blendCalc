alter table public.food_image_assets
	add column if not exists crop_x numeric not null default 50
		check (crop_x >= 0 and crop_x <= 100),
	add column if not exists crop_y numeric not null default 50
		check (crop_y >= 0 and crop_y <= 100),
	add column if not exists crop_zoom numeric not null default 1
		check (crop_zoom >= 1 and crop_zoom <= 4),
	add column if not exists crop_source text not null default 'auto'
		check (crop_source in ('auto', 'user', 'moderator')),
	add column if not exists approved_by uuid references auth.users(id) on delete set null,
	add column if not exists approved_at timestamptz;

create index if not exists food_image_assets_approved_active_idx
	on public.food_image_assets (approved_at desc, barcode, image_role)
	where status = 'active' and approved_at is not null;

insert into storage.buckets (
	id,
	name,
	public,
	file_size_limit,
	allowed_mime_types
)
values (
	'food-image-assets',
	'food-image-assets',
	true,
	8388608,
	array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
	public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read public food images"
	on storage.objects;
create policy "Anyone can read public food images"
	on storage.objects
	for select
	to anon, authenticated
	using (bucket_id = 'food-image-assets');
