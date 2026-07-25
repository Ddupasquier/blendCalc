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
	v_postgres_pattern text;
begin
	if nullif(btrim(p_value), '') is null
		or nullif(btrim(p_pattern), '') is null then
		return null;
	end if;

	v_postgres_pattern := replace(p_pattern, '\b', '\y');

	begin
		v_match := regexp_match(p_value, v_postgres_pattern, 'i');
	exception
		when invalid_regular_expression then
			return null;
	end;

	return v_match[1];
end;
$$;

select public.refresh_shared_product_compatibility_match_facts(product.id)
from public.shared_products product
where product.status = 'active';

revoke all on function public.compatibility_first_regex_match(text, text)
	from public, anon, authenticated;
