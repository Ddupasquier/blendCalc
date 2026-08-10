create or replace function public.get_blendcalc_product_v1(
	p_barcode text
)
returns table (
	id uuid,
	barcode text,
	product_name text,
	brand_owner text,
	category_option_id text,
	compatibility_summary jsonb,
	canonical_provenance jsonb,
	food jsonb,
	source text,
	source_reference text,
	confidence text,
	created_at timestamptz,
	updated_at timestamptz,
	last_verified_at timestamptz,
	current_revision_id uuid,
	current_revision_number integer,
	revision_created_at timestamptz,
	label_observed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
	select
		product.id,
		product.barcode,
		product.product_name,
		product.brand_owner,
		product.category_option_id,
		product.compatibility_summary,
		product.canonical_provenance,
		product.food,
		product.source,
		product.source_reference,
		product.confidence,
		product.created_at,
		product.updated_at,
		product.last_verified_at,
		revision.id,
		revision.revision_number,
		revision.created_at,
		revision.label_observed_at
	from public.shared_products product
	left join lateral (
		select
			product_revision.id,
			product_revision.revision_number,
			product_revision.created_at,
			product_revision.label_observed_at
		from public.shared_product_revisions product_revision
		where product_revision.shared_product_id = product.id
		order by product_revision.revision_number desc
		limit 1
	) revision on true
	where product.status = 'active'
		and product.barcode = p_barcode
	limit 1;
$$;

create or replace function public.search_blendcalc_products_v1(
	p_query text,
	p_terms text[],
	p_limit integer default 15,
	p_offset integer default 0
)
returns table (
	id uuid,
	barcode text,
	product_name text,
	brand_owner text,
	category_option_id text,
	compatibility_summary jsonb,
	canonical_provenance jsonb,
	food jsonb,
	source text,
	source_reference text,
	confidence text,
	created_at timestamptz,
	updated_at timestamptz,
	last_verified_at timestamptz,
	current_revision_id uuid,
	current_revision_number integer,
	revision_created_at timestamptz,
	label_observed_at timestamptz,
	total_count bigint
)
language sql
stable
security definer
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
			product.id,
			product.barcode,
			product.product_name,
			product.brand_owner,
			product.category_option_id,
			product.compatibility_summary,
			product.canonical_provenance,
			product.food,
			product.source,
			product.source_reference,
			product.confidence,
			product.created_at,
			product.updated_at,
			product.last_verified_at,
			revision.id as current_revision_id,
			revision.revision_number as current_revision_number,
			revision.created_at as revision_created_at,
			revision.label_observed_at,
			case
				when product_text.name_text = input.normalized_query then 0
				when strpos(product_text.name_text, input.normalized_query) = 1 then 1
				when not exists (
					select 1
					from unnest(input.terms) term
					where strpos(product_text.early_name_text, term) = 0
				) then 2
				when strpos(product_text.name_text, input.normalized_query) > 0 then 3
				else 4
			end as relevance_tier,
			coalesce((
				select min(nullif(strpos(product_text.name_text, term), 0))
				from unnest(input.terms) term
			), 2147483647) as first_match_position
		from public.shared_products product
		cross join input
		cross join lateral (
			select
				lower(product.product_name) as name_text,
				array_to_string(
					(regexp_split_to_array(lower(product.product_name), '[^[:alnum:]]+'))[1:3],
					' '
				) as early_name_text
		) product_text
		left join lateral (
			select
				product_revision.id,
				product_revision.revision_number,
				product_revision.created_at,
				product_revision.label_observed_at
			from public.shared_product_revisions product_revision
			where product_revision.shared_product_id = product.id
			order by product_revision.revision_number desc
			limit 1
		) revision on true
		where product.status = 'active'
			and cardinality(input.terms) > 0
			and not exists (
				select 1
				from unnest(input.terms) term
				where strpos(
					lower(coalesce(product.search_text, product.product_name, '')),
					term
				) = 0
			)
	),
	counted as (
		select ranked.*, count(*) over () as total_count
		from ranked
	)
	select
		counted.id,
		counted.barcode,
		counted.product_name,
		counted.brand_owner,
		counted.category_option_id,
		counted.compatibility_summary,
		counted.canonical_provenance,
		counted.food,
		counted.source,
		counted.source_reference,
		counted.confidence,
		counted.created_at,
		counted.updated_at,
		counted.last_verified_at,
		counted.current_revision_id,
		counted.current_revision_number,
		counted.revision_created_at,
		counted.label_observed_at,
		counted.total_count
	from counted
	order by
		counted.relevance_tier,
		counted.first_match_position,
		counted.product_name,
		counted.id
	limit (select result_limit from input)
	offset (select result_offset from input);
$$;

revoke all on function public.get_blendcalc_product_v1(text)
	from public, anon;
revoke all on function public.search_blendcalc_products_v1(text, text[], integer, integer)
	from public, anon;

grant execute on function public.get_blendcalc_product_v1(text)
	to authenticated, service_role;
grant execute on function public.search_blendcalc_products_v1(text, text[], integer, integer)
	to authenticated, service_role;
