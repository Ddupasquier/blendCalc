alter table public.app_delight_messages
	add column tone text not null default 'standard'
	check (tone in ('standard', 'cheeky'));

alter table public.app_delight_messages
	add constraint app_delight_messages_cheeky_context_check
	check (
		tone = 'standard'
		or (context_key = 'ingredients' and trigger_key = 'food-added')
		or (context_key = 'mix' and trigger_key = 'goal-progress')
		or (context_key = 'saved' and trigger_key = 'recipe-saved')
	);

alter table public.profiles
	add column cheeky_messages_enabled boolean not null default false;

insert into public.app_delight_messages (
	key,
	context_key,
	trigger_key,
	match_key,
	message,
	minimum_value,
	maximum_value,
	priority,
	tone
)
values
	('food-added-bread-cheeky', 'ingredients', 'food-added', 'bread', 'Nice buns. Nutritionally speaking.', null, null, 10, 'cheeky'),
	('food-added-hot-sauce-cheeky', 'ingredients', 'food-added', 'hot-sauce', 'Things are getting spicy.', null, null, 10, 'cheeky'),
	('food-added-soup-cheeky', 'ingredients', 'food-added', 'soup', 'Well, this is getting steamy.', null, null, 10, 'cheeky'),
	('food-added-banana-cheeky', 'ingredients', 'food-added', 'banana', 'A suspiciously suggestive source of potassium.', null, null, 10, 'cheeky'),
	('food-added-peach-cheeky', 'ingredients', 'food-added', 'peach', 'Looking peachy from every angle.', null, null, 10, 'cheeky'),
	('food-added-eggplant-cheeky', 'ingredients', 'food-added', 'eggplant', 'We acknowledge the emoji. Moving on.', null, null, 10, 'cheeky'),
	('food-added-sausage-cheeky', 'ingredients', 'food-added', 'sausage', 'Absolutely no comment.', null, null, 10, 'cheeky'),
	('food-added-nuts-cheeky', 'ingredients', 'food-added', 'nuts-seeds', 'A very respectable quantity of nuts.', null, null, 10, 'cheeky'),
	('mix-goals-all-met-cheeky', 'mix', 'goal-progress', 'all-met', 'Those macros are flirting with perfection.', null, null, 5, 'cheeky'),
	('saved-recipe-cheeky', 'saved', 'recipe-saved', null, 'Saved. You two clearly have chemistry.', null, null, 10, 'cheeky')
on conflict (key) do update
set context_key = excluded.context_key,
	trigger_key = excluded.trigger_key,
	match_key = excluded.match_key,
	message = excluded.message,
	minimum_value = excluded.minimum_value,
	maximum_value = excluded.maximum_value,
	priority = excluded.priority,
	tone = excluded.tone,
	enabled = true;

comment on column public.app_delight_messages.tone is
	'Presentation tone. Cheeky copy is available only to accounts that explicitly opt in and only in eligible non-safety contexts.';

comment on column public.profiles.cheeky_messages_enabled is
	'Whether the account opted in to occasional PG-13 delight copy. Defaults off.';
