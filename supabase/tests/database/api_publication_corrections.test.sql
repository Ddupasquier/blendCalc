begin;

select plan(25);

select has_table(
	'public',
	'api_publication_concerns',
	'publication concerns have private durable storage'
);
select has_table(
	'public',
	'api_publication_holds',
	'publication holds have private durable storage'
);
select has_function(
	'public',
	'blendcalc_api_v1_source_has_active_hold',
	array['text', 'text'],
	'API source publication has a hold gate'
);
select has_function(
	'public',
	'sync_product_publication_hold_conflict',
	array[]::text[],
	'product holds integrate with the canonical conflict gate'
);

select ok(
	not has_table_privilege('authenticated', 'public.api_publication_concerns', 'SELECT'),
	'ordinary users cannot read concern contact details or evidence'
);
select ok(
	not has_table_privilege('anon', 'public.api_publication_concerns', 'INSERT'),
	'anonymous callers cannot bypass the validated server intake'
);
select ok(
	not has_table_privilege('authenticated', 'public.api_publication_holds', 'SELECT'),
	'ordinary users cannot read internal publication holds'
);
select ok(
	not has_table_privilege('anon', 'public.api_publication_holds', 'INSERT'),
	'anonymous callers cannot place publication holds'
);
select ok(
	has_table_privilege('service_role', 'public.api_publication_concerns', 'INSERT'),
	'the trusted server can store validated concerns'
);
select ok(
	has_table_privilege('service_role', 'public.api_publication_holds', 'UPDATE'),
	'the trusted server can release a hold without deleting it'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"9e3f226d-5781-41f4-8455-6be35956f7a7","role":"authenticated","app_role":"moderator"}',
	true
);
select throws_ok(
	$$ select count(*) from public.api_publication_concerns $$,
	'42501',
	'permission denied for table api_publication_concerns',
	'a browser moderator cannot bypass the protected AAL2 server route'
);
select throws_ok(
	$$ insert into public.api_publication_holds (
		subject_type,
		shared_product_id,
		reason_code,
		public_message,
		internal_note,
		placed_by
	) values (
		'product',
		'81000000-0000-4000-8000-000000000011',
		'accuracy-review',
		'Unavailable.',
		'Attempted direct write.',
		'9e3f226d-5781-41f4-8455-6be35956f7a7'
	) $$,
	'42501',
	'permission denied for table api_publication_holds',
	'a browser moderator cannot bypass the protected hold route'
);
reset role;

insert into public.api_publication_concerns (
	id,
	reporter_type,
	contact_email,
	reporter_user_id,
	concern_type,
	subject_type,
	shared_product_id,
	subject_reference,
	concern_fingerprint,
	details,
	evidence_urls
)
select
	'87000000-0000-4000-8000-000000000001',
	'rights-holder',
	'rights@example.com',
	actor.id,
	'rights-or-license',
	'product',
	product.id,
	product.barcode,
	repeat('a', 64),
	'Rights evidence requires review before continued publication.',
	array['https://example.com/evidence']
from public.shared_products product
cross join lateral (
	select id from auth.users where email = 'qa-moderator@blendcalc.local' limit 1
) actor
where product.barcode = '00021130493609';

select is(
	(
		select count(*)::integer
		from public.api_publication_concerns
		where id = '87000000-0000-4000-8000-000000000001'
			and shared_product_id is not null
			and food_image_asset_id is null
			and dataset_key is null
			and source_key is null
	),
	1,
	'a concern retains exactly one resolved canonical subject'
);

select throws_ok(
	$$ insert into public.api_publication_holds (
		subject_type,
		source_key,
		reason_code,
		public_message,
		internal_note,
		concern_id,
		placed_by
	) select
		'source',
		'usda',
		'rights-review',
		'Unavailable.',
		'Mismatched subject.',
		'87000000-0000-4000-8000-000000000001',
		id
	from auth.users where email = 'qa-moderator@blendcalc.local'
	$$,
	'23514',
	'API_PUBLICATION_HOLD_CONCERN_MISMATCH',
	'a concern cannot be linked to a hold on a different subject'
);

select throws_ok(
	$$ update public.api_publication_concerns
	set
		status = 'resolved',
		resolution_action = 'publication-hold',
		resolution_note = 'No actual hold exists.',
		reviewed_by = (select id from auth.users where email = 'qa-moderator@blendcalc.local'),
		reviewed_at = now()
	where id = '87000000-0000-4000-8000-000000000001'
	$$,
	'23514',
	'API_PUBLICATION_RESOLUTION_HOLD_MISSING',
	'a concern cannot claim a hold resolution before a linked hold exists'
);

select ok(
	public.blendcalc_api_v1_source_attribution_is_complete('usda', '2032704'),
	'a reviewed source starts eligible before a hold'
);

insert into public.api_publication_holds (
	id,
	subject_type,
	shared_product_id,
	reason_code,
	public_message,
	internal_note,
	concern_id,
	placed_by
)
select
	'87000000-0000-4000-8000-000000000002',
	'product',
	product.id,
	'rights-review',
	'Temporarily unavailable while publication rights are reviewed.',
	'Linked rights-holder concern requires review.',
	'87000000-0000-4000-8000-000000000001',
	actor.id
from public.shared_products product
cross join lateral (
	select id from auth.users where email = 'qa-moderator@blendcalc.local' limit 1
) actor
where product.barcode = '00021130493609';

select is(
	(
		select count(*)::integer
		from public.shared_product_conflicts
		where field_path = 'api-publication-hold:87000000-0000-4000-8000-000000000002'
			and severity = 'high'
			and status = 'open'
	),
	1,
	'a product hold creates one high-severity material conflict'
);
select ok(
	'unresolved_material_conflict' = any(
		public.blendcalc_api_v1_product_readiness_reasons(
			'81000000-0000-4000-8000-000000000011'
		)
	),
	'a held product fails publication readiness'
);
select is(
	(
		select count(*)::integer
		from public.get_blendcalc_product_v1('00021130493609')
	),
	0,
	'a held product disappears from the public API immediately'
);
select is(
	(
		select count(*)::integer
		from public.shared_products
		where barcode = '00021130493609'
	),
	1,
	'a hold preserves the canonical product row'
);
select ok(
	(
		select count(*) > 0
		from public.shared_product_revisions revision
		join public.shared_products product on product.id = revision.shared_product_id
		where product.barcode = '00021130493609'
	),
	'a hold preserves immutable revision history'
);

update public.api_publication_holds hold
set
	released_by = actor.id,
	released_at = now(),
	release_note = 'Rights evidence was reviewed and publication may resume.'
from (
	select id from auth.users where email = 'qa-moderator@blendcalc.local' limit 1
) actor
where hold.id = '87000000-0000-4000-8000-000000000002';

select is(
	(
		select status
		from public.shared_product_conflicts
		where field_path = 'api-publication-hold:87000000-0000-4000-8000-000000000002'
	),
	'resolved',
	'releasing a hold resolves only its mirrored conflict'
);
select ok(
	not ('unresolved_material_conflict' = any(
		public.blendcalc_api_v1_product_readiness_reasons(
			'81000000-0000-4000-8000-000000000011'
		)
	)),
	'a released hold no longer blocks product readiness'
);

insert into public.api_publication_holds (
	id,
	subject_type,
	source_key,
	reason_code,
	public_message,
	internal_note,
	placed_by
)
select
	'87000000-0000-4000-8000-000000000003',
	'source',
	'usda',
	'source-retirement',
	'USDA-derived fields are temporarily unavailable.',
	'Source release policy is under review.',
	actor.id
from (
	select id from auth.users where email = 'qa-moderator@blendcalc.local' limit 1
) actor;

select ok(
	not public.blendcalc_api_v1_source_attribution_is_complete('usda', '2032704'),
	'a source hold fails attribution eligibility for every dependent field'
);

insert into public.api_publication_holds (
	id,
	subject_type,
	food_image_asset_id,
	reason_code,
	public_message,
	internal_note,
	placed_by
)
select
	'87000000-0000-4000-8000-000000000004',
	'image',
	image.id,
	'privacy-review',
	'This image is temporarily unavailable.',
	'Image privacy concern requires review.',
	actor.id
from public.food_image_assets image
cross join lateral (
	select id from auth.users where email = 'qa-moderator@blendcalc.local' limit 1
) actor
where image.id = '85000000-0000-4000-8000-000000000001';

select is(
	(
		select count(*)::integer
		from public.api_publication_holds
		where food_image_asset_id = '85000000-0000-4000-8000-000000000001'
			and released_at is null
	),
	1,
	'an image can be withheld independently of its canonical product'
);

select * from finish();

rollback;
