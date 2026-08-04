begin;

select plan(8);

select has_column(
	'public',
	'mix_preferences',
	'section_disclosure_state',
	'Mix preferences store section disclosure state'
);

select ok(
	not has_table_privilege('authenticated', 'public.mix_preferences', 'UPDATE'),
	'authenticated users cannot bypass authoritative Mix preference writes'
);

select ok(
	has_function_privilege(
		'authenticated',
		'public.save_mix_section_disclosure_state(jsonb)',
		'EXECUTE'
	),
	'authenticated users can save validated Mix disclosure state'
);

insert into auth.users (id, aud, role, email)
values (
	'73000000-0000-4000-8000-000000000009',
	'authenticated',
	'authenticated',
	'mix-section-disclosure@blendcalc.local'
);

insert into public.mix_preferences (user_id)
values ('73000000-0000-4000-8000-000000000009');

select ok(
	(select not (section_disclosure_state ->> 'warnings')::boolean
		and not (section_disclosure_state ->> 'suggested-adjustments')::boolean
		and not (section_disclosure_state ->> 'nutrient-contributions')::boolean
	from public.mix_preferences
	where user_id = '73000000-0000-4000-8000-000000000009'),
	'new Mix preferences begin with supporting insight sections closed'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"73000000-0000-4000-8000-000000000009","role":"authenticated","app_role":"user"}',
	true
);

select is(
	public.save_mix_section_disclosure_state(jsonb_build_object(
		'nutrient-shape', true,
		'goals', false,
		'selected-ingredients', true,
		'add-ingredients', true,
		'warnings', false,
		'suggested-adjustments', false,
		'nutrient-contributions', true
	)),
	true,
	'a complete supported disclosure state saves successfully'
);

select is(
	(
		select section_disclosure_state ->> 'goals'
		from public.mix_preferences
		where user_id = auth.uid()
	),
	'false',
	'the selected disclosure state is stored exactly'
);

select throws_ok(
	$$
		select public.save_mix_section_disclosure_state(jsonb_build_object(
			'nutrient-shape', true,
			'goals', false,
			'selected-ingredients', true,
			'add-ingredients', true,
			'warnings', false,
			'suggested-adjustments', false
		))
	$$,
	'22023',
	'Mix section disclosure state must contain one boolean for every supported section.',
	'incomplete disclosure state is rejected'
);

select throws_ok(
	$$
		select public.save_mix_section_disclosure_state(jsonb_build_object(
			'nutrient-shape', true,
			'goals', 'closed',
			'selected-ingredients', true,
			'add-ingredients', true,
			'warnings', false,
			'suggested-adjustments', false,
			'nutrient-contributions', true
		))
	$$,
	'22023',
	'Mix section disclosure state must contain one boolean for every supported section.',
	'non-boolean disclosure state is rejected'
);

select * from finish();

rollback;
