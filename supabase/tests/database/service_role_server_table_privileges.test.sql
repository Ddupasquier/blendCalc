begin;

select plan(15);

select ok(
	has_table_privilege('service_role', 'public.account_moderation', 'select')
		and has_table_privilege('service_role', 'public.account_moderation', 'insert')
		and has_table_privilege('service_role', 'public.account_moderation', 'update'),
	'the server role can read and maintain account moderation state'
);

select ok(
	has_table_privilege('service_role', 'public.blocked_signup_emails', 'select')
		and has_table_privilege('service_role', 'public.blocked_signup_emails', 'insert')
		and has_table_privilege('service_role', 'public.blocked_signup_emails', 'update')
		and has_table_privilege('service_role', 'public.blocked_signup_emails', 'delete'),
	'the server role can maintain the signup blocklist'
);

select ok(
	has_table_privilege('service_role', 'public.moderation_actions', 'select')
		and has_table_privilege('service_role', 'public.moderation_actions', 'insert'),
	'the server role can append moderation actions'
);

select ok(
	has_table_privilege('service_role', 'public.moderation_email_deliveries', 'select')
		and has_table_privilege('service_role', 'public.moderation_email_deliveries', 'insert')
		and has_table_privilege('service_role', 'public.moderation_email_deliveries', 'update'),
	'the server role can record moderation email delivery state'
);

select ok(
	has_table_privilege('service_role', 'public.product_submission_blocks', 'select')
		and has_table_privilege('service_role', 'public.product_submission_blocks', 'insert')
		and has_table_privilege('service_role', 'public.product_submission_blocks', 'update'),
	'the server role can enforce product submission blocks'
);

select ok(
	has_table_privilege('service_role', 'public.user_catalog_submission_enforcement', 'select')
		and has_table_privilege('service_role', 'public.user_catalog_submission_enforcement', 'insert')
		and has_table_privilege('service_role', 'public.user_catalog_submission_enforcement', 'update'),
	'the server role can maintain current catalog submission enforcement state'
);

select ok(
	has_table_privilege('service_role', 'public.shared_product_submissions', 'select')
		and has_table_privilege('service_role', 'public.shared_product_submissions', 'insert')
		and has_table_privilege('service_role', 'public.shared_product_submissions', 'update')
		and has_table_privilege('service_role', 'public.shared_product_submissions', 'delete'),
	'the server role can create, review, and clean up product submissions'
);

select ok(
	has_table_privilege('service_role', 'public.shared_products', 'select'),
	'the server role can read canonical products during reviewed workflows'
);

select ok(
	has_table_privilege('service_role', 'public.shared_product_revisions', 'select'),
	'the server role can read product revisions during reviewed workflows'
);

select ok(
	has_table_privilege('service_role', 'public.shared_product_field_provenance', 'select'),
	'the server role can read selected field provenance during reviewed workflows'
);

select ok(
	has_table_privilege('service_role', 'public.food_nutrients', 'select'),
	'the server role can read normalized nutrients during reviewed workflows'
);

select ok(
	not has_table_privilege('authenticated', 'public.account_moderation', 'insert')
		and not has_table_privilege('authenticated', 'public.account_moderation', 'update'),
	'ordinary authenticated clients cannot maintain moderation state'
);

select ok(
	not has_table_privilege('authenticated', 'public.blocked_signup_emails', 'select')
		and not has_table_privilege('authenticated', 'public.blocked_signup_emails', 'insert'),
	'ordinary authenticated clients cannot read or write the signup blocklist'
);

select ok(
	not has_table_privilege('authenticated', 'public.moderation_actions', 'insert'),
	'ordinary authenticated clients cannot append moderation actions'
);

select ok(
	not has_table_privilege('authenticated', 'public.shared_product_submissions', 'update')
		and not has_table_privilege('authenticated', 'public.shared_product_submissions', 'delete'),
	'ordinary authenticated clients cannot review or delete product submissions'
);

select * from finish();

rollback;
