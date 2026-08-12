create or replace function public.blendcalc_api_v1_source_attribution_is_complete(
	p_source text,
	p_source_reference text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	with source_policy as (
		select source.*
		from public.product_data_sources source
		where source.key = case
				when p_source in ('community', 'community-reviewed')
					then 'shared-catalog'
				else p_source
			end
			and source.enabled
			and source.canonical_storage_allowed
			and source.api_redistribution_allowed
			and source.canonical_policy_reviewed_at is not null
			and nullif(btrim(source.display_name), '') is not null
			and nullif(btrim(source.homepage_url), '') is not null
			and nullif(btrim(source.canonical_license_name), '') is not null
			and nullif(btrim(source.terms_url), '') is not null
			and nullif(btrim(source.attribution_text), '') is not null
	), dataset_source as (
		select exists (
			select 1
			from public.generic_food_datasets dataset
			join source_policy source on source.key = dataset.source_key
		) as has_datasets
	), referenced_dataset as (
		select split_part(btrim(p_source_reference), ':', 1) as dataset_key
		where position(':' in coalesce(p_source_reference, '')) > 1
	)
	select exists (select 1 from source_policy)
		and (
			not (select has_datasets from dataset_source)
			or exists (
				select 1
				from referenced_dataset reference
				join public.generic_food_datasets dataset
					on dataset.key = reference.dataset_key
				join source_policy source
					on source.key = dataset.source_key
				where dataset.active
					and dataset.import_enabled
					and dataset.license_review_status = 'approved'
					and nullif(btrim(dataset.display_name), '') is not null
					and nullif(btrim(dataset.version), '') is not null
					and nullif(btrim(dataset.source_url), '') is not null
					and nullif(btrim(dataset.license_name), '') is not null
					and nullif(btrim(dataset.license_url), '') is not null
					and nullif(btrim(dataset.attribution_text), '') is not null
					and dataset.imported_at is not null
			)
		);
$$;

create or replace function public.blendcalc_api_v1_product_readiness_reasons(
	p_shared_product_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $function_body$
declare
	v_product public.shared_products%rowtype;
	v_profile public.blendcalc_api_publication_profiles%rowtype;
	v_reasons text[] := '{}'::text[];
	v_field text;
	v_provenance_field text;
	v_key text;
	v_value jsonb;
	v_has_value boolean;
	v_nutrient_id bigint;
begin
	select * into v_product
	from public.shared_products product
	where product.id = p_shared_product_id;

	if not found or v_product.status <> 'active' then
		return array['inactive_product'];
	end if;

	select * into v_profile
	from public.blendcalc_api_publication_profiles profile
	where profile.api_major = 1
		and profile.resource_scope = 'packaged-product'
		and profile.enabled
		and profile.is_default
	order by profile.policy_version desc, profile.key
	limit 1;

	if not found then return array['missing_publication_profile']; end if;

	if v_profile.require_valid_gtin and not public.is_valid_gtin(v_product.barcode) then
		v_reasons := array_append(v_reasons, 'invalid_gtin');
	end if;
	if v_product.last_verified_at is null then
		v_reasons := array_append(v_reasons, 'missing_verification_timestamp');
	elsif v_profile.max_verification_age_days is not null
		and v_product.last_verified_at < now() - make_interval(days => v_profile.max_verification_age_days)
	then
		v_reasons := array_append(v_reasons, 'verification_expired');
	end if;
	if not exists (
		select 1 from public.shared_product_revisions revision
		where revision.shared_product_id = v_product.id
	) then
		v_reasons := array_append(v_reasons, 'missing_current_revision');
	end if;

	foreach v_field in array v_profile.required_field_paths loop
		v_has_value := case v_field
			when 'productName' then nullif(btrim(v_product.product_name), '') is not null
			when 'brandOwner' then nullif(btrim(v_product.brand_owner), '') is not null
			when 'categories' then v_product.category_option_id is not null and exists (
				select 1 from public.custom_food_category_options category
				where category.id = v_product.category_option_id and category.enabled
			)
			when 'ingredients' then nullif(btrim(v_product.food ->> 'ingredients'), '') is not null
			when 'sourceMetadata' then jsonb_typeof(v_product.food -> 'sourceMetadata') = 'object'
				and v_product.food -> 'sourceMetadata' <> '{}'::jsonb
			when 'marketCountries' then jsonb_typeof(v_product.food #> '{sourceMetadata,marketCountries}') = 'array'
				and jsonb_array_length(v_product.food #> '{sourceMetadata,marketCountries}') > 0
			else false
		end;
		if not v_has_value then
			v_reasons := array_append(v_reasons, 'missing_required_field:' || v_field);
		else
			v_provenance_field := case when v_field = 'marketCountries' then 'sourceMetadata' else v_field end;
			if not exists (
				select 1 from public.shared_product_field_provenance provenance
				where provenance.shared_product_id = v_product.id
					and provenance.field_path = v_provenance_field and provenance.selected
			) then
				v_reasons := array_append(v_reasons, 'missing_field_provenance:' || v_provenance_field);
			end if;
		end if;
	end loop;

	foreach v_field in array array['structuredIngredients','ingredientAnalysis','additives','allergens','traces','dietaryTags','labels','package','sourceMetadata'] loop
		v_key := case when v_field = 'package' then 'packageQuantity' else v_field end;
		v_value := v_product.food -> v_key;
		v_has_value := case
			when jsonb_typeof(v_value) = 'array' then jsonb_array_length(v_value) > 0
			when jsonb_typeof(v_value) = 'object' then v_value <> '{}'::jsonb
			else false
		end;
		if v_has_value and not exists (
			select 1 from public.shared_product_field_provenance provenance
			where provenance.shared_product_id = v_product.id
				and provenance.field_path = v_field and provenance.selected
		) then
			v_reasons := array_append(v_reasons, 'missing_field_provenance:' || v_field);
		end if;
	end loop;

	if exists (
		select 1
		from public.shared_product_field_provenance provenance
		join public.shared_product_observations observation on observation.id = provenance.observation_id
		where provenance.shared_product_id = v_product.id and provenance.selected
			and (
				nullif(btrim(observation.source_reference), '') is null
				or not public.blendcalc_api_v1_source_attribution_is_complete(
					observation.source, observation.source_reference
				)
			)
	) then
		v_reasons := array_append(v_reasons, 'field_source_not_redistributable');
	end if;

	if v_profile.minimum_allergen_evidence = 'ingredient-list'
		and nullif(btrim(v_product.food ->> 'ingredients'), '') is null then
		v_reasons := array_append(v_reasons, 'insufficient_allergen_evidence');
	elsif v_profile.minimum_allergen_evidence = 'explicit-declaration' and not (
		(jsonb_typeof(v_product.food -> 'allergens') = 'array' and jsonb_array_length(v_product.food -> 'allergens') > 0)
		or (jsonb_typeof(v_product.food -> 'traces') = 'array' and jsonb_array_length(v_product.food -> 'traces') > 0)
		or exists (select 1 from public.product_precautionary_statements statement where statement.shared_product_id = v_product.id)
	) then
		v_reasons := array_append(v_reasons, 'insufficient_allergen_evidence');
	end if;

	if not exists (select 1 from public.food_nutrients nutrient where nutrient.shared_product_id = v_product.id) then
		v_reasons := array_append(v_reasons, 'missing_normalized_nutrients');
	else
		if exists (
			select 1 from public.food_nutrients nutrient
			where nutrient.shared_product_id = v_product.id
				and not (nutrient.value_status = any(v_profile.accepted_nutrient_value_statuses) and nutrient.amount_per_100g >= 0)
		) then v_reasons := array_append(v_reasons, 'unsupported_nutrient_value_state'); end if;
		if v_profile.require_canonical_nutrient_mapping and exists (
			select 1 from public.food_nutrients nutrient
			where nutrient.shared_product_id = v_product.id and nutrient.mapping_status <> 'canonical'
		) then v_reasons := array_append(v_reasons, 'unreviewed_nutrient_mapping'); end if;
		if exists (
			select 1 from public.food_nutrients nutrient
			where nutrient.shared_product_id = v_product.id and nutrient.value_status = 'derived'
				and nullif(btrim(nutrient.derivation_method), '') is null
		) then v_reasons := array_append(v_reasons, 'derived_nutrient_missing_method'); end if;
		if exists (
			select 1 from public.food_nutrients nutrient
			where nutrient.shared_product_id = v_product.id and (
				nullif(btrim(nutrient.source_reference), '') is null
				or nullif(btrim(nutrient.confidence), '') is null
				or not public.blendcalc_api_v1_source_attribution_is_complete(nutrient.source, nutrient.source_reference)
			)
		) then v_reasons := array_append(v_reasons, 'nutrient_source_not_redistributable'); end if;
		if exists (
			select 1 from public.food_nutrients nutrient
			where nutrient.shared_product_id = v_product.id and not exists (
				select 1 from public.shared_product_field_provenance provenance
				where provenance.shared_product_id = v_product.id
					and provenance.field_path = 'nutrient:' || nutrient.nutrient_id::text and provenance.selected
			)
		) then v_reasons := array_append(v_reasons, 'missing_nutrient_provenance'); end if;
	end if;

	for v_nutrient_id in
		select requirement.nutrient_id
		from public.nutrition_completeness_profile_nutrients requirement
		where requirement.profile_key = v_profile.nutrition_profile_key
			and requirement.requirement_level = 'required'
		order by requirement.display_order, requirement.nutrient_id
	loop
		if not exists (
			select 1 from public.food_nutrients nutrient
			where nutrient.shared_product_id = v_product.id and nutrient.nutrient_id = v_nutrient_id
				and nutrient.value_status = any(v_profile.accepted_nutrient_value_statuses)
				and nutrient.amount_per_100g >= 0
		) then v_reasons := array_append(v_reasons, 'missing_required_nutrient:' || v_nutrient_id::text); end if;
	end loop;

	if v_profile.require_primary_serving and not exists (
		select 1 from public.food_servings serving
		where serving.shared_product_id = v_product.id and serving.is_primary
			and serving.gram_weight > 0 and serving.gram_weight_method <> 'unknown'
			and (serving.gram_weight_method <> 'calculated-conversion' or nullif(btrim(serving.calculation_basis), '') is not null)
	) then v_reasons := array_append(v_reasons, 'missing_evidence_backed_primary_serving'); end if;
	if exists (
		select 1 from public.food_servings serving
		where serving.shared_product_id = v_product.id and (
			nullif(btrim(serving.source_reference), '') is null
			or nullif(btrim(serving.confidence), '') is null
			or serving.gram_weight <= 0
			or not public.blendcalc_api_v1_source_attribution_is_complete(serving.source, serving.source_reference)
		)
	) then v_reasons := array_append(v_reasons, 'serving_source_not_redistributable'); end if;
	if v_profile.require_primary_serving and (
		not exists (
			select 1 from public.shared_product_field_provenance provenance
			where provenance.shared_product_id = v_product.id and provenance.field_path = 'serving' and provenance.selected
		)
		or not exists (
			select 1 from public.shared_product_field_provenance provenance
			where provenance.shared_product_id = v_product.id and provenance.field_path = 'servingWeightGrams' and provenance.selected
		)
	) then v_reasons := array_append(v_reasons, 'missing_serving_provenance'); end if;
	if exists (
		select 1 from public.shared_product_conflicts conflict
		where conflict.shared_product_id = v_product.id and conflict.status = 'open'
			and conflict.severity = any(v_profile.blocked_conflict_severities)
	) then v_reasons := array_append(v_reasons, 'unresolved_material_conflict'); end if;

	select coalesce(array_agg(distinct reason order by reason), '{}'::text[])
	into v_reasons from unnest(v_reasons) reason;
	return v_reasons;
end;
$function_body$;

revoke all on function public.blendcalc_api_v1_source_attribution_is_complete(text, text)
	from public, anon, authenticated;
grant execute on function public.blendcalc_api_v1_source_attribution_is_complete(text, text)
	to service_role;

comment on function public.blendcalc_api_v1_source_attribution_is_complete(text, text) is
	'Fails closed unless an API source and any referenced dataset release retain complete reviewed public attribution metadata.';
