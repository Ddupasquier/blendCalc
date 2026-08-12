begin;

insert into public.app_issue_codes (
	code,
	kind,
	domain,
	description,
	enabled
)
values (
	'MFA_REQUIRED',
	'error',
	'authentication',
	'Elevated access requires multi-factor authentication assurance.',
	true
)
on conflict (code) do update set
	kind = excluded.kind,
	domain = excluded.domain,
	description = excluded.description,
	enabled = excluded.enabled,
	updated_at = now();

commit;
