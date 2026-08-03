create or replace function public.blendcalc_api_v1_product_readiness_reasons(
	p_shared_product_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
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
	select *
	into v_product
	from public.shared_products product
	where product.id = p_shared_product_id;

	if not found or v_product.status <> 'active' then
		return array['inactive_product'];
	end if;

	select *
	into v_profile
	from public.blendcalc_api_publication_profiles profile
	where profile.api_major = 1
		and profile.resource_scope = 'packaged-product'
		and profile.enabled
		and profile.is_default
	order by profile.policy_version desc, profile.key
	limit 1;

	if not found then
		return array['missing_publication_profile'];
	end if;

	if v_profile.require_valid_gtin and not public.is_valid_gtin(v_product.barcode) then
		v_reasons := array_append(v_reasons, 'invalid_gtin');
	end if;

	if v_product.last_verified_at is null then
		v_reasons := array_append(v_reasons, 'missing_verification_timestamp');
	elsif v_profile.max_verification_age_days is not null
		and v_product.last_verified_at < now() - make_interval(
			days => v_profile.max_verification_age_days
		)
	then
		v_reasons := array_append(v_reasons, 'verification_expired');
	end if;

	if not exists (
		select 1
		from public.shared_product_revisions revision
		where revision.shared_product_id = v_product.id
	) then
		v_reasons := array_append(v_reasons, 'missing_current_revision');
	end if;

	foreach v_field in array v_profile.required_field_paths
	loop
		v_has_value := case v_field
			when 'productName' then nullif(btrim(v_product.product_name), '') is not null
			when 'brandOwner' then nullif(btrim(v_product.brand_owner), '') is not null
			when 'categories' then v_product.category_option_id is not null and exists (
				select 1
				from public.custom_food_category_options category
				where category.id = v_product.category_option_id
					and category.enabled
			)
			when 'ingredients' then nullif(btrim(v_product.food ->> 'ingredients'), '') is not null
			when 'sourceMetadata' then jsonb_typeof(v_product.food -> 'sourceMetadata') = 'object'
				and v_product.food -> 'sourceMetadata' <> '{}'::jsonb
			when 'marketCountries' then jsonb_typeof(
				v_product.food #> '{sourceMetadata,marketCountries}'
			) = 'array' and jsonb_array_length(
				v_product.food #> '{sourceMetadata,marketCountries}'
			) > 0
			else false
		end;

		if not v_has_value then
			v_reasons := array_append(
				v_reasons,
				'missing_required_field:' || v_field
			);
		else
			v_provenance_field := case
				when v_field = 'marketCountries' then 'sourceMetadata'
				else v_field
			end;
			if not exists (
				select 1
				from public.shared_product_field_provenance provenance
				where provenance.shared_product_id = v_product.id
					and provenance.field_path = v_provenance_field
					and provenance.selected
			) then
				v_reasons := array_append(
					v_reasons,
					'missing_field_provenance:' || v_provenance_field
				);
			end if;
		end if;
	end loop;

	foreach v_field in array array[
		'structuredIngredients',
		'ingredientAnalysis',
		'additives',
		'allergens',
		'traces',
		'dietaryTags',
		'labels',
		'package',
		'sourceMetadata'
	]
	loop
		v_key := case when v_field = 'package' then 'packageQuantity' else v_field end;
		v_value := v_product.food -> v_key;
		v_has_value := case
			when jsonb_typeof(v_value) = 'array' then jsonb_array_length(v_value) > 0
			when jsonb_typeof(v_value) = 'object' then v_value <> '{}'::jsonb
			else false
		end;
		if v_has_value and not exists (
			select 1
			from public.shared_product_field_provenance provenance
			where provenance.shared_product_id = v_product.id
				and provenance.field_path = v_field
				and provenance.selected
		) then
			v_reasons := array_append(
				v_reasons,
				'missing_field_provenance:' || v_field
			);
		end if;
	end loop;

	if exists (
		select 1
		from public.shared_product_field_provenance provenance
		join public.shared_product_observations observation
			on observation.id = provenance.observation_id
		where provenance.shared_product_id = v_product.id
			and provenance.selected
			and (
				not public.blendcalc_api_v1_source_is_eligible(observation.source)
				or nullif(btrim(observation.source_reference), '') is null
			)
	) then
		v_reasons := array_append(v_reasons, 'field_source_not_redistributable');
	end if;

	if v_profile.minimum_allergen_evidence = 'ingredient-list'
		and nullif(btrim(v_product.food ->> 'ingredients'), '') is null
	then
		v_reasons := array_append(v_reasons, 'insufficient_allergen_evidence');
	elsif v_profile.minimum_allergen_evidence = 'explicit-declaration'
		and not (
			(jsonb_typeof(v_product.food -> 'allergens') = 'array'
				and jsonb_array_length(v_product.food -> 'allergens') > 0)
			or (jsonb_typeof(v_product.food -> 'traces') = 'array'
				and jsonb_array_length(v_product.food -> 'traces') > 0)
			or exists (
				select 1
				from public.product_precautionary_statements statement
				where statement.shared_product_id = v_product.id
			)
		)
	then
		v_reasons := array_append(v_reasons, 'insufficient_allergen_evidence');
	end if;

	if not exists (
		select 1
		from public.food_nutrients nutrient
		where nutrient.shared_product_id = v_product.id
	) then
		v_reasons := array_append(v_reasons, 'missing_normalized_nutrients');
	else
		if exists (
			select 1
			from public.food_nutrients nutrient
			where nutrient.shared_product_id = v_product.id
				and not (
					nutrient.value_status = any(
						v_profile.accepted_nutrient_value_statuses
					)
					and nutrient.amount_per_100g >= 0
				)
		) then
			v_reasons := array_append(v_reasons, 'unsupported_nutrient_value_state');
		end if;

		if v_profile.require_canonical_nutrient_mapping and exists (
			select 1
			from public.food_nutrients nutrient
			where nutrient.shared_product_id = v_product.id
				and nutrient.mapping_status <> 'canonical'
		) then
			v_reasons := array_append(v_reasons, 'unreviewed_nutrient_mapping');
		end if;

		if exists (
			select 1
			from public.food_nutrients nutrient
			where nutrient.shared_product_id = v_product.id
				and nutrient.value_status = 'derived'
				and nullif(btrim(nutrient.derivation_method), '') is null
		) then
			v_reasons := array_append(v_reasons, 'derived_nutrient_missing_method');
		end if;

		if exists (
			select 1
			from public.food_nutrients nutrient
			where nutrient.shared_product_id = v_product.id
				and (
					not public.blendcalc_api_v1_source_is_eligible(nutrient.source)
					or nullif(btrim(nutrient.source_reference), '') is null
					or nullif(btrim(nutrient.confidence), '') is null
				)
		) then
			v_reasons := array_append(v_reasons, 'nutrient_source_not_redistributable');
		end if;

		if exists (
			select 1
			from public.food_nutrients nutrient
			where nutrient.shared_product_id = v_product.id
				and not exists (
					select 1
					from public.shared_product_field_provenance provenance
					where provenance.shared_product_id = v_product.id
						and provenance.field_path = 'nutrient:' || nutrient.nutrient_id::text
						and provenance.selected
				)
		) then
			v_reasons := array_append(v_reasons, 'missing_nutrient_provenance');
		end if;
	end if;

	for v_nutrient_id in
		select requirement.nutrient_id
		from public.nutrition_completeness_profile_nutrients requirement
		where requirement.profile_key = v_profile.nutrition_profile_key
			and requirement.requirement_level = 'required'
		order by requirement.display_order, requirement.nutrient_id
	loop
		if not exists (
			select 1
			from public.food_nutrients nutrient
			where nutrient.shared_product_id = v_product.id
				and nutrient.nutrient_id = v_nutrient_id
				and nutrient.value_status = any(
					v_profile.accepted_nutrient_value_statuses
				)
				and nutrient.amount_per_100g >= 0
		) then
			v_reasons := array_append(
				v_reasons,
				'missing_required_nutrient:' || v_nutrient_id::text
			);
		end if;
	end loop;

	if v_profile.require_primary_serving and not exists (
		select 1
		from public.food_servings serving
		where serving.shared_product_id = v_product.id
			and serving.is_primary
			and serving.gram_weight > 0
			and serving.gram_weight_method <> 'unknown'
			and (
				serving.gram_weight_method <> 'calculated-conversion'
				or nullif(btrim(serving.calculation_basis), '') is not null
			)
	) then
		v_reasons := array_append(v_reasons, 'missing_evidence_backed_primary_serving');
	end if;

	if exists (
		select 1
		from public.food_servings serving
		where serving.shared_product_id = v_product.id
			and (
				not public.blendcalc_api_v1_source_is_eligible(serving.source)
				or nullif(btrim(serving.source_reference), '') is null
				or nullif(btrim(serving.confidence), '') is null
				or serving.gram_weight <= 0
			)
	) then
		v_reasons := array_append(v_reasons, 'serving_source_not_redistributable');
	end if;

	if v_profile.require_primary_serving and (
		not exists (
			select 1
			from public.shared_product_field_provenance provenance
			where provenance.shared_product_id = v_product.id
				and provenance.field_path = 'serving'
				and provenance.selected
		)
		or not exists (
			select 1
			from public.shared_product_field_provenance provenance
			where provenance.shared_product_id = v_product.id
				and provenance.field_path = 'servingWeightGrams'
				and provenance.selected
		)
	) then
		v_reasons := array_append(v_reasons, 'missing_serving_provenance');
	end if;

	if exists (
		select 1
		from public.shared_product_conflicts conflict
		where conflict.shared_product_id = v_product.id
			and conflict.status = 'open'
			and conflict.severity = any(v_profile.blocked_conflict_severities)
	) then
		v_reasons := array_append(v_reasons, 'unresolved_material_conflict');
	end if;

	select coalesce(array_agg(distinct reason order by reason), '{}'::text[])
	into v_reasons
	from unnest(v_reasons) reason;

	return v_reasons;
end;
$$;

create or replace view public.blendcalc_api_v1_product_readiness
with (security_invoker = true)
as
select
	product.id as shared_product_id,
	product.barcode,
	product.product_name,
	readiness.reasons,
	cardinality(readiness.reasons) = 0 as publishable,
	profile.key as profile_key,
	case
		when cardinality(readiness.reasons) = 0 then 'verified'
		when conflict.material_conflict_count > 0 then 'under_review'
		else 'incomplete'
	end as publication_status,
	jsonb_build_object(
		'identity', jsonb_build_object(
			'validGtin', not ('invalid_gtin' = any(readiness.reasons)),
			'hasName', nullif(btrim(product.product_name), '') is not null,
			'hasBrand', nullif(btrim(product.brand_owner), '') is not null,
			'hasCategory', product.category_option_id is not null,
			'hasMarket', jsonb_typeof(
				product.food #> '{sourceMetadata,marketCountries}'
			) = 'array' and jsonb_array_length(
				product.food #> '{sourceMetadata,marketCountries}'
			) > 0
		),
		'nutrition', jsonb_build_object(
			'profileKey', profile.nutrition_profile_key,
			'requiredCount', nutrition.required_count,
			'acceptedCount', nutrition.accepted_count,
			'missingNutrientIds', to_jsonb(nutrition.missing_nutrient_ids),
			'reportedZeroCount', nutrition.reported_zero_count,
			'derivedCount', nutrition.derived_count,
			'unreviewedMappingCount', nutrition.unreviewed_mapping_count
		),
		'servings', jsonb_build_object(
			'count', serving.serving_count,
			'hasEvidenceBackedPrimary', serving.has_evidence_backed_primary
		),
		'ingredients', jsonb_build_object(
			'hasIngredientList', nullif(btrim(product.food ->> 'ingredients'), '') is not null,
			'allergenEvidence', case
				when (jsonb_typeof(product.food -> 'allergens') = 'array'
					and jsonb_array_length(product.food -> 'allergens') > 0)
					or (jsonb_typeof(product.food -> 'traces') = 'array'
						and jsonb_array_length(product.food -> 'traces') > 0)
					or exists (
						select 1
						from public.product_precautionary_statements statement
						where statement.shared_product_id = product.id
					) then 'explicit-declaration'
				when nullif(btrim(product.food ->> 'ingredients'), '') is not null
					then 'ingredient-list'
				else 'unknown'
			end
		),
		'provenance', jsonb_build_object(
			'selectedFieldCount', provenance.selected_field_count,
			'sourceCount', provenance.source_count
		),
		'sourceAgreement', jsonb_build_object(
			'openConflictCount', conflict.open_conflict_count,
			'materialConflictCount', conflict.material_conflict_count
		),
		'verification', jsonb_build_object(
			'lastVerifiedAt', product.last_verified_at,
			'maxAgeDays', profile.max_verification_age_days
		),
		'redistribution', jsonb_build_object(
			'ready', not (
				'field_source_not_redistributable' = any(readiness.reasons)
				or 'nutrient_source_not_redistributable' = any(readiness.reasons)
				or 'serving_source_not_redistributable' = any(readiness.reasons)
			)
		)
	) as quality_dimensions
from public.shared_products product
left join lateral (
	select publication_profile.*
	from public.blendcalc_api_publication_profiles publication_profile
	where publication_profile.api_major = 1
		and publication_profile.resource_scope = 'packaged-product'
		and publication_profile.enabled
		and publication_profile.is_default
	order by publication_profile.policy_version desc, publication_profile.key
	limit 1
) profile on true
cross join lateral (
	select public.blendcalc_api_v1_product_readiness_reasons(product.id) as reasons
) readiness
left join lateral (
	select
		count(*)::integer as required_count,
		count(*) filter (
			where nutrient.nutrient_id is not null
				and nutrient.value_status = any(profile.accepted_nutrient_value_statuses)
				and nutrient.amount_per_100g >= 0
		)::integer as accepted_count,
		coalesce(
			array_agg(requirement.nutrient_id order by requirement.display_order)
				filter (where nutrient.nutrient_id is null),
			'{}'::bigint[]
		) as missing_nutrient_ids,
		count(*) filter (where nutrient.value_status = 'reported-zero')::integer
			as reported_zero_count,
		count(*) filter (where nutrient.value_status = 'derived')::integer
			as derived_count,
		count(*) filter (
			where nutrient.nutrient_id is not null
				and nutrient.mapping_status <> 'canonical'
		)::integer as unreviewed_mapping_count
	from public.nutrition_completeness_profile_nutrients requirement
	left join public.food_nutrients nutrient
		on nutrient.shared_product_id = product.id
		and nutrient.nutrient_id = requirement.nutrient_id
	where requirement.profile_key = profile.nutrition_profile_key
		and requirement.requirement_level = 'required'
) nutrition on true
left join lateral (
	select
		count(*)::integer as serving_count,
		coalesce(bool_or(
			serving.is_primary
			and serving.gram_weight > 0
			and serving.gram_weight_method <> 'unknown'
			and (
				serving.gram_weight_method <> 'calculated-conversion'
				or nullif(btrim(serving.calculation_basis), '') is not null
			)
		), false) as has_evidence_backed_primary
	from public.food_servings serving
	where serving.shared_product_id = product.id
) serving on true
left join lateral (
	select
		count(*)::integer as selected_field_count,
		count(distinct observation.source)::integer as source_count
	from public.shared_product_field_provenance field_provenance
	join public.shared_product_observations observation
		on observation.id = field_provenance.observation_id
	where field_provenance.shared_product_id = product.id
		and field_provenance.selected
) provenance on true
left join lateral (
	select
		count(*)::integer as open_conflict_count,
		count(*) filter (
			where product_conflict.severity = any(profile.blocked_conflict_severities)
		)::integer as material_conflict_count
	from public.shared_product_conflicts product_conflict
	where product_conflict.shared_product_id = product.id
		and product_conflict.status = 'open'
) conflict on true
where product.status = 'active';

grant select on table public.shared_product_conflicts to service_role;

revoke all on table public.blendcalc_api_v1_product_readiness
	from public, anon, authenticated;
grant select on table public.blendcalc_api_v1_product_readiness to service_role;

comment on view public.blendcalc_api_v1_product_readiness is
	'Service-only API v1 publication diagnostics with explicit blocking reasons and transparent quality dimensions. Failure withholds a product without deleting its observations or canonical history.';
