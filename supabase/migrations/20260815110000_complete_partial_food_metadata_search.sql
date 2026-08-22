create or replace function public.food_metadata_search_text(p_food jsonb)
returns text
language sql
stable
set search_path = public
as $$
	select lower(concat_ws(
		' ',
		p_food ->> 'description',
		p_food ->> 'canonicalDescription',
		p_food ->> 'alternateDescription',
		p_food ->> 'scientificName',
		p_food ->> 'brandOwner',
		p_food ->> 'foodCategory',
		p_food ->> 'brandedFoodCategory',
		p_food ->> 'preparation',
		p_food ->> 'marketCountry',
		p_food ->> 'packageWeight',
		p_food ->> 'householdServingFullText',
		p_food ->> 'barcode',
		p_food ->> 'gtinUpc',
		p_food -> 'packageQuantity' ->> 'label',
		p_food -> 'packageQuantity' ->> 'amount',
		p_food -> 'packageQuantity' ->> 'unit',
		(
			select string_agg(identifier.value, ' ')
			from jsonb_each_text(
				case
					when jsonb_typeof(p_food -> 'sourceIdentifiers') = 'object'
						then p_food -> 'sourceIdentifiers'
					else '{}'::jsonb
				end
			) identifier
		),
		p_food ->> 'ingredients',
		public.jsonb_text_array_search_text(p_food -> 'ingredientList'),
		public.jsonb_text_array_search_text(
			jsonb_path_query_array(
				case
					when jsonb_typeof(p_food -> 'structuredIngredients') = 'array'
						then p_food -> 'structuredIngredients'
					else '[]'::jsonb
				end,
				'strict $[*].**.text'
			)
		),
		public.jsonb_text_array_search_text(
			jsonb_path_query_array(
				case
					when jsonb_typeof(p_food -> 'structuredIngredients') = 'array'
						then p_food -> 'structuredIngredients'
					else '[]'::jsonb
				end,
				'strict $[*].**.id'
			)
		),
		public.jsonb_text_array_search_text(
			p_food -> 'ingredientAnalysis' -> 'ingredientTags'
		),
		public.jsonb_text_array_search_text(
			p_food -> 'ingredientAnalysis' -> 'analysisTags'
		),
		public.jsonb_text_array_search_text(
			p_food -> 'ingredientAnalysis' -> 'derivedTraceTags'
		),
		public.jsonb_text_array_search_text(p_food -> 'additives'),
		public.jsonb_text_array_search_text(p_food -> 'allergens'),
		public.jsonb_text_array_search_text(p_food -> 'traces'),
		public.jsonb_text_array_search_text(
			p_food -> 'allergenDisclosure' -> 'contains'
		),
		public.jsonb_text_array_search_text(
			p_food -> 'allergenDisclosure' -> 'mayContain'
		),
		public.jsonb_text_array_search_text(
			jsonb_path_query_array(
				case
					when jsonb_typeof(p_food -> 'precautionaryStatements') = 'array'
						then p_food -> 'precautionaryStatements'
					else '[]'::jsonb
				end,
				'$[*].text'
			)
		),
		public.jsonb_text_array_search_text(
			jsonb_path_query_array(
				case
					when jsonb_typeof(p_food -> 'precautionaryStatements') = 'array'
						then p_food -> 'precautionaryStatements'
					else '[]'::jsonb
				end,
				'$[*].allergens[*]'
			)
		),
		public.jsonb_text_array_search_text(p_food -> 'dietaryTags'),
		public.jsonb_text_array_search_text(p_food -> 'labels'),
		public.jsonb_text_array_search_text(p_food -> 'categories'),
		public.jsonb_text_array_search_text(p_food -> 'sourceCategories'),
		public.jsonb_text_array_search_text(
			jsonb_path_query_array(
				case
					when jsonb_typeof(p_food -> 'foodServings') = 'array'
						then p_food -> 'foodServings'
					else '[]'::jsonb
				end,
				'$[*].label'
			)
		),
		public.jsonb_text_array_search_text(
			jsonb_path_query_array(
				case
					when jsonb_typeof(p_food -> 'foodServings') = 'array'
						then p_food -> 'foodServings'
					else '[]'::jsonb
				end,
				'$[*].measureType'
			)
		),
		p_food -> 'sourceMetadata' ->> 'language',
		public.jsonb_text_array_search_text(
			p_food -> 'sourceMetadata' -> 'languages'
		),
		public.jsonb_text_array_search_text(
			p_food -> 'sourceMetadata' -> 'marketCountries'
		)
	));
$$;

update public.shared_products product
set search_text = lower(concat_ws(
	' ',
	product.product_name,
	product.brand_owner,
	product.barcode,
	public.food_metadata_search_text(product.food)
));

update public.custom_foods custom_food
set search_text = lower(concat_ws(
	' ',
	custom_food.barcode,
	custom_food.name_key,
	public.food_metadata_search_text(custom_food.food)
));

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
				when searchable_text.name_text = input.normalized_query then 0
				when strpos(searchable_text.name_text, input.normalized_query) = 1 then 1
				when not exists (
					select 1
					from unnest(input.terms) term
					where strpos(searchable_text.name_text, term) = 0
				) then 2
				when not exists (
					select 1
					from unnest(input.terms) term
					where strpos(searchable_text.brand_text, term) = 0
				) then 3
				when not exists (
					select 1
					from unnest(input.terms) term
					where strpos(searchable_text.category_text, term) = 0
				) then 4
				else 5
			end as relevance_tier,
			coalesce((
				select min(nullif(strpos(searchable_text.all_text, term), 0))
				from unnest(input.terms) term
			), 2147483647) as first_match_position
		from public.shared_products product
		cross join input
		cross join lateral (
			select
				lower(coalesce(product.product_name, '')) as name_text,
				lower(coalesce(product.brand_owner, '')) as brand_text,
				lower(concat_ws(
					' ',
					product.food ->> 'foodCategory',
					product.food ->> 'brandedFoodCategory',
					public.jsonb_text_array_search_text(
						product.food -> 'categories'
					),
					public.jsonb_text_array_search_text(
						product.food -> 'sourceCategories'
					)
				)) as category_text,
				lower(coalesce(
					product.search_text,
					product.product_name,
					''
				)) as all_text
		) searchable_text
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
			and cardinality(
				public.blendcalc_api_v1_product_readiness_reasons(product.id)
			) = 0
			and cardinality(input.terms) > 0
			and not exists (
				select 1
				from unnest(input.terms) term
				where strpos(searchable_text.all_text, term) = 0
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

comment on function public.food_metadata_search_text(jsonb) is
	'Builds normalized candidate text from user-meaningful food identity, category, package, serving, ingredient, allergen, label, and market metadata.';

comment on function public.search_blendcalc_products_v1(text, text[], integer, integer) is
	'Searches publication-ready API v1 products with partial term matching and field-aware name, brand, category, then supporting-metadata relevance.';
