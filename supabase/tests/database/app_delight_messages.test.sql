begin;

select plan(15);

select ok(
	(select count(*) from public.app_delight_messages where enabled) >= 20,
	'the broad-audience delight catalog has a useful initial set'
);

select ok(
	not exists (
		select 1
		from public.app_delight_messages
		where btrim(message) = ''
			or char_length(message) > 120
	),
	'every delight message is concise and nonempty'
);

select ok(
	not exists (
		select 1
		from public.app_delight_messages
		where minimum_value is not null
			and maximum_value is not null
			and minimum_value > maximum_value
	),
	'numeric trigger boundaries are valid'
);

select ok(
	not exists (
		select 1
		from public.app_delight_messages
		where tone not in ('standard', 'cheeky')
	),
	'every delight row has a supported tone'
);

select ok(
	(select count(*) from public.app_delight_messages where tone = 'cheeky' and enabled) >= 10,
	'the opt-in cheeky catalog contains the reviewed initial set'
);

select ok(
	not exists (
		select 1
		from public.app_delight_messages
		where tone = 'cheeky'
			and not (
				(context_key = 'ingredients' and trigger_key = 'food-added')
				or (context_key = 'mix' and trigger_key = 'goal-progress')
				or (context_key = 'saved' and trigger_key = 'recipe-saved')
			)
	),
	'cheeky copy is restricted to eligible non-safety success triggers'
);

select ok(
	not exists (
		select 1
		from public.app_delight_messages
		where tone = 'cheeky'
			and match_key in ('beer', 'wine', 'spirits', 'cocktail', 'alcoholic-beverage')
	),
	'the cheeky catalog does not target alcohol products'
);

select is(
	(
		select column_default
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'profiles'
			and column_name = 'cheeky_messages_enabled'
	),
	'false',
	'the account preference defaults off'
);

select ok(
	not exists (
		select 1
		from public.app_delight_messages
		where lower(message) ~ '(sudo|merge conflict|working tree|o\(nom|gtin there|cache me outside)'
	),
	'the initial catalog excludes niche developer references'
);

select is(
	(select message from public.app_delight_messages where key = 'food-added-eggs'),
	'Eggcellent choice.',
	'food-specific copy is stored as reviewed reference data'
);

select is(
	(select message from public.app_delight_messages where key = 'food-added-cake'),
	'The cake may be a lie. Dessert is not.',
	'the catalog includes one broadly recognizable gamer reference without technical jargon'
);

select ok(
	(select relrowsecurity from pg_class where oid = 'public.app_delight_messages'::regclass),
	'row-level security is enabled'
);

select ok(
	(select relforcerowsecurity from pg_class where oid = 'public.app_delight_messages'::regclass),
	'row-level security is forced'
);

select ok(
	exists (
		select 1
		from pg_policies
		where schemaname = 'public'
			and tablename = 'app_delight_messages'
			and roles = array['authenticated']::name[]
			and cmd = 'SELECT'
			and qual like '%enabled%'
	),
	'authenticated reads are restricted to enabled messages'
);

select ok(
	has_table_privilege('authenticated', 'public.app_delight_messages', 'select')
		and not has_table_privilege('anon', 'public.app_delight_messages', 'select'),
	'only authenticated application users can read enabled delight copy'
);

select * from finish();
rollback;
