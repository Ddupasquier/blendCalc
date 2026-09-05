create or replace function public.apply_external_ingredient_statement_normalization(
	p_scope text,
	p_row_id uuid,
	p_expected_food jsonb,
	p_normalized_food jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_product public.shared_products%rowtype;
	v_revision public.shared_product_revisions%rowtype;
	v_custom_food public.custom_foods%rowtype;
	v_list_item public.user_food_list_items%rowtype;
	v_source text;
begin
	if p_scope not in ('shared_product', 'custom_food', 'user_food_list_item') then
		raise exception 'Unsupported ingredient normalization scope';
	end if;
	if jsonb_typeof(p_expected_food) <> 'object'
		or jsonb_typeof(p_normalized_food) <> 'object' then
		raise exception 'Ingredient normalization requires food objects';
	end if;
	if p_expected_food = p_normalized_food then
		return 'unchanged';
	end if;

	if p_scope = 'shared_product' then
		select product.*
		into v_product
		from public.shared_products product
		where product.id = p_row_id
		for update;
		if not found then
			raise exception 'Shared product not found';
		end if;
		if v_product.food <> p_expected_food then
			raise exception 'Shared product changed after the normalization preview';
		end if;
		if v_product.status <> 'active' or v_product.confidence = 'moderator-reviewed' then
			raise exception 'Reviewed or inactive shared products require manual review';
		end if;
		v_source := coalesce(
			p_expected_food #>> '{fieldProvenance,ingredients,source}',
			v_product.source
		);
	else
		v_source := p_expected_food #>> '{fieldProvenance,ingredients,source}';
	end if;
	if v_source not in (
		'usda',
		'open-food-facts',
		'cola-cloud',
		'health-canada-cnf',
		'uk-cofid',
		'fsanz-afcd',
		'foodrepo'
	) then
		raise exception 'Only externally sourced ingredient statements can be normalized';
	end if;
	if btrim(coalesce(p_normalized_food ->> 'ingredients', '')) = ''
		or p_normalized_food #>> '{ingredientAnalysis,normalization,method}'
			<> 'external-ingredient-statement'
		or p_normalized_food #>> '{ingredientAnalysis,normalization,version}' <> '1' then
		raise exception 'Ingredient normalization metadata is required';
	end if;
	if p_expected_food - array[
		'ingredients',
		'ingredientList',
		'ingredientAnalysis',
		'precautionaryStatements',
		'fieldProvenance'
	] <> p_normalized_food - array[
		'ingredients',
		'ingredientList',
		'ingredientAnalysis',
		'precautionaryStatements',
		'fieldProvenance'
	] then
		raise exception 'Ingredient normalization changed unrelated food fields';
	end if;
	if coalesce(p_expected_food -> 'fieldProvenance', '{}'::jsonb) - 'ingredients'
		<> coalesce(p_normalized_food -> 'fieldProvenance', '{}'::jsonb) - 'ingredients'
		or p_normalized_food #>> '{fieldProvenance,ingredients,source}' <> v_source then
		raise exception 'Ingredient normalization changed unrelated provenance';
	end if;
	if not coalesce(p_normalized_food -> 'precautionaryStatements', '[]'::jsonb)
		@> coalesce(p_expected_food -> 'precautionaryStatements', '[]'::jsonb) then
		raise exception 'Ingredient normalization cannot discard precautionary evidence';
	end if;
	if exists (
		select 1
		from jsonb_array_elements(
			case
				when jsonb_typeof(p_normalized_food -> 'precautionaryStatements') = 'array'
					then p_normalized_food -> 'precautionaryStatements'
				else '[]'::jsonb
			end
		) statement
		where statement ->> 'type' = 'contains'
	) then
		raise exception 'Contains declarations cannot be stored as precautionary statements';
	end if;

	if p_scope = 'shared_product' then
		select revision.*
		into v_revision
		from public.shared_product_revisions revision
		where revision.shared_product_id = v_product.id
		order by revision.revision_number desc
		limit 1
		for update;
		if not found then
			raise exception 'Shared product revision history is required';
		end if;

		update public.shared_products
		set food = p_normalized_food
		where id = v_product.id;

		insert into public.shared_product_revisions (
			shared_product_id,
			revision_number,
			food,
			source,
			source_reference,
			created_by,
			supersedes_revision_id,
			change_summary,
			label_observed_at
		)
		values (
			v_product.id,
			v_revision.revision_number + 1,
			p_normalized_food,
			v_product.source,
			v_product.source_reference,
			null,
			v_revision.id,
			jsonb_build_object(
				'changes',
				jsonb_build_array(jsonb_build_object(
					'field', 'ingredients',
					'label', 'Ingredients',
					'changeType', 'changed',
					'previousValue', p_expected_food -> 'ingredients',
					'submittedValue', p_normalized_food -> 'ingredients',
					'severity', 'low'
				))
			),
			v_revision.label_observed_at
		);
		return 'updated';
	end if;

	if p_scope = 'custom_food' then
		select custom_food.*
		into v_custom_food
		from public.custom_foods custom_food
		where custom_food.id = p_row_id
		for update;
		if not found then
			raise exception 'Custom food not found';
		end if;
		if v_custom_food.food <> p_expected_food then
			raise exception 'Custom food changed after the normalization preview';
		end if;
		update public.custom_foods
		set food = p_normalized_food
		where id = v_custom_food.id;
		return 'updated';
	end if;

	select item.*
	into v_list_item
	from public.user_food_list_items item
	where item.id = p_row_id
	for update;
	if not found then
		raise exception 'Food list item not found';
	end if;
	if v_list_item.food <> p_expected_food then
		raise exception 'Food list item changed after the normalization preview';
	end if;
	update public.user_food_list_items
	set food = p_normalized_food
	where id = v_list_item.id;
	return 'updated';
end;
$$;

revoke all on function public.apply_external_ingredient_statement_normalization(
	text,
	uuid,
	jsonb,
	jsonb
) from public, anon, authenticated;
grant execute on function public.apply_external_ingredient_statement_normalization(
	text,
	uuid,
	jsonb,
	jsonb
) to service_role;

comment on function public.apply_external_ingredient_statement_normalization(
	text,
	uuid,
	jsonb,
	jsonb
) is
	'Applies a precomputed, versioned ingredient statement normalization only when the complete stored food snapshot still matches its dry-run input. External APIs are never called.';
