create table public.nutrition_label_ocr_jobs (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	storage_path text not null,
	input_sha256 text not null,
	processor_version text not null,
	status text not null default 'queued'
		check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
	attempt_count integer not null default 0
		check (attempt_count between 0 and 3),
	claim_token uuid,
	claimed_at timestamptz,
	result jsonb,
	error_code text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	completed_at timestamptz,
	expires_at timestamptz not null default now() + interval '24 hours',
	constraint nutrition_label_ocr_jobs_storage_path_check check (
		storage_path = user_id::text || '/' || id::text || '.webp'
	),
	constraint nutrition_label_ocr_jobs_sha256_check check (
		input_sha256 ~ '^[a-f0-9]{64}$'
	),
	constraint nutrition_label_ocr_jobs_processor_version_check check (
		processor_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
	),
	constraint nutrition_label_ocr_jobs_error_code_check check (
		error_code is null or error_code ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
	),
	constraint nutrition_label_ocr_jobs_terminal_state_check check (
		(status = 'completed' and result is not null and completed_at is not null)
		or (status <> 'completed' and result is null)
	),
	constraint nutrition_label_ocr_jobs_claim_state_check check (
		(status = 'running' and claim_token is not null and claimed_at is not null)
		or (status <> 'running' and claim_token is null and claimed_at is null)
	)
);

create unique index nutrition_label_ocr_jobs_deduplication_idx
	on public.nutrition_label_ocr_jobs (user_id, input_sha256, processor_version);

create index nutrition_label_ocr_jobs_owner_status_idx
	on public.nutrition_label_ocr_jobs (user_id, status, updated_at desc);

create index nutrition_label_ocr_jobs_expiry_idx
	on public.nutrition_label_ocr_jobs (expires_at, id);

create trigger set_nutrition_label_ocr_jobs_updated_at
	before update on public.nutrition_label_ocr_jobs
	for each row execute function public.set_updated_at();

comment on table public.nutrition_label_ocr_jobs is
	'Owner-scoped temporary nutrition-label OCR job state. Raw recognized text is never retained.';
comment on column public.nutrition_label_ocr_jobs.storage_path is
	'Private temporary normalized crop deleted after completion, cancellation, terminal failure, or expiry cleanup.';
comment on column public.nutrition_label_ocr_jobs.result is
	'Bounded structured suggestions only; excludes raw OCR text and image data.';

alter table public.nutrition_label_ocr_jobs enable row level security;
alter table public.nutrition_label_ocr_jobs force row level security;

revoke all on table public.nutrition_label_ocr_jobs
	from public, anon, authenticated;
grant all on table public.nutrition_label_ocr_jobs to service_role;

create function public.claim_nutrition_label_ocr_job(
	p_job_id uuid,
	p_claim_token uuid
)
returns setof public.nutrition_label_ocr_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
	if p_job_id is null or p_claim_token is null then
		return;
	end if;

	return query
	update public.nutrition_label_ocr_jobs job
	set status = 'running',
		attempt_count = job.attempt_count + 1,
		claim_token = p_claim_token,
		claimed_at = now(),
		error_code = null
	where job.id = p_job_id
		and job.expires_at > now()
		and job.attempt_count < 3
		and (
			job.status = 'queued'
			or (
			job.status = 'running'
				and job.claimed_at < now() - interval '75 seconds'
			)
		)
	returning job.*;
end;
$$;

create function public.complete_nutrition_label_ocr_job(
	p_job_id uuid,
	p_claim_token uuid,
	p_result jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
	if p_job_id is null
		or p_claim_token is null
		or p_result is null
		or jsonb_typeof(p_result) <> 'object'
		or pg_column_size(p_result) > 131072 then
		return false;
	end if;

	update public.nutrition_label_ocr_jobs job
	set status = 'completed',
		result = p_result,
		error_code = null,
		completed_at = now(),
		claim_token = null,
		claimed_at = null
	where job.id = p_job_id
		and job.status = 'running'
		and job.claim_token = p_claim_token
		and job.expires_at > now();

	return found;
end;
$$;

create function public.fail_nutrition_label_ocr_job(
	p_job_id uuid,
	p_claim_token uuid,
	p_error_code text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_next_status text;
begin
	if p_job_id is null
		or p_claim_token is null
		or p_error_code !~ '^[a-z0-9][a-z0-9._-]{0,63}$' then
		return null;
	end if;

	update public.nutrition_label_ocr_jobs job
	set status = case when job.attempt_count >= 3 then 'failed' else 'queued' end,
		error_code = p_error_code,
		claim_token = null,
		claimed_at = null
	where job.id = p_job_id
		and job.status = 'running'
		and job.claim_token = p_claim_token
	returning job.status into v_next_status;

	return v_next_status;
end;
$$;

revoke all on function public.claim_nutrition_label_ocr_job(uuid, uuid)
	from public, anon, authenticated;
revoke all on function public.complete_nutrition_label_ocr_job(uuid, uuid, jsonb)
	from public, anon, authenticated;
revoke all on function public.fail_nutrition_label_ocr_job(uuid, uuid, text)
	from public, anon, authenticated;

grant execute on function public.claim_nutrition_label_ocr_job(uuid, uuid)
	to service_role;
grant execute on function public.complete_nutrition_label_ocr_job(uuid, uuid, jsonb)
	to service_role;
grant execute on function public.fail_nutrition_label_ocr_job(uuid, uuid, text)
	to service_role;

insert into storage.buckets (
	id,
	name,
	public,
	file_size_limit,
	allowed_mime_types
)
values (
	'nutrition-label-ocr-temporary',
	'nutrition-label-ocr-temporary',
	false,
	4194304,
	array['image/webp']
)
on conflict (id) do update set
	public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;
