create index if not exists user_food_list_items_user_list_id_idx
	on public.user_food_list_items (user_id, list_type, id);

create index if not exists saved_drinks_user_id_id_idx
	on public.saved_drinks (user_id, id);
