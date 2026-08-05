begin;

select plan(6);

select has_column(
	'public',
	'mix_preferences',
	'section_order',
	'Mix preferences store a section order'
);

select ok(
	not has_table_privilege('authenticated', 'public.mix_preferences', 'UPDATE'),
	'authenticated users cannot bypass authoritative Mix preference writes'
);

select ok(
	has_function_privilege(
		'authenticated',
		'public.save_mix_section_order(text[])',
		'EXECUTE'
	),
	'authenticated users can save a validated Mix section order'
);

insert into auth.users (id, aud, role, email)
values (
	'73000000-0000-4000-8000-000000000008',
	'authenticated',
	'authenticated',
	'mix-section-order@blendcalc.local'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"73000000-0000-4000-8000-000000000008","role":"authenticated","app_role":"user"}',
	true
);

select is(
	public.save_mix_section_order(array[
		'goals',
		'nutrient-shape',
		'selected-ingredients',
		'add-ingredients',
		'warnings',
		'suggested-adjustments',
		'nutrient-contributions'
	]::text[]),
	true,
	'a complete supported order saves successfully'
);

select is(
	(
		select section_order::text
		from public.mix_preferences
		where user_id = auth.uid()
	),
	'{goals,nutrient-shape,selected-ingredients,add-ingredients,warnings,suggested-adjustments,nutrient-contributions}',
	'the selected order is stored exactly'
);

select throws_ok(
	$$
		select public.save_mix_section_order(array[
			'goals',
			'goals',
			'selected-ingredients',
			'add-ingredients',
			'warnings',
			'suggested-adjustments',
			'nutrient-contributions'
		]::text[])
	$$,
	'22023',
	'Mix section order must contain every supported section exactly once.',
	'duplicate or incomplete section orders are rejected'
);

select * from finish();

rollback;
