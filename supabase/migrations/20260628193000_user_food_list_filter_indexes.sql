create extension if not exists pg_trgm with schema extensions;

create index if not exists user_food_list_items_user_list_created_idx
	on public.user_food_list_items (user_id, list_type, created_at desc, id desc);

create index if not exists user_food_list_items_user_list_description_idx
	on public.user_food_list_items (user_id, list_type, (food ->> 'description'), id);

create index if not exists user_food_list_items_description_trgm_idx
	on public.user_food_list_items using gin ((food ->> 'description') gin_trgm_ops);

create index if not exists user_food_list_items_brand_owner_trgm_idx
	on public.user_food_list_items using gin ((food ->> 'brandOwner') gin_trgm_ops);

create index if not exists user_food_list_items_food_category_trgm_idx
	on public.user_food_list_items using gin ((food ->> 'foodCategory') gin_trgm_ops);

create index if not exists user_food_list_items_custom_source_idx
	on public.user_food_list_items (user_id, list_type, created_at desc, id desc)
	where food ->> 'customFood' = 'true';

create index if not exists user_food_list_items_shared_source_idx
	on public.user_food_list_items (user_id, list_type, created_at desc, id desc)
	where nullif(food ->> 'sharedProductId', '') is not null;

create index if not exists user_food_list_items_fdc_source_idx
	on public.user_food_list_items (user_id, list_type, created_at desc, id desc)
	where coalesce(food ->> 'customFood', 'false') = 'false'
		and nullif(food ->> 'sharedProductId', '') is null;
