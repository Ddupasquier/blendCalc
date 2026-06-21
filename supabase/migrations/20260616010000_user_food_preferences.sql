create table public.user_food_preferences (
	user_id uuid primary key references auth.users(id) on delete cascade,
	unit_system text check (unit_system is null or unit_system in ('metric', 'us')),
	food_preferences text[] not null default '{}'::text[],
	allergens text[] not null default '{}'::text[],
	dietary_restrictions text[] not null default '{}'::text[],
	ingredients_to_avoid text[] not null default '{}'::text[],
	prioritized_nutrient_ids integer[] not null default '{}'::integer[],
	default_smoothie_serving_grams numeric(8, 2)
		check (
			default_smoothie_serving_grams is null
			or default_smoothie_serving_grams > 0
		),
	sensitive_acknowledged_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (
		array_length(food_preferences, 1) is null
		or array_length(food_preferences, 1) <= 30
	),
	check (
		array_length(allergens, 1) is null
		or array_length(allergens, 1) <= 30
	),
	check (
		array_length(dietary_restrictions, 1) is null
		or array_length(dietary_restrictions, 1) <= 30
	),
	check (
		array_length(ingredients_to_avoid, 1) is null
		or array_length(ingredients_to_avoid, 1) <= 50
	),
	check (
		array_length(prioritized_nutrient_ids, 1) is null
		or array_length(prioritized_nutrient_ids, 1) <= 30
	)
);

create trigger set_user_food_preferences_updated_at
	before update on public.user_food_preferences
	for each row execute function public.set_updated_at();

alter table public.user_food_preferences enable row level security;

create policy "Users can read their food preferences"
	on public.user_food_preferences
	for select
	to authenticated
	using (user_id = (select auth.uid()));

create policy "Users can create their food preferences"
	on public.user_food_preferences
	for insert
	to authenticated
	with check (user_id = (select auth.uid()));

create policy "Users can update their food preferences"
	on public.user_food_preferences
	for update
	to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

create policy "Users can delete their food preferences"
	on public.user_food_preferences
	for delete
	to authenticated
	using (user_id = (select auth.uid()));

revoke all on table public.user_food_preferences from anon;
grant select, insert, update, delete on table public.user_food_preferences to authenticated;
