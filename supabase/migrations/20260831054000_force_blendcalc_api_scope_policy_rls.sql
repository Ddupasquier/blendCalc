alter table public.blendcalc_api_scopes force row level security;
alter table public.blendcalc_api_scope_policies force row level security;

comment on table public.blendcalc_api_scopes is
	'Service-only reviewed blendCalcAPI capabilities protected by forced row level security.';
comment on table public.blendcalc_api_scope_policies is
	'Service-only operation-to-scope policy protected by forced row level security.';
