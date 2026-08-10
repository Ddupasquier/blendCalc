alter table public.food_compatibility_match_rules
	add column exclude_pattern text
		check (
			exclude_pattern is null
			or nullif(btrim(exclude_pattern), '') is not null
		);

comment on column public.food_compatibility_match_rules.exclude_pattern is
	'Optional regular expression that suppresses a match when the same source field explicitly contradicts the rule.';

with rule_values (
	tag_slug,
	source_key,
	field_name,
	match_pattern,
	exclude_pattern,
	fact_type,
	source_type,
	confidence,
	priority
) as (
	values
		(
			'wheat',
			null,
			'description',
			'\b(?:bread|stuffing|ramen|noodles?|pasta|spaghetti|macaroni|couscous|crackers?|cookies?|cakes?|pastr(?:y|ies)|bagels?|wheat)\b',
			'\b(?:gluten[\s-]*free|wheat[\s-]*free|rice (?:ramen|noodles?|pasta)|(?:bean|chickpea|lentil) pasta|corn tortillas?)\b',
			'ingredient_present',
			'source_food_identity',
			'inferred',
			130
		),
		(
			'gluten',
			null,
			'description',
			'\b(?:barley|rye|malt)\b',
			'\b(?:gluten[\s-]*free|barley[\s-]*free|rye[\s-]*free|malt[\s-]*free)\b',
			'ingredient_present',
			'source_food_identity',
			'inferred',
			140
		)
)
insert into public.food_compatibility_match_rules (
	tag_id,
	source_key,
	field_name,
	match_pattern,
	exclude_pattern,
	fact_type,
	source_type,
	confidence,
	priority
)
select
	tag.id,
	rule_values.source_key,
	rule_values.field_name,
	rule_values.match_pattern,
	rule_values.exclude_pattern,
	rule_values.fact_type,
	rule_values.source_type,
	rule_values.confidence,
	rule_values.priority
from rule_values
join public.compatibility_tags tag
	on tag.slug = rule_values.tag_slug
on conflict (
	tag_id,
	source_key,
	field_name,
	match_pattern,
	fact_type
) do update
set
	exclude_pattern = excluded.exclude_pattern,
	source_type = excluded.source_type,
	confidence = excluded.confidence,
	priority = excluded.priority,
	enabled = true,
	updated_at = now();

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
		and source_type in ('label_ingredient_field', 'source_food_identity');

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
		select case rule.field_name
			when 'description' then coalesce(
				nullif(v_product.food ->> 'description', ''),
				v_product.product_name
			)
			when 'food_category' then coalesce(
				nullif(v_product.food ->> 'foodCategory', ''),
				nullif(v_product.food ->> 'brandedFoodCategory', '')
			)
			when 'ingredients' then v_product.food ->> 'ingredients'
			else null
		end as field_value
	) field
	cross join lateral (
		select public.compatibility_first_regex_match(
			field.field_value,
			rule.match_pattern
		) as source_text
	) match
	where rule.enabled
		and match.source_text is not null
		and (
			rule.exclude_pattern is null
			or public.compatibility_first_regex_match(
				field.field_value,
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

revoke all on function public.refresh_shared_product_compatibility_match_facts(uuid)
	from public, anon, authenticated;
grant execute on function public.refresh_shared_product_compatibility_match_facts(uuid)
	to service_role;
