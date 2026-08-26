begin;

select plan(36);

select has_table('public', 'catalog_monitor_settings', 'catalog monitor settings exist');
select has_table('public', 'catalog_monitor_runs', 'catalog monitor run history exists');
select has_table('public', 'catalog_revalidation_queue', 'product revalidation queue exists');
select has_table('public', 'catalog_provider_product_snapshots', 'provider snapshots exist');
select has_table('public', 'catalog_provider_change_reviews', 'provider change reviews exist');
select has_table('public', 'catalog_safety_alert_ingestion_cursors', 'safety ingestion cursors exist');
select has_table('public', 'official_food_safety_alerts', 'official food safety alerts exist');
select has_table('public', 'official_food_safety_alert_revisions', 'immutable alert revisions exist');
select has_table('public', 'official_food_safety_alert_identifiers', 'alert package identifiers exist');
select has_table('public', 'official_food_safety_alert_matches', 'alert-to-product matches exist');
select has_table('public', 'product_safety_alert_notifications', 'user alert notification history exists');

select is(
	(select enabled from public.catalog_monitor_settings where id),
	false,
	'catalog monitoring remains safely disabled until production secrets are configured'
);
select ok(
	exists (select 1 from cron.job where jobname = 'blendcalc-catalog-monitor-hourly'),
	'a bounded hourly cron trigger is registered'
);
select ok(
	exists (
		select 1 from public.product_data_sources
		where key = 'open-fda-food-enforcement' and enabled
	) and exists (
		select 1 from public.product_data_sources
		where key = 'usda-fsis-recalls' and enabled
	),
	'official US food safety sources are registered'
);
select is(
	(
		select count(*)
		from public.official_food_safety_alert_identifiers identifier
		join public.official_food_safety_alerts alert on alert.id = identifier.alert_id
		where identifier.identifier_type in ('upc', 'gtin')
			and identifier.normalized_value in (
				'00681131276351',
				'00000000818377',
				'00816929000089',
				'00194346474004'
			)
			and alert.is_active
	),
	4::bigint,
	'current FDA table-based recall fixtures retain every exact active barcode'
);
select ok(
	not exists (
		select 1
		from pg_class relation
		join pg_namespace namespace on namespace.oid = relation.relnamespace
		where namespace.nspname = 'public'
			and relation.relname in (
				'catalog_monitor_settings',
				'catalog_monitor_runs',
				'catalog_revalidation_queue',
				'catalog_provider_product_snapshots',
				'catalog_provider_change_reviews',
				'catalog_safety_alert_ingestion_cursors',
				'official_food_safety_alerts',
				'official_food_safety_alert_revisions',
				'official_food_safety_alert_identifiers',
				'official_food_safety_alert_matches',
				'product_safety_alert_notifications'
			)
			and (not relation.relrowsecurity or not relation.relforcerowsecurity)
	),
	'every catalog-monitoring table forces row-level security'
);
select ok(
	not has_table_privilege('authenticated', 'public.catalog_monitor_runs', 'SELECT')
		and not has_table_privilege('authenticated', 'public.official_food_safety_alerts', 'SELECT')
		and not has_table_privilege('authenticated', 'public.official_food_safety_alert_matches', 'SELECT'),
	'authenticated clients cannot read private monitor evidence directly'
);
select ok(
	has_table_privilege('authenticated', 'public.product_safety_alert_notifications', 'SELECT')
		and not has_table_privilege('authenticated', 'public.product_safety_alert_notifications', 'UPDATE'),
	'users can read only the notification table and cannot update it directly'
);
select ok(
	has_table_privilege('service_role', 'public.catalog_revalidation_queue', 'UPDATE')
		and has_table_privilege('service_role', 'public.official_food_safety_alerts', 'INSERT'),
	'the service role can run bounded monitor persistence work'
);
select ok(
	not has_function_privilege('authenticated', 'public.record_official_food_safety_alert(text,jsonb,jsonb,jsonb,text,jsonb,jsonb,timestamptz)', 'EXECUTE')
		and not has_function_privilege('authenticated', 'public.claim_catalog_revalidation_jobs(uuid,integer)', 'EXECUTE'),
	'authenticated clients cannot invoke worker-only functions'
);
select ok(
	position(
		'run_row."startedAt"'
		in pg_get_functiondef(
			'public.get_catalog_monitor_moderation_summary(integer)'::regprocedure
		)
	) > 0
	and position(
		'run_row.started_at'
		in pg_get_functiondef(
			'public.get_catalog_monitor_moderation_summary(integer)'::regprocedure
		)
	) = 0,
	'the moderator summary orders recent runs by the projected JSON field without a stale SQL alias'
);
select ok(
	has_function_privilege('authenticated', 'public.get_catalog_monitor_moderation_summary(integer)', 'EXECUTE')
		and has_function_privilege('authenticated', 'public.review_official_food_safety_alert_match(uuid,text,text)', 'EXECUTE')
		and has_function_privilege('authenticated', 'public.review_catalog_provider_change(uuid,text,text,uuid)', 'EXECUTE'),
	'moderation RPC entry points are callable and enforce permissions internally'
);

create temporary table catalog_monitor_test_context on commit drop as
select
	product.id as shared_product_id,
	product.barcode,
	item.user_id
from public.user_food_list_items item
join public.shared_products product on product.id = item.shared_product_id
where product.status = 'active'
limit 1;

select is(
	(select count(*)::integer from catalog_monitor_test_context),
	1,
	'the QA baseline includes a saved shared product for monitor verification'
);

create temporary table catalog_monitor_alert_result on commit drop as
select result.*
from catalog_monitor_test_context context
cross join lateral public.record_official_food_safety_alert(
	'open-fda-food-enforcement',
	jsonb_build_object(
		'externalAlertId', 'QA-MONITOR-RECALL-1',
		'recallNumber', 'QA-MONITOR-RECALL-1',
		'alertType', 'recall',
		'classification', 'Class I',
		'status', 'Ongoing',
		'productDescription', 'QA exact barcode recall',
		'reason', 'QA verification only',
		'packageDescription', 'Check the package lot code',
		'codeInformation', 'Lot QA-123',
		'sourceUrl', 'https://open.fda.gov/apis/food/enforcement/',
		'reportDate', '2026-08-14',
		'isActive', true
	),
	'{"fixture":true}'::jsonb,
	'{"fixture":true}'::jsonb,
	repeat('a', 64),
	jsonb_build_array(jsonb_build_object(
		'type', 'gtin',
		'normalizedValue', lpad(context.barcode, 14, '0'),
		'sourceText', context.barcode
	)),
	'[]'::jsonb,
	'2026-08-14T12:00:00Z'::timestamptz
) result;

select is(
	(select exact_matches_activated from catalog_monitor_alert_result),
	1,
	'an exact official GTIN activates one product recall match'
);
select is(
	(select probable_matches_queued from catalog_monitor_alert_result),
	0,
	'an exact identifier does not fabricate a probable match'
);
select ok(
	exists (
		select 1
		from public.official_food_safety_alert_matches match
		join catalog_monitor_alert_result result on result.alert_id = match.alert_id
		join catalog_monitor_test_context context on context.shared_product_id = match.shared_product_id
		where match.match_type = 'exact_gtin'
			and match.status = 'active'
			and match.requires_package_check
	),
	'exact recall matches retain package-check requirements'
);
select ok(
	exists (
		select 1
		from public.product_safety_alert_notifications notification
		join public.official_food_safety_alert_matches match on match.id = notification.alert_match_id
		join catalog_monitor_alert_result result on result.alert_id = match.alert_id
		join catalog_monitor_test_context context on context.user_id = notification.user_id
		where notification.channel = 'in_app' and notification.status = 'pending'
	),
	'an active recall queues one in-app notification for an affected saved product'
);
select throws_ok(
	$$update public.official_food_safety_alert_revisions set observed_at = now()$$,
	'Catalog monitor evidence is immutable',
	'official alert revisions cannot be rewritten'
);
select ok(
	exists (
		select 1
		from pg_trigger
		where tgrelid = 'public.catalog_provider_product_snapshots'::regclass
			and tgname = 'prevent_catalog_provider_product_snapshot_changes'
			and not tgisinternal
	),
	'provider product snapshots are guarded by the immutable-evidence trigger'
);

select set_config(
	'request.jwt.claim.sub',
	(select user_id::text from catalog_monitor_test_context),
	true
);
set local role authenticated;
select lives_ok(
	$$select public.mark_product_safety_alert_notification_read((
		select id from public.product_safety_alert_notifications limit 1
	))$$,
	'an affected user can mark their own in-app recall notification read'
);
reset role;
select is(
	(
		select notification.status
		from public.product_safety_alert_notifications notification
		join catalog_monitor_test_context context on context.user_id = notification.user_id
		order by notification.created_at desc
		limit 1
	),
	'read',
	'the notification read RPC records explicit read state'
);

create temporary table catalog_monitor_closed_alert_result on commit drop as
select result.*
from public.record_official_food_safety_alert(
	'open-fda-food-enforcement',
	jsonb_build_object(
		'externalAlertId', 'QA-MONITOR-RECALL-1',
		'recallNumber', 'QA-MONITOR-RECALL-1',
		'alertType', 'recall',
		'status', 'Terminated',
		'productDescription', 'QA exact barcode recall',
		'sourceUrl', 'https://open.fda.gov/apis/food/enforcement/',
		'reportDate', '2026-08-14',
		'terminatedAt', '2026-08-15',
		'isActive', false
	),
	'{"fixture":true,"closed":true}'::jsonb,
	'{"fixture":true,"closed":true}'::jsonb,
	repeat('b', 64),
	'[]'::jsonb,
	'[]'::jsonb,
	'2026-08-15T12:00:00Z'::timestamptz
) result;

select is(
	(select content_changed from catalog_monitor_closed_alert_result),
	true,
	'a changed official alert creates a new immutable revision'
);
select ok(
	not exists (
		select 1
		from public.official_food_safety_alert_matches match
		join catalog_monitor_alert_result result on result.alert_id = match.alert_id
		where match.status in ('active', 'confirmed', 'needs_review')
	),
	'a terminated official alert supersedes active and pending matches'
);
select is(
	(
		select count(*)::integer
		from public.official_food_safety_alert_revisions revision
		join catalog_monitor_alert_result result on result.alert_id = revision.alert_id
	),
	2,
	'official alert changes preserve both source observations'
);
select is(
	(
		select count(*)::integer
		from public.catalog_safety_alert_ingestion_cursors
		where provider_key in ('open-fda-food-enforcement', 'usda-fsis-recalls')
	),
	2,
	'both first-pass safety providers have independent cursors'
);
select ok(
	exists (
		select 1
		from public.catalog_revalidation_queue queue
		where queue.provider_key = 'open-food-facts'
	)
	and not exists (
		select 1
		from public.shared_products product
		where product.status = 'active'
			and product.source = 'usda'
			and product.source_reference ~ '^[0-9]+$'
			and not exists (
				select 1
				from public.catalog_revalidation_queue queue
				where queue.shared_product_id = product.id
					and queue.provider_key = 'usda'
			)
	),
	'active catalog products are queued for the complementary product providers when identities exist'
);

select * from finish();
rollback;
