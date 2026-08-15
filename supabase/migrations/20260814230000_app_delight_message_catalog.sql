create table public.app_delight_messages (
	key text primary key check (key ~ '^[a-z][a-z0-9-]*$'),
	context_key text not null check (context_key in ('app', 'ingredients', 'mix', 'saved')),
	trigger_key text not null check (trigger_key ~ '^[a-z][a-z0-9-]*$'),
	match_key text check (match_key is null or match_key ~ '^[a-z][a-z0-9-]*$'),
	message text not null check (btrim(message) <> '' and char_length(message) <= 120),
	minimum_value numeric check (minimum_value is null or minimum_value >= 0),
	maximum_value numeric check (maximum_value is null or maximum_value >= 0),
	priority integer not null default 100 check (priority between 1 and 1000),
	enabled boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (
		minimum_value is null
		or maximum_value is null
		or minimum_value <= maximum_value
	)
);

create index app_delight_messages_enabled_trigger_idx
	on public.app_delight_messages (context_key, trigger_key, priority, key)
	where enabled;

create trigger set_app_delight_messages_updated_at
	before update on public.app_delight_messages
	for each row execute function public.set_updated_at();

insert into public.app_delight_messages (
	key,
	context_key,
	trigger_key,
	match_key,
	message,
	minimum_value,
	maximum_value,
	priority
)
values
	('empty-fridge-meal-prep', 'ingredients', 'empty-list', 'fridge', 'Your fridge skipped meal-prep day.', null, null, 100),
	('food-added-eggs', 'ingredients', 'food-added', 'eggs', 'Eggcellent choice.', null, null, 100),
	('food-added-cheese', 'ingredients', 'food-added', 'cheese', 'Looking gouda.', null, null, 100),
	('food-added-pasta', 'ingredients', 'food-added', 'pasta', 'Pasta point of no return.', null, null, 100),
	('food-added-bread', 'ingredients', 'food-added', 'bread', 'You’re on a roll.', null, null, 100),
	('food-added-cake', 'ingredients', 'food-added', 'cake', 'The cake may be a lie. Dessert is not.', null, null, 100),
	('food-added-taco', 'ingredients', 'food-added', 'taco', 'Let’s taco ’bout these macros.', null, null, 100),
	('food-added-mushrooms', 'ingredients', 'food-added', 'mushrooms', 'Still room for one more.', null, null, 100),
	('food-added-peas', 'ingredients', 'food-added', 'peas', 'Give peas a chance.', null, null, 100),
	('food-added-lettuce', 'ingredients', 'food-added', 'lettuce', 'Lettuce handle the heavy lifting.', null, null, 100),
	('food-added-kombucha', 'ingredients', 'food-added', 'kombucha', 'Culture acquired.', null, null, 100),
	('food-added-beer', 'ingredients', 'food-added', 'beer', 'Proof that liquids have stats too.', null, null, 100),
	('food-added-wine', 'ingredients', 'food-added', 'wine', 'Proof that liquids have stats too.', null, null, 100),
	('food-added-spirits', 'ingredients', 'food-added', 'spirits', 'Proof that liquids have stats too.', null, null, 100),
	('food-added-cocktail', 'ingredients', 'food-added', 'cocktail', 'Proof that liquids have stats too.', null, null, 100),
	('food-added-alcohol', 'ingredients', 'food-added', 'alcoholic-beverage', 'Proof that liquids have stats too.', null, null, 100),
	('food-added-poop', 'ingredients', 'food-added', 'poop', 'A bold nutritional strategy.', null, null, 10),
	('mix-water-only', 'mix', 'recipe-composition', 'water-only', 'Premium artisanal hydration.', null, null, 5),
	('mix-ice-only', 'mix', 'recipe-composition', 'ice-only', 'Water, but with structure.', null, null, 5),
	('mix-goals-all-met', 'mix', 'goal-progress', 'all-met', 'Achievement unlocked: numerically delicious.', null, null, 10),
	('mix-goals-balanced', 'mix', 'goal-progress', 'balanced', 'Macros understood the assignment.', null, null, 20),
	('mix-protein-over', 'mix', 'goal-progress', 'protein-far-over', 'Do you even blend, bro?', null, null, 30),
	('mix-protein-met', 'mix', 'goal-progress', 'protein-met', 'Whey to go.', null, null, 40),
	('mix-fiber-low', 'mix', 'goal-progress', 'fiber-low', 'Your gut could use a spotter.', null, null, 50),
	('mix-carbs-high', 'mix', 'goal-progress', 'carbs-high', 'Carb loading like tomorrow is race day.', null, null, 50),
	('mix-sodium-high', 'mix', 'goal-progress', 'sodium-high', 'This recipe is feeling a little salty.', null, null, 50),
	('mix-serving-bulk', 'mix', 'total-serving-grams', null, 'Entering bulk mode.', 500, null, 80),
	('mix-serving-warmup', 'mix', 'total-serving-grams', null, 'That’s a warm-up set.', 0, 30, 90);

alter table public.app_delight_messages enable row level security;
alter table public.app_delight_messages force row level security;

create policy "Authenticated users can read enabled delight messages"
	on public.app_delight_messages
	for select
	to authenticated
	using (enabled);

revoke all on table public.app_delight_messages from public, anon, authenticated;
grant select on table public.app_delight_messages to authenticated;
grant all on table public.app_delight_messages to service_role;

comment on table public.app_delight_messages is
	'Optional broad-audience secondary copy. It never replaces safety, authentication, validation, or failure instructions.';

comment on column public.app_delight_messages.match_key is
	'A reviewed semantic state or food-symbol key emitted by application trigger logic; null applies to every matching trigger.';

comment on column public.app_delight_messages.minimum_value is
	'Optional inclusive lower numeric boundary supplied by the trigger context.';

comment on column public.app_delight_messages.maximum_value is
	'Optional inclusive upper numeric boundary supplied by the trigger context.';
