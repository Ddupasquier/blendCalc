begin;

select plan(14);

insert into auth.users (id, aud, role, email)
values (
	'10000000-0000-4000-8000-000000000009',
	'authenticated',
	'authenticated',
	'ocr-job-009@example.com'
);

select has_table(
	'public',
	'nutrition_label_ocr_jobs',
	'nutrition label OCR has one durable temporary job ledger'
);

select ok(
	not has_table_privilege('authenticated', 'public.nutrition_label_ocr_jobs', 'select')
		and not has_table_privilege('authenticated', 'public.nutrition_label_ocr_jobs', 'insert')
		and has_table_privilege('service_role', 'public.nutrition_label_ocr_jobs', 'select')
		and has_table_privilege('service_role', 'public.nutrition_label_ocr_jobs', 'insert'),
	'OCR jobs remain behind the server boundary'
);

select ok(
	(
		select not public
			and file_size_limit = 4194304
			and allowed_mime_types = array['image/webp']::text[]
		from storage.buckets
		where id = 'nutrition-label-ocr-temporary'
	),
	'temporary OCR images use one private WebP-only bounded bucket'
);

insert into public.nutrition_label_ocr_jobs (
	id,
	user_id,
	storage_path,
	input_sha256,
	processor_version
)
values (
	'90000000-0000-4000-8000-000000000009',
	'10000000-0000-4000-8000-000000000009',
	'10000000-0000-4000-8000-000000000009/90000000-0000-4000-8000-000000000009.webp',
	repeat('a', 64),
	'nutrition-label-tesseract-v2'
);

select is(
	(
		select status
		from public.claim_nutrition_label_ocr_job(
			'90000000-0000-4000-8000-000000000009',
			'91000000-0000-4000-8000-000000000009'
		)
	),
	'running',
	'the first worker atomically claims a queued job'
);

select is(
	(
		select count(*)::integer
		from public.claim_nutrition_label_ocr_job(
			'90000000-0000-4000-8000-000000000009',
			'92000000-0000-4000-8000-000000000009'
		)
	),
	0,
	'a concurrent delivery cannot claim the same running job'
);

select is(
	(
		select attempt_count
		from public.nutrition_label_ocr_jobs
		where id = '90000000-0000-4000-8000-000000000009'
	),
	1,
	'each accepted worker claim records one bounded attempt'
);

select is(
	public.complete_nutrition_label_ocr_job(
		'90000000-0000-4000-8000-000000000009',
		'92000000-0000-4000-8000-000000000009',
		'{"candidates":[],"qualitativeFacts":[],"serving":null,"confidence":0}'::jsonb
	),
	false,
	'a worker cannot complete a claim owned by another delivery'
);

select is(
	public.complete_nutrition_label_ocr_job(
		'90000000-0000-4000-8000-000000000009',
		'91000000-0000-4000-8000-000000000009',
		'{"candidates":[],"qualitativeFacts":[],"serving":null,"confidence":0}'::jsonb
	),
	true,
	'the owning worker can store one bounded structured result'
);

select ok(
	(
		select status = 'completed'
			and result ? 'candidates'
			and not (result ? 'rawText')
			and claim_token is null
			and storage_path is not null
		from public.nutrition_label_ocr_jobs
		where id = '90000000-0000-4000-8000-000000000009'
	),
	'completion retains suggestions without raw recognized text or a worker lease'
);

select is(
	public.fail_nutrition_label_ocr_job(
		'90000000-0000-4000-8000-000000000009',
		'91000000-0000-4000-8000-000000000009',
		'ocr-processing-failed'
	),
	null,
	'a completed job cannot be changed by a late failure'
);

select throws_ok(
	$$
		insert into public.nutrition_label_ocr_jobs (
			id,
			user_id,
			storage_path,
			input_sha256,
			processor_version
		)
		values (
			'90000000-0000-4000-8000-000000000010',
			'10000000-0000-4000-8000-000000000009',
			'another-user/job.webp',
			repeat('b', 64),
			'nutrition-label-tesseract-v2'
		)
	$$,
	23514,
	null,
	'a job cannot point at another owner or arbitrary storage path'
);

select is(
	(
		select extract(epoch from (expires_at - created_at))::integer
		from public.nutrition_label_ocr_jobs
		where id = '90000000-0000-4000-8000-000000000009'
	),
	86400,
	'temporary job state expires after twenty-four hours'
);

insert into public.nutrition_label_ocr_jobs (
	id,
	user_id,
	storage_path,
	input_sha256,
	processor_version
)
values (
	'90000000-0000-4000-8000-000000000011',
	'10000000-0000-4000-8000-000000000009',
	'10000000-0000-4000-8000-000000000009/90000000-0000-4000-8000-000000000011.webp',
	repeat('c', 64),
	'nutrition-label-tesseract-v2'
);

select is(
	(
		select status
		from public.claim_nutrition_label_ocr_job(
			'90000000-0000-4000-8000-000000000011',
			'93000000-0000-4000-8000-000000000009'
		)
	),
	'running',
	'a queued recovery fixture receives its first worker lease'
);

update public.nutrition_label_ocr_jobs
set claimed_at = now() - interval '76 seconds'
where id = '90000000-0000-4000-8000-000000000011';

select is(
	(
		select attempt_count
		from public.claim_nutrition_label_ocr_job(
			'90000000-0000-4000-8000-000000000011',
			'94000000-0000-4000-8000-000000000009'
		)
	),
	2,
	'a delivery after the function timeout can reclaim the stale lease'
);

select * from finish();

rollback;
