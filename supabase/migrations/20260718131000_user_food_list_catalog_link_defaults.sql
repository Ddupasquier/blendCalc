alter table public.user_food_list_items
	alter column source_key set default 'custom',
	alter column trust_status set default 'user-private';
