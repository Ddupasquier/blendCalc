begin;

select plan(16);

select has_table(
	'public',
	'mix_goal_template_versions',
	'Mix goal presets have immutable reviewed versions'
);

select has_table(
	'public',
	'user_mix_goal_templates',
	'users can save private reusable goal presets'
);

select has_table(
	'public',
	'user_mix_nutrient_goals',
	'active user goals are normalized'
);

select has_column(
	'public',
	'mix_goal_template_targets',
	'goal_type',
	'system preset targets store explicit goal semantics'
);

select ok(
	has_function_privilege(
		'authenticated',
		'public.apply_mix_goal_template(uuid,boolean)',
		'EXECUTE'
	),
	'authenticated users can apply a reviewed system preset'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.user_mix_nutrient_goals',
		'INSERT'
	),
	'authenticated users cannot bypass authoritative active-goal writes'
);

insert into auth.users (id, aud, role, email)
values (
	'73000000-0000-4000-8000-000000000018',
	'authenticated',
	'authenticated',
	'mix-goal-presets@blendcalc.local'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"73000000-0000-4000-8000-000000000018","role":"authenticated","app_role":"user"}',
	true
);

select lives_ok(
	$$
		select public.apply_mix_goal_template(
			(select current_version_id from public.mix_goal_templates where is_default),
			false
		)
	$$,
	'a reviewed system preset applies successfully'
);

select is(
	(
		select count(*)
		from public.user_mix_nutrient_goals
		where user_id = auth.uid()
	),
	(
		select count(*)
		from public.mix_goal_template_targets target
		join public.mix_goal_templates template
			on template.current_version_id = target.template_version_id
		where template.is_default
	),
	'applying a preset copies every reviewed target into the active configuration'
);

select is(
	(
		select goal_type
		from public.user_mix_nutrient_goals
		where user_id = auth.uid() and nutrient_id = 1003
	),
	'minimum',
	'protein retains its minimum-goal semantics'
);

select is(
	(
		select goal_type
		from public.user_mix_nutrient_goals
		where user_id = auth.uid() and nutrient_id = 1004
	),
	'maximum',
	'fat retains its maximum-goal semantics'
);

select lives_ok(
	$$
		select public.save_user_mix_goal_template(
			p_display_name => 'My QA goals',
			p_description => 'A private reusable test preset.',
			p_goal_basis => 'per_mix',
			p_goals => jsonb_build_array(jsonb_build_object(
				'nutrient_id', 1008,
				'goal_type', 'range',
				'target_amount', 300,
				'upper_amount', 400,
				'tolerance_ratio', 0.05,
				'importance_weight', 2,
				'sort_order', 1
			))
		)
	$$,
	'a user can save a private range-based preset'
);

select is(
	(
		select goal_type
		from public.user_mix_goal_template_targets
		where template_id = (
			select id
			from public.user_mix_goal_templates
			where user_id = auth.uid() and display_name = 'My QA goals'
		)
	),
	'range',
	'personal presets preserve their explicit goal type'
);

select throws_ok(
	$$
		select public.save_mix_goal_configuration(
			jsonb_build_array(jsonb_build_object(
				'nutrient_id', 1008,
				'goal_type', 'range',
				'target_amount', 400,
				'upper_amount', 300,
				'tolerance_ratio', 0.05,
				'importance_weight', 1,
				'sort_order', 1
			))
		)
	$$,
	'22023',
	'Mix goals contain invalid nutrient, amount, type, tolerance, weight, or ordering data.',
	'invalid ranges are rejected at the database boundary'
);

select throws_ok(
	$$
		select public.save_mix_goal_configuration(
			jsonb_build_array(jsonb_build_object(
				'nutrient_id', 1008,
				'goal_type', 'exact',
				'target_amount', 350,
				'upper_amount', null,
				'tolerance_ratio', 0.05,
				'importance_weight', 1,
				'sort_order', 1
			)),
			p_customized => false
		)
	$$,
	'22023',
	'Unmodified presets must be applied through their authoritative preset function.',
	'clients cannot fabricate unmodified preset provenance'
);

select lives_ok(
	$$ select public.save_mix_goal_configuration('[]'::jsonb) $$,
	'an intentionally empty goal configuration can be saved'
);

select is(
	(
		select goal_configuration_initialized
		from public.mix_preferences
		where user_id = auth.uid()
	),
	true,
	'an intentionally empty goal configuration remains distinguishable from no configuration'
);

select * from finish();

rollback;
