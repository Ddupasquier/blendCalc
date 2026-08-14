begin;

select plan(14);

select has_table(
	'public',
	'product_regulatory_disclosure_profiles',
	'reviewed product disclosure profiles are database-owned'
);

select is(
	(
		select count(*)
		from public.product_regulatory_disclosure_profiles
		where enabled
	),
	5::bigint,
	'the initial reviewed disclosure catalog covers five explicit contexts'
);

select ok(
	exists (
		select 1
		from public.product_regulatory_disclosure_profiles
		where key = 'us-ttb-alcohol-beverage-v1'
			and disclosure_kind = 'regulated-alcohol'
			and requires_alcohol_by_volume
			and requires_moderator_review
	),
	'alcohol beverage policy requires explicit ABV and review'
);

select ok(
	exists (
		select 1
		from public.product_regulatory_disclosure_profiles
		where key = 'us-ttb-kombucha-case-specific-v1'
			and nutrition_evaluation_mode = 'case-specific'
			and requires_moderator_review
	),
	'kombucha remains case-specific instead of inheriting an ordinary label profile'
);

select ok(
	exists (
		select 1
		from public.product_regulatory_disclosure_profiles
		where key = 'us-standard-nutrition-facts-v1'
			and nutrition_profile_key = 'us-packaged-label-v1'
			and not requires_moderator_review
	),
	'standard Nutrition Facts references the reviewed packaged-food profile'
);

select ok(
	public.food_alcohol_disclosure_is_valid(
		jsonb_build_object(
			'alcoholByVolume', jsonb_build_object(
				'percent', 5.5,
				'valueStatus', 'reported',
				'basis', 'volume-percent',
				'sourceUnit', '% vol'
			)
		)
	),
	'an explicit positive ABV is valid'
);

select ok(
	public.food_alcohol_disclosure_is_valid(
		jsonb_build_object(
			'alcoholByVolume', jsonb_build_object(
				'percent', 0,
				'valueStatus', 'reported-zero',
				'basis', 'volume-percent',
				'sourceUnit', '% vol'
			)
		)
	),
	'an explicit reported-zero ABV remains distinct from missing'
);

select ok(
	public.food_alcohol_disclosure_is_valid('{}'::jsonb),
	'missing ABV remains a valid unknown rather than becoming zero'
);

select ok(
	not public.food_alcohol_disclosure_is_valid(
		jsonb_build_object(
			'alcoholByVolume', jsonb_build_object(
				'percent', 5.5,
				'valueStatus', 'reported',
				'basis', 'mass-percent',
				'sourceUnit', 'g'
			)
		)
	),
	'a mass-based alcohol nutrient cannot masquerade as ABV'
);

select ok(
	not public.food_alcohol_disclosure_is_valid(
		jsonb_build_object(
			'alcoholByVolume', jsonb_build_object(
				'percent', 101,
				'valueStatus', 'reported',
				'basis', 'volume-percent',
				'sourceUnit', '% vol'
			)
		)
	),
	'ABV outside the physical percentage range is rejected'
);

select ok(
	not public.food_alcohol_disclosure_is_valid(
		jsonb_build_object(
			'alcoholByVolume', jsonb_build_object(
				'percent', 0,
				'valueStatus', 'reported',
				'basis', 'volume-percent',
				'sourceUnit', '% vol'
			)
		)
	),
	'zero cannot be mislabeled as an ordinary positive report'
);

select ok(
	public.food_alcohol_disclosure_is_valid(
		jsonb_build_object(
			'regulatoryDisclosure', jsonb_build_object(
				'profileKey', 'us-ttb-alcohol-beverage-v1',
				'evidenceStatus', 'moderator-reviewed'
			)
		)
	),
	'a reviewed disclosure reference has a valid bounded shape'
);

select ok(
	not public.food_alcohol_disclosure_is_valid(
		jsonb_build_object(
			'regulatoryDisclosure', jsonb_build_object(
				'profileKey', 'us-ttb-alcohol-beverage-v1',
				'evidenceStatus', 'guessed-from-name'
			)
		)
	),
	'guessed disclosure evidence is rejected'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.product_regulatory_disclosure_profiles',
		'INSERT'
	),
	'authenticated clients cannot rewrite reviewed disclosure policy'
);

select * from finish();

rollback;
