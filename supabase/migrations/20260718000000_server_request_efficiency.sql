alter table public.product_api_cache
	drop constraint if exists product_api_cache_provider_check,
	drop constraint if exists product_api_cache_request_kind_check;

alter table public.product_api_cache
	add constraint product_api_cache_provider_check
		check (provider ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	add constraint product_api_cache_request_kind_check
		check (request_kind ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

drop index if exists public.food_image_assets_source_reference_role_idx;

create unique index food_image_assets_source_reference_role_idx
	on public.food_image_assets (source, source_reference, image_role);
