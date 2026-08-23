begin;

select plan(21);

select has_column(
	'public',
	'food_image_assets',
	'canonical_status',
	'food images record canonical selection state'
);

select has_column(
	'public',
	'food_image_assets',
	'canonical_selection_method',
	'food images record how canonical selection occurred'
);

select ok(
	has_function_privilege(
		'service_role',
		'public.refresh_canonical_food_image(uuid)',
		'execute'
	),
	'trusted server workflows can refresh canonical image selection'
);

select ok(
	not has_function_privilege(
		'authenticated',
		'public.refresh_canonical_food_image(uuid)',
		'execute'
	),
	'authenticated clients cannot choose canonical images directly'
);

insert into auth.users (id, aud, role, email)
values (
	'72400000-0000-4000-8000-000000000001',
	'authenticated',
	'authenticated',
	'canonical-image-moderator@blendcalc.local'
);

insert into public.shared_product_submissions (
	id,
	submitted_by,
	barcode,
	product_name,
	food,
	consent_to_share,
	category_option_id,
	status
)
select
	fixture.id,
	'72400000-0000-4000-8000-000000000001'::uuid,
	fixture.barcode,
	fixture.product_name,
	'{}'::jsonb,
	true,
	category.id,
	'approved'
from (
	values
		(
			'72400000-0000-4000-8000-000000000008'::uuid,
			'00011110904423'::text,
			'Canonical Image Test Product'::text
		),
		(
			'72400000-0000-4000-8000-000000000009'::uuid,
			'00011110904430'::text,
			'Precached Image Test Product'::text
		)
) fixture(id, barcode, product_name)
cross join lateral (
	select option.id
	from public.custom_food_category_options option
	where option.enabled
	order by option.id
	limit 1
) category;

insert into public.shared_products (
	id,
	barcode,
	product_name,
	brand_owner,
	search_text,
	food,
	source,
	source_reference,
	confidence,
	status,
	approved_submission_id
)
values (
	'72400000-0000-4000-8000-000000000010',
	'00011110904423',
	'Canonical Image Test Product',
	'blendCalc QA',
	'canonical image test product blendcalc qa',
	'{}'::jsonb,
	'usda',
	'7240010',
	'source-verified',
	'active',
	'72400000-0000-4000-8000-000000000008'
);

insert into public.food_image_assets (
	id,
	barcode,
	shared_product_id,
	source,
	source_reference,
	image_role,
	image_url,
	license_name,
	license_url,
	attribution_text,
	confidence,
	status,
	fetched_at
)
values (
	'72400000-0000-4000-8000-000000000020',
	'00011110904423',
	'72400000-0000-4000-8000-000000000010',
	'open-food-facts',
	'canonical-image-old',
	'front',
	'https://images.example.test/canonical-image-old.jpg',
	'CC BY-SA 3.0',
	'https://creativecommons.org/licenses/by-sa/3.0/',
	'Open Food Facts contributors',
	'source-verified',
	'active',
	'2026-08-20T12:00:00Z'
);

select is(
	(
		select image.canonical_status
		from public.food_image_assets image
		where image.id = '72400000-0000-4000-8000-000000000020'
	),
	'selected',
	'the first exact licensed source image becomes canonical automatically'
);

select is(
	(
		select image.canonical_selection_method
		from public.food_image_assets image
		where image.id = '72400000-0000-4000-8000-000000000020'
	),
	'exact-licensed-source',
	'automatic source selection records its exact evidence method'
);

select is(
	(
		select image.canonical_selected_by
		from public.food_image_assets image
		where image.id = '72400000-0000-4000-8000-000000000020'
	),
	null,
	'automatic source selection does not invent a moderator'
);

insert into public.food_image_assets (
	id,
	barcode,
	shared_product_id,
	source,
	source_reference,
	image_role,
	image_url,
	license_name,
	license_url,
	attribution_text,
	confidence,
	status,
	fetched_at
)
values (
	'72400000-0000-4000-8000-000000000021',
	'00011110904423',
	'72400000-0000-4000-8000-000000000010',
	'open-food-facts',
	'canonical-image-new',
	'front',
	'https://images.example.test/canonical-image-new.jpg',
	'CC BY-SA 3.0',
	'https://creativecommons.org/licenses/by-sa/3.0/',
	'Open Food Facts contributors',
	'source-verified',
	'active',
	'2026-08-21T12:00:00Z'
);

select is(
	(
		select image.id
		from public.food_image_assets image
		where image.shared_product_id = '72400000-0000-4000-8000-000000000010'
			and image.canonical_status = 'selected'
	),
	'72400000-0000-4000-8000-000000000020'::uuid,
	'a newer candidate cannot silently replace an eligible canonical image'
);

select is(
	(
		select image.canonical_status
		from public.food_image_assets image
		where image.id = '72400000-0000-4000-8000-000000000021'
	),
	'candidate',
	'the newer exact source image remains available as an alternate candidate'
);

update public.food_image_assets
set status = 'retired'
where id = '72400000-0000-4000-8000-000000000020';

select is(
	(
		select image.id
		from public.food_image_assets image
		where image.shared_product_id = '72400000-0000-4000-8000-000000000010'
			and image.canonical_status = 'selected'
	),
	'72400000-0000-4000-8000-000000000021'::uuid,
	'retiring the canonical image promotes the next eligible candidate'
);

insert into public.food_image_assets (
	id,
	barcode,
	shared_product_id,
	source,
	source_reference,
	image_role,
	image_url,
	license_name,
	attribution_text,
	confidence,
	approved_by,
	approved_at,
	status,
	fetched_at
)
values (
	'72400000-0000-4000-8000-000000000022',
	'00011110904423',
	'72400000-0000-4000-8000-000000000010',
	'community-reviewed',
	'canonical-image-community',
	'front',
	'https://images.example.test/canonical-image-community.jpg',
	'Community submitted product image',
	'blendCalc community submission',
	'moderator-reviewed',
	'72400000-0000-4000-8000-000000000001',
	'2026-08-22T09:00:00Z',
	'active',
	'2026-08-22T09:00:00Z'
);

select is(
	(
		select image.id
		from public.food_image_assets image
		where image.shared_product_id = '72400000-0000-4000-8000-000000000010'
			and image.canonical_status = 'selected'
	),
	'72400000-0000-4000-8000-000000000021'::uuid,
	'an approved community candidate does not replace an existing canonical image'
);

update public.food_image_assets
set status = 'retired'
where id = '72400000-0000-4000-8000-000000000021';

select is(
	(
		select image.id
		from public.food_image_assets image
		where image.shared_product_id = '72400000-0000-4000-8000-000000000010'
			and image.canonical_status = 'selected'
	),
	'72400000-0000-4000-8000-000000000022'::uuid,
	'an approved community image becomes canonical when no canonical image remains'
);

select is(
	(
		select image.canonical_selection_method
		from public.food_image_assets image
		where image.id = '72400000-0000-4000-8000-000000000022'
	),
	'moderator-approved-community',
	'community selection records its reviewed evidence method'
);

select is(
	(
		select image.canonical_selected_by
		from public.food_image_assets image
		where image.id = '72400000-0000-4000-8000-000000000022'
	),
	'72400000-0000-4000-8000-000000000001'::uuid,
	'community selection records the responsible moderator'
);

insert into public.food_image_assets (
	id,
	barcode,
	source,
	source_reference,
	image_role,
	image_url,
	license_name,
	license_url,
	attribution_text,
	confidence,
	status,
	fetched_at
)
values (
	'72400000-0000-4000-8000-000000000030',
	'00011110904430',
	'open-food-facts',
	'canonical-image-before-product',
	'front',
	'https://images.example.test/canonical-image-before-product.jpg',
	'CC BY-SA 3.0',
	'https://creativecommons.org/licenses/by-sa/3.0/',
	'Open Food Facts contributors',
	'source-verified',
	'active',
	'2026-08-22T09:00:00Z'
);

insert into public.food_image_assets (
	id,
	barcode,
	source,
	source_reference,
	image_role,
	image_url,
	license_name,
	license_url,
	attribution_text,
	confidence,
	status,
	fetched_at
)
values (
	'72400000-0000-4000-8000-000000000032',
	'00011110904430',
	'open-food-facts',
	'canonical-image-before-product-newer',
	'front',
	'https://images.example.test/canonical-image-before-product-newer.jpg',
	'CC BY-SA 3.0',
	'https://creativecommons.org/licenses/by-sa/3.0/',
	'Open Food Facts contributors',
	'source-verified',
	'active',
	'2026-08-22T10:00:00Z'
);

insert into public.shared_products (
	id,
	barcode,
	product_name,
	brand_owner,
	search_text,
	food,
	source,
	source_reference,
	confidence,
	status,
	approved_submission_id
)
values (
	'72400000-0000-4000-8000-000000000031',
	'00011110904430',
	'Precached Image Test Product',
	'blendCalc QA',
	'precached image test product blendcalc qa',
	'{}'::jsonb,
	'usda',
	'7240031',
	'source-verified',
	'active',
	'72400000-0000-4000-8000-000000000009'
);

select is(
	(
		select image.shared_product_id
		from public.food_image_assets image
		where image.id = '72400000-0000-4000-8000-000000000030'
	),
	'72400000-0000-4000-8000-000000000031'::uuid,
	'an exact precached image is linked when its shared product is created'
);

select is(
	(
		select image.shared_product_id
		from public.food_image_assets image
		where image.id = '72400000-0000-4000-8000-000000000032'
	),
	'72400000-0000-4000-8000-000000000031'::uuid,
	'all exact precached image candidates are linked to the new product'
);

select is(
	(
		select image.id
		from public.food_image_assets image
		where image.shared_product_id = '72400000-0000-4000-8000-000000000031'
			and image.canonical_status = 'selected'
	),
	'72400000-0000-4000-8000-000000000032'::uuid,
	'the best deterministic precached candidate becomes canonical'
);

select is(
	(
		select image.canonical_status
		from public.food_image_assets image
		where image.id = '72400000-0000-4000-8000-000000000030'
	),
	'candidate',
	'other precached images remain alternate candidates'
);

insert into public.food_image_assets (
	id,
	barcode,
	shared_product_id,
	source,
	source_reference,
	image_role,
	image_url,
	license_name,
	attribution_text,
	confidence,
	status
)
values (
	'72400000-0000-4000-8000-000000000040',
	'00011110904430',
	'72400000-0000-4000-8000-000000000031',
	'open-food-facts',
	'canonical-image-missing-rights',
	'front',
	'https://images.example.test/canonical-image-missing-rights.jpg',
	'CC BY-SA 3.0',
	'Open Food Facts contributors',
	'source-verified',
	'active'
);

select is(
	(
		select image.canonical_status
		from public.food_image_assets image
		where image.id = '72400000-0000-4000-8000-000000000040'
	),
	'candidate',
	'an external image missing required rights metadata cannot become canonical'
);

select throws_ok(
	$$
		update public.food_image_assets
		set
			canonical_status = 'selected',
			canonical_selection_method = 'exact-licensed-source',
			canonical_selected_at = now(),
			canonical_selected_by = '72400000-0000-4000-8000-000000000001'
		where id = '72400000-0000-4000-8000-000000000040'
	$$,
	'23514',
	null,
	'incoherent canonical selection metadata is rejected'
);

select is(
	(
		select count(*)
		from public.food_image_assets image
		where image.shared_product_id = '72400000-0000-4000-8000-000000000010'
			and image.canonical_status = 'selected'
	),
	1::bigint,
	'exactly one canonical image remains selected for the product'
);

select * from finish();
rollback;
