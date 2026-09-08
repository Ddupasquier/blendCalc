create table public.food_category_resolution_guidance (
	source_normalized_value text primary key check (btrim(source_normalized_value) <> ''),
	disposition text not null check (
		disposition in ('specific', 'eligible', 'generic', 'excluded')
	),
	specificity_rank integer not null default 100 check (
		specificity_rank between 0 and 1000
	),
	selection_reason text not null check (btrim(selection_reason) <> ''),
	review_reference text not null check (btrim(review_reference) <> ''),
	reviewed_at timestamptz not null,
	enabled boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index food_category_resolution_guidance_rank_idx
	on public.food_category_resolution_guidance (
		disposition,
		specificity_rank desc
	)
	where enabled;

create trigger set_food_category_resolution_guidance_updated_at
	before update on public.food_category_resolution_guidance
	for each row execute function public.set_updated_at();

alter table public.food_category_resolution_guidance enable row level security;
alter table public.food_category_resolution_guidance force row level security;

create policy "Authenticated users can read category resolution guidance"
	on public.food_category_resolution_guidance
	for select
	to authenticated
	using (enabled);

revoke all on table public.food_category_resolution_guidance
	from public, anon, authenticated;
grant select on table public.food_category_resolution_guidance to authenticated;
grant all on table public.food_category_resolution_guidance to service_role;

insert into public.food_category_resolution_guidance (
	source_normalized_value,
	disposition,
	specificity_rank,
	selection_reason,
	review_reference,
	reviewed_at
)
values
	('chocolate sauce', 'specific', 300, 'specific source-observed product type', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('gochujang', 'specific', 300, 'specific source-observed product type', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('dessert sauces', 'specific', 270, 'specific source-observed product type', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('sweet spreads', 'specific', 270, 'specific source-observed product type', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('hot sauces', 'specific', 260, 'specific source-observed product type', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('confectionary based spreads', 'specific', 250, 'specific source-observed product type', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('syrups', 'specific', 230, 'specific source-observed product type', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('dips and salsa', 'eligible', 100, 'usable exact source category', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('sauces', 'generic', 60, 'broad source category retained only as a fallback', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('spreads', 'generic', 60, 'broad source category retained only as a fallback', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('sweets', 'generic', 60, 'broad source category retained only as a fallback', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('dressings and sauces', 'generic', 40, 'broad source food group retained only as a fallback', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('sugary snacks', 'generic', 40, 'broad source food group retained only as a fallback', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('condiments', 'generic', 30, 'broad source hierarchy retained only as a fallback', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('breakfasts', 'generic', 30, 'broad source hierarchy retained only as a fallback', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('groceries', 'excluded', 0, 'provider navigation bucket is not a food category', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('foods', 'excluded', 0, 'provider root bucket is not a food category', 'QA-040-008', '2026-09-06T19:00:00Z'),
	('food products', 'excluded', 0, 'provider root bucket is not a food category', 'QA-040-008', '2026-09-06T19:00:00Z')
on conflict (source_normalized_value) do update set
	disposition = excluded.disposition,
	specificity_rank = excluded.specificity_rank,
	selection_reason = excluded.selection_reason,
	review_reference = excluded.review_reference,
	reviewed_at = excluded.reviewed_at,
	enabled = true,
	updated_at = now();

-- Presentation grouping remains separate from the primary product category.
-- These rules select an icon family without flattening the category label.
insert into public.food_symbol_category_rules (
	symbol_key,
	match_pattern,
	priority,
	enabled,
	source_key,
	source_reference,
	match_scopes
)
values
	(
		'sauces-condiments',
		'^(chocolate sauce|dessert sauces?|gochujang|hot sauces?|sauces?|syrups?)$',
		10105,
		true,
		'blendcalc-nutrition-policy',
		'QA-040-008 evidence-bounded category presentation family',
		array['category']::text[]
	),
	(
		'spreads-preserves',
		'^(spreads?|sweet spreads?)$',
		10105,
		true,
		'blendcalc-nutrition-policy',
		'QA-040-008 evidence-bounded category presentation family',
		array['category']::text[]
	)
on conflict (symbol_key, match_pattern) do update set
	priority = excluded.priority,
	enabled = excluded.enabled,
	source_key = excluded.source_key,
	source_reference = excluded.source_reference,
	match_scopes = excluded.match_scopes,
	updated_at = now();

-- Preserve the exact Open Food Facts category evidence that exposed the
-- over-broad Hershey syrup classification. These are candidates, not aliases
-- for a BlendCalc-authored category family.
insert into public.custom_food_category_observations (
	category_id,
	label,
	normalized_value,
	source,
	query,
	source_field,
	source_value,
	source_reference,
	source_payload,
	observation_count,
	first_seen_at,
	last_seen_at
)
values
	(
		'dessert-sauces',
		'Dessert Sauces',
		'dessert sauces',
		'open-food-facts',
		'QA-040-008 exact product verification',
		'categories_tags',
		'en:dessert-sauces',
		'0034000003129',
		'{"product_name":"HERSHEYS SYRUP CHOC","categories_tags":["en:condiments","en:syrups","en:sauces","en:dessert-sauces","en:chocolate-sauce","en:Groceries"]}'::jsonb,
		1,
		'2026-09-06T19:00:00Z',
		'2026-09-06T19:00:00Z'
	),
	(
		'chocolate-sauce',
		'Chocolate Sauce',
		'chocolate sauce',
		'open-food-facts',
		'QA-040-008 exact product verification',
		'categories_tags',
		'en:chocolate-sauce',
		'0034000003129',
		'{"product_name":"HERSHEYS SYRUP CHOC","categories_tags":["en:condiments","en:syrups","en:sauces","en:dessert-sauces","en:chocolate-sauce","en:Groceries"]}'::jsonb,
		1,
		'2026-09-06T19:00:00Z',
		'2026-09-06T19:00:00Z'
	)
on conflict (
	source,
	query,
	source_field,
	normalized_value,
	source_reference
) do update set
	source_value = excluded.source_value,
	source_payload = excluded.source_payload,
	observation_count = greatest(
		public.custom_food_category_observations.observation_count,
		excluded.observation_count
	),
	last_seen_at = greatest(
		public.custom_food_category_observations.last_seen_at,
		excluded.last_seen_at
	),
	updated_at = now();

insert into public.custom_food_category_options (
	id,
	label,
	normalized_value,
	sources,
	source_count,
	observation_count,
	verification_status,
	enabled,
	first_seen_at,
	last_seen_at,
	symbol_key
)
values
	('dessert-sauces', 'Dessert Sauces', 'dessert sauces', array['open-food-facts'], 1, 1, 'single_source', true, '2026-09-06T19:00:00Z', '2026-09-06T19:00:00Z', 'sauces-condiments'),
	('chocolate-sauce', 'Chocolate Sauce', 'chocolate sauce', array['open-food-facts'], 1, 1, 'single_source', true, '2026-09-06T19:00:00Z', '2026-09-06T19:00:00Z', 'sauces-condiments')
on conflict (id) do update set
	label = excluded.label,
	normalized_value = excluded.normalized_value,
	sources = array(
		select distinct source
		from unnest(public.custom_food_category_options.sources || excluded.sources) source
		order by source
	),
	source_count = greatest(public.custom_food_category_options.source_count, excluded.source_count),
	observation_count = greatest(public.custom_food_category_options.observation_count, excluded.observation_count),
	enabled = true,
	last_seen_at = greatest(public.custom_food_category_options.last_seen_at, excluded.last_seen_at),
	symbol_key = excluded.symbol_key,
	updated_at = now();

update public.custom_food_category_options
set symbol_key = public.resolve_food_symbol_key_for_category(normalized_value)
where normalized_value in (
	'chocolate sauce',
	'dessert sauces',
	'gochujang',
	'hot sauces',
	'sauces',
	'spreads',
	'sweet spreads',
	'syrups'
);

insert into public.custom_food_category_mappings (
	source_normalized_value,
	source_value,
	source_values,
	source_fields,
	sources,
	category_option_id,
	category_option_label,
	confidence,
	match_reason,
	source_count,
	observation_count,
	first_seen_at,
	last_seen_at
)
values
	('dessert sauces', 'en:dessert-sauces', array['en:dessert-sauces'], array['categories_tags'], array['open-food-facts'], 'dessert-sauces', 'Dessert Sauces', 'exact', 'exact_api_observation', 1, 1, '2026-09-06T19:00:00Z', '2026-09-06T19:00:00Z'),
	('chocolate sauce', 'en:chocolate-sauce', array['en:chocolate-sauce'], array['categories_tags'], array['open-food-facts'], 'chocolate-sauce', 'Chocolate Sauce', 'exact', 'exact_api_observation', 1, 1, '2026-09-06T19:00:00Z', '2026-09-06T19:00:00Z')
on conflict (source_normalized_value) do update set
	source_value = excluded.source_value,
	source_values = excluded.source_values,
	source_fields = excluded.source_fields,
	sources = excluded.sources,
	category_option_id = excluded.category_option_id,
	category_option_label = excluded.category_option_label,
	confidence = excluded.confidence,
	match_reason = excluded.match_reason,
	source_count = greatest(public.custom_food_category_mappings.source_count, excluded.source_count),
	observation_count = greatest(public.custom_food_category_mappings.observation_count, excluded.observation_count),
	last_seen_at = greatest(public.custom_food_category_mappings.last_seen_at, excluded.last_seen_at),
	updated_at = now();

create or replace function public.resolve_custom_food_category_option_with_symbol(
	p_source_values text[]
)
returns table (
	category_option_id text,
	category_option_label text,
	source_normalized_value text,
	confidence text,
	symbol_key text
)
language sql
stable
security invoker
set search_path = ''
as $$
	with source_values as (
		select distinct on (normalized_value)
			public.normalize_food_category_value(source_value) as normalized_value,
			source_order
		from unnest(coalesce(p_source_values, '{}'::text[]))
			with ordinality as source(source_value, source_order)
		where public.normalize_food_category_value(source_value) <> ''
		order by normalized_value, source_order desc
	), direct_candidates as (
		select
			option.id as category_option_id,
			option.label as category_option_label,
			source.normalized_value as source_normalized_value,
			'exact'::text as confidence,
			option.observation_count,
			option.source_count,
			option.verification_status,
			option.symbol_key,
			source.source_order,
			coalesce(guidance.specificity_rank, 100) as specificity_rank,
			coalesce(guidance.disposition, 'eligible') as disposition,
			true as is_direct
		from source_values source
		join public.custom_food_category_options option
			on option.normalized_value = source.normalized_value
			and option.enabled
		left join public.food_category_resolution_guidance guidance
			on guidance.source_normalized_value = source.normalized_value
			and guidance.enabled
		where coalesce(guidance.disposition, 'eligible') <> 'excluded'
	), mapped_candidates as (
		select
			mapping.category_option_id,
			mapping.category_option_label,
			mapping.source_normalized_value,
			mapping.confidence,
			mapping.observation_count,
			mapping.source_count,
			option.verification_status,
			option.symbol_key,
			source.source_order,
			coalesce(guidance.specificity_rank, 100) as specificity_rank,
			coalesce(guidance.disposition, 'eligible') as disposition,
			mapping.source_normalized_value = option.normalized_value as is_direct
		from source_values source
		join public.custom_food_category_mappings mapping
			on mapping.source_normalized_value = source.normalized_value
		join public.custom_food_category_options option
			on option.id = mapping.category_option_id
			and option.enabled
		left join public.food_category_resolution_guidance guidance
			on guidance.source_normalized_value = source.normalized_value
			and guidance.enabled
		where coalesce(guidance.disposition, 'eligible') <> 'excluded'
	), candidates as (
		select * from direct_candidates
		union all
		select * from mapped_candidates
	), ranked as (
		select distinct on (candidate.category_option_id, candidate.source_normalized_value)
			candidate.*
		from candidates candidate
		order by
			candidate.category_option_id,
			candidate.source_normalized_value,
			candidate.is_direct desc,
			candidate.source_order desc
	)
	select
		candidate.category_option_id,
		candidate.category_option_label,
		candidate.source_normalized_value,
		candidate.confidence,
		candidate.symbol_key
	from ranked candidate
	order by
		candidate.specificity_rank desc,
		candidate.is_direct desc,
		case candidate.confidence
			when 'exact' then 4
			when 'strong' then 3
			when 'related' then 2
			else 1
		end desc,
		case candidate.verification_status
			when 'multi_source_verified' then 2
			else 1
		end desc,
		candidate.source_order desc,
		candidate.source_count desc,
		candidate.observation_count desc,
		candidate.category_option_id
	limit 1;
$$;

create or replace function public.resolve_custom_food_category_option(
	p_source_values text[]
)
returns table (
	category_option_id text,
	category_option_label text,
	source_normalized_value text,
	confidence text
)
language sql
stable
security invoker
set search_path = ''
as $$
	select
		resolved.category_option_id,
		resolved.category_option_label,
		resolved.source_normalized_value,
		resolved.confidence
	from public.resolve_custom_food_category_option_with_symbol(p_source_values) resolved;
$$;

revoke all on function public.resolve_custom_food_category_option_with_symbol(text[])
	from public;
grant execute on function public.resolve_custom_food_category_option_with_symbol(text[])
	to authenticated, service_role;
revoke all on function public.resolve_custom_food_category_option(text[])
	from public, anon, authenticated;
grant execute on function public.resolve_custom_food_category_option(text[])
	to authenticated, service_role;

create or replace function private.apply_evidence_bounded_food_category(
	p_food jsonb,
	p_category_option_id text,
	p_category_label text,
	p_symbol_key text
)
returns jsonb
language sql
stable
set search_path = ''
as $$
	with category_values as (
		select p_category_label as value, 0::bigint as source_order
		union all
		select category.value, category.source_order
		from jsonb_array_elements_text(
			case
				when jsonb_typeof(p_food -> 'categories') = 'array'
					then p_food -> 'categories'
				else '[]'::jsonb
			end
		) with ordinality as category(value, source_order)
	), unique_categories as (
		select distinct on (public.normalize_food_category_value(value))
			value,
			source_order
		from category_values
		where public.normalize_food_category_value(value) <> ''
		order by public.normalize_food_category_value(value), source_order
	), categories as (
		select coalesce(jsonb_agg(value order by source_order), '[]'::jsonb) as value
		from unique_categories
	)
	select jsonb_set(
		jsonb_set(
			jsonb_set(
				coalesce(p_food, '{}'::jsonb),
				'{categoryOptionId}',
				to_jsonb(p_category_option_id),
				true
			),
			'{foodCategory}',
			to_jsonb(p_category_label),
			true
		),
		'{symbolKey}',
		to_jsonb(p_symbol_key),
		true
	) || jsonb_build_object('categories', categories.value)
	from categories;
$$;

create or replace function private.repair_provider_food_categories()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_shared_product_count integer;
	v_custom_food_count integer;
begin
	drop table if exists pg_temp.evidence_bounded_shared_category_repairs;
	create temporary table evidence_bounded_shared_category_repairs on commit drop as
	select
		product.id,
		product.approved_submission_id,
		product.food as previous_food,
		product.category_option_id as previous_category_option_id,
		resolved.category_option_id,
		resolved.category_option_label,
		resolved.source_normalized_value,
		resolved.symbol_key
	from public.shared_products product
	cross join lateral public.resolve_custom_food_category_option_with_symbol(
		array(
			select category.value
			from jsonb_array_elements_text(
				case
					when jsonb_typeof(product.food -> 'categories') = 'array'
						then product.food -> 'categories'
					else '[]'::jsonb
				end
			) with ordinality as category(value, source_order)
			order by category.source_order
		)
	) resolved
	join public.food_category_resolution_guidance guidance
		on guidance.source_normalized_value = resolved.source_normalized_value
		and guidance.enabled
		and guidance.disposition = 'specific'
	where product.category_option_id is distinct from resolved.category_option_id
		and exists (
			select 1
			from jsonb_array_elements_text(
				case
					when jsonb_typeof(product.food -> 'categories') = 'array'
						then product.food -> 'categories'
					else '[]'::jsonb
				end
			) category(value)
			where public.normalize_food_category_value(category.value)
				= resolved.source_normalized_value
		)
		and (
			lower(coalesce(product.food #>> '{fieldProvenance,categories,source}', ''))
				in ('usda', 'open-food-facts', 'cola-cloud')
			or (
				product.food #>> '{fieldProvenance,categories,source}' is null
				and lower(coalesce(product.food ->> 'sourceKey', product.source))
					in ('usda', 'open-food-facts', 'cola-cloud')
			)
		);

	update public.shared_product_submissions submission
	set
		category_option_id = repair.category_option_id,
		food = private.apply_evidence_bounded_food_category(
			submission.food,
			repair.category_option_id,
			repair.category_option_label,
			repair.symbol_key
		)
	from pg_temp.evidence_bounded_shared_category_repairs repair
	where submission.id = repair.approved_submission_id;

	update public.shared_products product
	set
		category_option_id = repair.category_option_id,
		food = private.apply_evidence_bounded_food_category(
			product.food,
			repair.category_option_id,
			repair.category_option_label,
			repair.symbol_key
		)
	from pg_temp.evidence_bounded_shared_category_repairs repair
	where product.id = repair.id;

	with latest_revision as (
		select distinct on (revision.shared_product_id)
			revision.shared_product_id,
			revision.id,
			revision.revision_number,
			revision.label_observed_at
		from public.shared_product_revisions revision
		join pg_temp.evidence_bounded_shared_category_repairs repair
			on repair.id = revision.shared_product_id
		order by revision.shared_product_id, revision.revision_number desc
	)
	insert into public.shared_product_revisions (
		shared_product_id,
		revision_number,
		food,
		source,
		source_reference,
		category_option_id,
		supersedes_revision_id,
		change_summary,
		label_observed_at
	)
	select
		product.id,
		coalesce(latest.revision_number, 0) + 1,
		product.food,
		product.source,
		product.source_reference,
		product.category_option_id,
		latest.id,
		jsonb_build_object(
			'audit', 'evidence-bounded-category-resolution',
			'changes', jsonb_build_array(jsonb_build_object(
				'field', 'categories',
				'label', 'Category',
				'changeType', 'changed',
				'previousValue', repair.previous_food -> 'foodCategory',
				'submittedValue', product.food -> 'foodCategory',
				'source', 'QA-040-008',
				'severity', 'low',
				'reason', 'Selected a specific category literally present in preserved provider evidence.'
			))
		),
		coalesce(latest.label_observed_at, now())
	from public.shared_products product
	join pg_temp.evidence_bounded_shared_category_repairs repair on repair.id = product.id
	left join latest_revision latest on latest.shared_product_id = product.id;

	update public.user_food_list_items item
	set food = private.apply_evidence_bounded_food_category(
		item.food,
		repair.category_option_id,
		repair.category_option_label,
		repair.symbol_key
	)
	from pg_temp.evidence_bounded_shared_category_repairs repair
	where item.shared_product_id = repair.id;

	drop table if exists pg_temp.evidence_bounded_custom_category_repairs;
	create temporary table evidence_bounded_custom_category_repairs on commit drop as
	select
		custom_food.id,
		custom_food.user_id,
		custom_food.fdc_id,
		resolved.category_option_id,
		resolved.category_option_label,
		resolved.source_normalized_value,
		resolved.symbol_key
	from public.custom_foods custom_food
	cross join lateral public.resolve_custom_food_category_option_with_symbol(
		array(
			select category.value
			from jsonb_array_elements_text(
				case
					when jsonb_typeof(custom_food.food -> 'categories') = 'array'
						then custom_food.food -> 'categories'
					else '[]'::jsonb
				end
			) with ordinality as category(value, source_order)
			order by category.source_order
		)
	) resolved
	join public.food_category_resolution_guidance guidance
		on guidance.source_normalized_value = resolved.source_normalized_value
		and guidance.enabled
		and guidance.disposition = 'specific'
	where custom_food.category_option_id is distinct from resolved.category_option_id
		and exists (
			select 1
			from jsonb_array_elements_text(
				case
					when jsonb_typeof(custom_food.food -> 'categories') = 'array'
						then custom_food.food -> 'categories'
					else '[]'::jsonb
				end
			) category(value)
			where public.normalize_food_category_value(category.value)
				= resolved.source_normalized_value
		)
		and (
			lower(coalesce(custom_food.food #>> '{fieldProvenance,categories,source}', ''))
				in ('usda', 'open-food-facts', 'cola-cloud')
			or (
				custom_food.food #>> '{fieldProvenance,categories,source}' is null
				and lower(coalesce(custom_food.source_key, custom_food.food ->> 'sourceKey', ''))
					in ('usda', 'open-food-facts', 'cola-cloud')
				and coalesce(custom_food.trust_status, custom_food.food ->> 'trustStatus', '') <> 'user-reported'
			)
		);

	update public.custom_foods custom_food
	set
		category_option_id = repair.category_option_id,
		food = private.apply_evidence_bounded_food_category(
			custom_food.food,
			repair.category_option_id,
			repair.category_option_label,
			repair.symbol_key
		)
	from pg_temp.evidence_bounded_custom_category_repairs repair
	where custom_food.id = repair.id;

	update public.user_food_list_items item
	set food = private.apply_evidence_bounded_food_category(
		item.food,
		repair.category_option_id,
		repair.category_option_label,
		repair.symbol_key
	)
	from pg_temp.evidence_bounded_custom_category_repairs repair
	where item.shared_product_id is null
		and item.user_id = repair.user_id
		and item.fdc_id = repair.fdc_id;

	select count(*) into v_shared_product_count
	from pg_temp.evidence_bounded_shared_category_repairs;
	select count(*) into v_custom_food_count
	from pg_temp.evidence_bounded_custom_category_repairs;

	return jsonb_build_object(
		'sharedProducts', v_shared_product_count,
		'customFoods', v_custom_food_count
	);
end;
$$;

revoke all on function private.apply_evidence_bounded_food_category(jsonb, text, text, text)
	from public, anon, authenticated;
revoke all on function private.repair_provider_food_categories()
	from public, anon, authenticated;
grant execute on function private.repair_provider_food_categories() to service_role;

select private.repair_provider_food_categories();

comment on table public.food_category_resolution_guidance is
	'Bumpers for selecting among exact source-observed categories. Rows may rank or exclude candidates but never remap a product into a different semantic category.';
