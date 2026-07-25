create or replace function public.compatibility_first_regex_match(
	p_value text,
	p_pattern text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_match text[];
begin
	if nullif(btrim(p_value), '') is null
		or nullif(btrim(p_pattern), '') is null then
		return null;
	end if;

	begin
		v_match := regexp_match(p_value, p_pattern, 'i');
	exception
		when invalid_regular_expression then
			return null;
	end;

	return v_match[1];
end;
$$;

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
			rule.source_key is null
			or rule.source_key = coalesce(
				nullif(v_product.food ->> 'sourceKey', ''),
				nullif(v_product.source, '')
			)
		);
end;
$$;

create or replace function public.sync_shared_product_compatibility_match_facts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	perform public.refresh_shared_product_compatibility_match_facts(new.id);
	return new;
end;
$$;

drop trigger if exists sync_shared_product_rule_compatibility_from_food
	on public.shared_products;
create trigger sync_shared_product_rule_compatibility_from_food
	after insert or update of food, source on public.shared_products
	for each row
	execute function public.sync_shared_product_compatibility_match_facts();

select public.refresh_shared_product_compatibility_match_facts(product.id)
from public.shared_products product
where product.status = 'active';

revoke all on function public.compatibility_first_regex_match(text, text)
	from public, anon, authenticated;
revoke all on function public.refresh_shared_product_compatibility_match_facts(uuid)
	from public, anon, authenticated;
revoke all on function public.sync_shared_product_compatibility_match_facts()
	from public, anon, authenticated;

grant execute on function public.refresh_shared_product_compatibility_match_facts(uuid)
	to service_role;
