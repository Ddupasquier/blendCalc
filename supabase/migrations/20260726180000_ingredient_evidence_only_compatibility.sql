delete from public.product_compatibility_facts
where source_type = 'source_food_identity';

delete from public.food_compatibility_match_rules
where field_name <> 'ingredients'
	or source_type <> 'label_ingredient_field';

alter table public.food_compatibility_match_rules
	drop constraint if exists food_compatibility_match_rules_field_name_check,
	drop constraint if exists food_compatibility_match_rules_source_type_check;

alter table public.food_compatibility_match_rules
	add constraint food_compatibility_match_rules_field_name_check
		check (field_name = 'ingredients'),
	add constraint food_compatibility_match_rules_source_type_check
		check (source_type = 'label_ingredient_field');

alter table public.product_compatibility_facts
	drop constraint if exists product_compatibility_facts_source_type_check;

alter table public.product_compatibility_facts
	add constraint product_compatibility_facts_source_type_check
	check (
		source_type in (
			'shared_product_metadata',
			'shared_observation_metadata',
			'shared_submission_metadata',
			'label_allergen_field',
			'label_trace_field',
			'label_dietary_field',
			'label_ingredient_field'
		)
	);

create or replace function public.refresh_shared_product_compatibility_match_facts(
	p_shared_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_product public.shared_products%rowtype;
begin
	select *
	into v_product
	from public.shared_products
	where id = p_shared_product_id;

	delete from public.product_compatibility_facts
	where shared_product_id = p_shared_product_id
		and source_type = 'label_ingredient_field';

	if v_product.id is null
		or v_product.food is null
		or jsonb_typeof(v_product.food) <> 'object' then
		return;
	end if;

	insert into public.product_compatibility_facts (
		shared_product_id,
		tag_id,
		fact_type,
		source_type,
		source_text,
		confidence
	)
	select distinct
		v_product.id,
		rule.tag_id,
		rule.fact_type,
		rule.source_type,
		match.source_text,
		rule.confidence
	from public.food_compatibility_match_rules rule
	cross join lateral (
		select public.compatibility_first_regex_match(
			v_product.food ->> 'ingredients',
			rule.match_pattern
		) as source_text
	) match
	where rule.enabled
		and rule.field_name = 'ingredients'
		and rule.source_type = 'label_ingredient_field'
		and match.source_text is not null
		and (
			rule.exclude_pattern is null
			or public.compatibility_first_regex_match(
				v_product.food ->> 'ingredients',
				rule.exclude_pattern
			) is null
		)
		and (
			rule.source_key is null
			or rule.source_key = coalesce(
				nullif(v_product.food ->> 'sourceKey', ''),
				nullif(v_product.source, '')
			)
		);
end;
$$;

select public.refresh_shared_product_compatibility_match_facts(product.id)
from public.shared_products product
where product.status = 'active';

delete from public.app_issue_codes
where code in ('FOOD_IDENTITY_CONFIRMED', 'FOOD_IDENTITY_POSSIBLE');

comment on table public.food_compatibility_match_rules is
	'Reviewed ingredient-statement rules used to create compatibility facts. Product names and categories are never warning evidence.';

revoke all on function public.refresh_shared_product_compatibility_match_facts(uuid)
	from public, anon, authenticated;
grant execute on function public.refresh_shared_product_compatibility_match_facts(uuid)
	to service_role;
