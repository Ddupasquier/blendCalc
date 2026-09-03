begin;

select plan(2);

select is(
	(
		select title
		from public.nutrient_manual_entry_groups
		where id = 'required-basics'
	),
	'Core nutrition',
	'the standard nutrient group uses a neutral title'
);

select ok(
	exists (
		select 1
		from public.nutrient_manual_entry_required_nutrients
		where group_id = 'required-basics'
			and enabled
	),
	'the database still owns which core nutrients are required for sharing'
);

select * from finish();

rollback;
