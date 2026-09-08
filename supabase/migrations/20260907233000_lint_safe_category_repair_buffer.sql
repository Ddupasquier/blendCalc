create or replace function private.repair_provider_food_categories()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_shared_repairs jsonb;
	v_custom_repairs jsonb;
	v_shared_product_count integer;
	v_custom_food_count integer;
begin
	select coalesce(jsonb_agg(to_jsonb(repair)), '[]'::jsonb)
	into v_shared_repairs
	from (
		select
			product.id,
			product.approved_submission_id,
			product.food as previous_food,
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
			)
	) repair;

	update public.shared_product_submissions submission
	set
		category_option_id = repair.category_option_id,
		food = private.apply_evidence_bounded_food_category(
			submission.food,
			repair.category_option_id,
			repair.category_option_label,
			repair.symbol_key
		)
	from jsonb_to_recordset(v_shared_repairs) as repair(
		id uuid,
		approved_submission_id uuid,
		previous_food jsonb,
		category_option_id text,
		category_option_label text,
		source_normalized_value text,
		symbol_key text
	)
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
	from jsonb_to_recordset(v_shared_repairs) as repair(
		id uuid,
		approved_submission_id uuid,
		previous_food jsonb,
		category_option_id text,
		category_option_label text,
		source_normalized_value text,
		symbol_key text
	)
	where product.id = repair.id;

	with repairs as (
		select *
		from jsonb_to_recordset(v_shared_repairs) as repair(
			id uuid,
			approved_submission_id uuid,
			previous_food jsonb,
			category_option_id text,
			category_option_label text,
			source_normalized_value text,
			symbol_key text
		)
	), latest_revision as (
		select distinct on (revision.shared_product_id)
			revision.shared_product_id,
			revision.id,
			revision.revision_number,
			revision.label_observed_at
		from public.shared_product_revisions revision
		join repairs repair on repair.id = revision.shared_product_id
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
	join repairs repair on repair.id = product.id
	left join latest_revision latest on latest.shared_product_id = product.id;

	update public.user_food_list_items item
	set food = private.apply_evidence_bounded_food_category(
		item.food,
		repair.category_option_id,
		repair.category_option_label,
		repair.symbol_key
	)
	from jsonb_to_recordset(v_shared_repairs) as repair(
		id uuid,
		approved_submission_id uuid,
		previous_food jsonb,
		category_option_id text,
		category_option_label text,
		source_normalized_value text,
		symbol_key text
	)
	where item.shared_product_id = repair.id;

	select coalesce(jsonb_agg(to_jsonb(repair)), '[]'::jsonb)
	into v_custom_repairs
	from (
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
			)
	) repair;

	update public.custom_foods custom_food
	set
		category_option_id = repair.category_option_id,
		food = private.apply_evidence_bounded_food_category(
			custom_food.food,
			repair.category_option_id,
			repair.category_option_label,
			repair.symbol_key
		)
	from jsonb_to_recordset(v_custom_repairs) as repair(
		id uuid,
		user_id uuid,
		fdc_id bigint,
		category_option_id text,
		category_option_label text,
		source_normalized_value text,
		symbol_key text
	)
	where custom_food.id = repair.id;

	update public.user_food_list_items item
	set food = private.apply_evidence_bounded_food_category(
		item.food,
		repair.category_option_id,
		repair.category_option_label,
		repair.symbol_key
	)
	from jsonb_to_recordset(v_custom_repairs) as repair(
		id uuid,
		user_id uuid,
		fdc_id bigint,
		category_option_id text,
		category_option_label text,
		source_normalized_value text,
		symbol_key text
	)
	where item.shared_product_id is null
		and item.user_id = repair.user_id
		and item.fdc_id = repair.fdc_id;

	v_shared_product_count := jsonb_array_length(v_shared_repairs);
	v_custom_food_count := jsonb_array_length(v_custom_repairs);

	return jsonb_build_object(
		'sharedProducts', v_shared_product_count,
		'customFoods', v_custom_food_count
	);
end;
$$;

revoke all on function private.repair_provider_food_categories()
	from public, anon, authenticated;
grant execute on function private.repair_provider_food_categories() to service_role;

comment on function private.repair_provider_food_categories() is
	'Repairs provider-owned categories only when the selected category is present in preserved source evidence. Typed JSON buffers keep the reusable function statically lintable without session-scoped relations.';
