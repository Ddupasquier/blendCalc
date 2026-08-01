create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

alter function public.extract_product_compatibility_facts_pre_multilingual(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
)
	set schema private;

alter function public.extract_product_compatibility_facts_base(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
)
	set schema private;

alter function public.extract_product_compatibility_facts_unlinked(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
)
	set schema private;

alter function public.extract_product_compatibility_facts_pre_precautionary_dedupe(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
)
	set schema private;

do $$
declare
	v_definition text;
begin
	v_definition := pg_get_functiondef(
		'private.extract_product_compatibility_facts_pre_precautionary_dedupe(uuid,uuid,uuid,jsonb,text)'::regprocedure
	);
	v_definition := replace(
		v_definition,
		'public.extract_product_compatibility_facts_pre_multilingual',
		'private.extract_product_compatibility_facts_pre_multilingual'
	);
	execute v_definition;

	v_definition := pg_get_functiondef(
		'private.extract_product_compatibility_facts_pre_multilingual(uuid,uuid,uuid,jsonb,text)'::regprocedure
	);
	v_definition := replace(
		v_definition,
		'public.extract_product_compatibility_facts_base',
		'private.extract_product_compatibility_facts_base'
	);
	execute v_definition;

	v_definition := pg_get_functiondef(
		'private.extract_product_compatibility_facts_base(uuid,uuid,uuid,jsonb,text)'::regprocedure
	);
	v_definition := replace(
		v_definition,
		'public.extract_product_compatibility_facts_unlinked',
		'private.extract_product_compatibility_facts_unlinked'
	);
	execute v_definition;
end;
$$;

create or replace function public.extract_product_compatibility_facts(
	p_shared_product_id uuid default null,
	p_shared_product_observation_id uuid default null,
	p_shared_product_submission_id uuid default null,
	p_food jsonb default '{}'::jsonb,
	p_parent_source text default 'shared_product_metadata'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	perform private.extract_product_compatibility_facts_pre_precautionary_dedupe(
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id,
		p_food,
		p_parent_source
	);

	delete from public.product_compatibility_facts duplicate
	where duplicate.shared_product_id is not distinct from p_shared_product_id
		and duplicate.shared_product_observation_id is not distinct from
			p_shared_product_observation_id
		and duplicate.shared_product_submission_id is not distinct from
			p_shared_product_submission_id
		and duplicate.fact_type = 'may_contain'
		and duplicate.source_type = 'label_trace_field'
		and duplicate.precautionary_statement_id is null
		and exists (
			select 1
			from public.product_compatibility_facts exact_fact
			where exact_fact.shared_product_id is not distinct from
				duplicate.shared_product_id
				and exact_fact.shared_product_observation_id is not distinct from
					duplicate.shared_product_observation_id
				and exact_fact.shared_product_submission_id is not distinct from
					duplicate.shared_product_submission_id
				and exact_fact.tag_id = duplicate.tag_id
				and exact_fact.fact_type = duplicate.fact_type
				and exact_fact.source_type = duplicate.source_type
				and exact_fact.precautionary_statement_id is not null
		);

	if p_shared_product_id is not null then
		perform public.rebuild_shared_product_compatibility_summary(
			p_shared_product_id
		);
	end if;
end;
$$;

revoke all on function private.extract_product_compatibility_facts_pre_precautionary_dedupe(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) from public, anon, authenticated;
revoke all on function private.extract_product_compatibility_facts_pre_multilingual(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) from public, anon, authenticated;
revoke all on function private.extract_product_compatibility_facts_base(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) from public, anon, authenticated;
revoke all on function private.extract_product_compatibility_facts_unlinked(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) from public, anon, authenticated;
revoke all on function public.extract_product_compatibility_facts(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) from public, anon, authenticated;
grant execute on function public.extract_product_compatibility_facts(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) to service_role;

comment on schema private is
	'Internal database implementation objects that must not enter the public Data API contract.';
comment on function private.extract_product_compatibility_facts_pre_precautionary_dedupe(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) is
	'Private predecessor used by the public compatibility extraction boundary.';
comment on function private.extract_product_compatibility_facts_pre_multilingual(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) is
	'Private predecessor used by the multilingual compatibility extraction implementation.';
comment on function private.extract_product_compatibility_facts_base(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) is
	'Private predecessor used by lossless precautionary compatibility extraction.';
comment on function private.extract_product_compatibility_facts_unlinked(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) is
	'Private predecessor used by relational ingredient compatibility extraction.';
