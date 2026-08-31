alter table blendcalc_api.publication_products
	add column category_search_text text not null default '';

create or replace view blendcalc_api.active_publication_products
with (security_invoker = true)
as
select product.*
from blendcalc_api.publication_products product
join blendcalc_api.publication_generations generation
	on generation.id = product.generation_id
where generation.status = 'active';

create function blendcalc_api.search_publication_generation_products(
	p_generation_id uuid,
	p_query text,
	p_terms text[],
	p_limit integer default 15,
	p_offset integer default 0
)
returns table (
	search_payload jsonb,
	total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
	with input as (
		select
			lower(btrim(p_query)) as normalized_query,
			array(
				select distinct lower(btrim(term))
				from unnest(coalesce(p_terms, array[]::text[])) term
				where btrim(term) <> ''
			) as terms,
			greatest(1, least(coalesce(p_limit, 15), 50)) as result_limit,
			greatest(0, least(coalesce(p_offset, 0), 1000)) as result_offset
	),
	ranked as (
		select
			product.search_payload,
			product.product_name,
			product.source_product_id,
			case
				when lower(product.product_name) = input.normalized_query then 0
				when strpos(lower(product.product_name), input.normalized_query) = 1 then 1
				when not exists (
					select 1 from unnest(input.terms) term
					where strpos(lower(product.product_name), term) = 0
				) then 2
				when not exists (
					select 1 from unnest(input.terms) term
					where strpos(lower(coalesce(product.brand_owner, '')), term) = 0
				) then 3
				when not exists (
					select 1 from unnest(input.terms) term
					where strpos(product.category_search_text, term) = 0
				) then 4
				else 5
			end as relevance_tier,
			coalesce((
				select min(nullif(strpos(product.search_text, term), 0))
				from unnest(input.terms) term
			), 2147483647) as first_match_position
		from blendcalc_api.publication_products product
		cross join input
		where product.generation_id = p_generation_id
			and cardinality(input.terms) > 0
			and not exists (
				select 1 from unnest(input.terms) term
				where strpos(product.search_text, term) = 0
			)
	),
	counted as (
		select ranked.*, count(*) over () as total_count
		from ranked
	)
	select counted.search_payload, counted.total_count
	from counted
	order by
		counted.relevance_tier,
		counted.first_match_position,
		counted.product_name,
		counted.source_product_id
	limit (select result_limit from input)
	offset (select result_offset from input);
$$;

create function blendcalc_api.search_active_publication_products(
	p_query text,
	p_terms text[],
	p_limit integer default 15,
	p_offset integer default 0
)
returns table (
	search_payload jsonb,
	total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
	select search_result.search_payload, search_result.total_count
	from blendcalc_api.publication_generations generation
	cross join lateral blendcalc_api.search_publication_generation_products(
		generation.id,
		p_query,
		p_terms,
		p_limit,
		p_offset
	) search_result
	where generation.status = 'active';
$$;

revoke all on function blendcalc_api.search_publication_generation_products(
	uuid,
	text,
	text[],
	integer,
	integer
) from public, anon, authenticated;
grant execute on function blendcalc_api.search_publication_generation_products(
	uuid,
	text,
	text[],
	integer,
	integer
) to service_role;
revoke all on function blendcalc_api.search_active_publication_products(
	text,
	text[],
	integer,
	integer
) from public, anon, authenticated;
grant execute on function blendcalc_api.search_active_publication_products(
	text,
	text[],
	integer,
	integer
) to service_role;

comment on function blendcalc_api.search_active_publication_products(
	text,
	text[],
	integer,
	integer
) is 'Searches only the atomically active blendCalcAPI publication generation with source-equivalent ordering.';

comment on function blendcalc_api.search_publication_generation_products(
	uuid,
	text,
	text[],
	integer,
	integer
) is 'Searches one complete candidate generation so parity can be proven before activation.';
