alter function public.extract_product_compatibility_facts(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
)
	rename to extract_product_compatibility_facts_pre_precautionary_dedupe;

create function public.extract_product_compatibility_facts(
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
	perform public.extract_product_compatibility_facts_pre_precautionary_dedupe(
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

revoke all on function public.extract_product_compatibility_facts_pre_precautionary_dedupe(
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

select public.extract_product_compatibility_facts(
	product.id,
	null,
	null,
	product.food,
	'shared_product_metadata'
)
from public.shared_products product;

select public.extract_product_compatibility_facts(
	null,
	observation.id,
	null,
	coalesce(observation.normalized_food, '{}'::jsonb),
	'shared_observation_metadata'
)
from public.shared_product_observations observation;

select public.extract_product_compatibility_facts(
	null,
	null,
	submission.id,
	coalesce(submission.food, '{}'::jsonb),
	'shared_submission_metadata'
)
from public.shared_product_submissions submission;

comment on function public.extract_product_compatibility_facts(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) is
	'Extracts policy-versioned compatibility facts and retains the exact linked precautionary statement when a flat trace field reports the same allergen.';
