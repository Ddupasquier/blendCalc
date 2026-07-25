create or replace function public.apply_shared_product_external_enrichment(
	p_shared_product_id uuid,
	p_barcode text,
	p_enriched_food jsonb,
	p_category_option_id text default null,
	p_candidate_fields text[] default '{}'::text[],
	p_observations jsonb default '[]'::jsonb,
	p_provenance jsonb default '[]'::jsonb
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_product public.shared_products%rowtype;
	v_food jsonb;
	v_field text;
	v_key text;
	v_applied_fields text[] := '{}'::text[];
	v_observation jsonb;
	v_observation_id uuid;
	v_observation_ids jsonb := '{}'::jsonb;
	v_provenance jsonb;
	v_canonical_provenance jsonb;
	v_revision_number integer;
	v_field_applied boolean;
begin
	if p_barcode !~ '^[0-9]{14}$' then
		raise exception 'Canonical product enrichment requires a normalized GTIN-14';
	end if;
	if jsonb_typeof(p_enriched_food) <> 'object' then
		raise exception 'Canonical product enrichment food must be an object';
	end if;
	if jsonb_typeof(p_observations) <> 'array'
		or jsonb_typeof(p_provenance) <> 'array' then
		raise exception 'Canonical product enrichment evidence must use arrays';
	end if;
	if exists (
		select 1
		from unnest(coalesce(p_candidate_fields, '{}'::text[])) field_name
		where field_name not in (
			'nutrition',
			'image',
			'categories',
			'serving',
			'ingredients',
			'allergens',
			'traces',
			'dietaryTags',
			'labels'
		)
	) then
		raise exception 'Unsupported canonical product enrichment field';
	end if;

	perform pg_advisory_xact_lock(hashtext(p_barcode));

	select *
	into v_product
	from public.shared_products
	where id = p_shared_product_id
		and barcode = p_barcode
		and status = 'active'
	for update;

	if not found then
		raise exception 'Active canonical product not found for barcode';
	end if;

	v_food := v_product.food;
	v_canonical_provenance := coalesce(
		v_product.canonical_provenance,
		'{}'::jsonb
	);

	if 'nutrition' = any(coalesce(p_candidate_fields, '{}'::text[]))
		and (
			case
				when jsonb_typeof(v_food -> 'foodNutrients') = 'array'
					then jsonb_array_length(v_food -> 'foodNutrients') = 0
				else true
			end
		)
		and (
			case
				when jsonb_typeof(p_enriched_food -> 'foodNutrients') = 'array'
					then jsonb_array_length(p_enriched_food -> 'foodNutrients') > 0
				else false
			end
		) then
		v_food := jsonb_set(
			v_food,
			'{foodNutrients}',
			p_enriched_food -> 'foodNutrients',
			true
		);
		v_food := jsonb_set(
			v_food,
			'{reportedNutrientIds}',
			coalesce(p_enriched_food -> 'reportedNutrientIds', '[]'::jsonb),
			true
		);
		v_applied_fields := array_append(v_applied_fields, 'nutrition');
	end if;

	if 'image' = any(coalesce(p_candidate_fields, '{}'::text[]))
		and nullif(btrim(v_food -> 'image' ->> 'imageUrl'), '') is null
		and nullif(
			btrim(p_enriched_food -> 'image' ->> 'imageUrl'),
			''
		) is not null then
		v_food := jsonb_set(v_food, '{image}', p_enriched_food -> 'image', true);
		v_applied_fields := array_append(v_applied_fields, 'image');
	end if;

	if 'categories' = any(coalesce(p_candidate_fields, '{}'::text[]))
		and v_product.category_option_id is null
		and p_category_option_id is not null
		and exists (
			select 1
			from public.custom_food_category_options category
			where category.id = p_category_option_id
				and category.enabled
		) then
		foreach v_key in array array[
			'foodCategory',
			'categories',
			'categoryOptionId'
		]
		loop
			if p_enriched_food ? v_key then
				v_food := jsonb_set(
					v_food,
					array[v_key],
					p_enriched_food -> v_key,
					true
				);
			end if;
		end loop;
		v_applied_fields := array_append(v_applied_fields, 'categories');
	end if;

	if 'serving' = any(coalesce(p_candidate_fields, '{}'::text[]))
		and coalesce(v_food ->> 'hasSourceServing', 'false') <> 'true'
		and p_enriched_food ->> 'hasSourceServing' = 'true'
		and (
			coalesce(
				p_enriched_food ->> 'customServingWeightGrams',
				''
			) ~ '^[0-9]+([.][0-9]+)?$'
			or coalesce(
				p_enriched_food ->> 'servingSize',
				''
			) ~ '^[0-9]+([.][0-9]+)?$'
		) then
		foreach v_key in array array[
			'servingSize',
			'servingSizeUnit',
			'householdServingFullText',
			'hasSourceServing',
			'foodServings',
			'customServingLabel',
			'customServingWeightGrams',
			'customDensityGramsPerMilliliter',
			'customDensityLabel',
			'customDensityVariancePercent',
			'customDensityConfidence'
		]
		loop
			if p_enriched_food ? v_key then
				v_food := jsonb_set(
					v_food,
					array[v_key],
					p_enriched_food -> v_key,
					true
				);
			end if;
		end loop;
		v_applied_fields := array_append(v_applied_fields, 'serving');
	end if;

	if 'ingredients' = any(coalesce(p_candidate_fields, '{}'::text[])) then
		v_field_applied := false;
		if nullif(btrim(v_food ->> 'ingredients'), '') is null
			and nullif(
				btrim(p_enriched_food ->> 'ingredients'),
				''
			) is not null then
			v_food := jsonb_set(
				v_food,
				'{ingredients}',
				p_enriched_food -> 'ingredients',
				true
			);
			v_field_applied := true;
		end if;
		if (
			case
				when jsonb_typeof(v_food -> 'ingredientList') = 'array'
					then jsonb_array_length(v_food -> 'ingredientList') = 0
				else true
			end
		)
		and (
			case
				when jsonb_typeof(p_enriched_food -> 'ingredientList') = 'array'
					then jsonb_array_length(
						p_enriched_food -> 'ingredientList'
					) > 0
				else false
			end
		) then
			v_food := jsonb_set(
				v_food,
				'{ingredientList}',
				p_enriched_food -> 'ingredientList',
				true
			);
			v_field_applied := true;
		end if;
		if v_field_applied then
			v_applied_fields := array_append(v_applied_fields, 'ingredients');
		end if;
	end if;

	foreach v_field in array array[
		'allergens',
		'traces',
		'dietaryTags',
		'labels'
	]
	loop
		if v_field = any(coalesce(p_candidate_fields, '{}'::text[]))
			and (
				case
					when jsonb_typeof(v_food -> v_field) = 'array'
						then jsonb_array_length(v_food -> v_field) = 0
					else true
				end
			)
			and (
				case
					when jsonb_typeof(p_enriched_food -> v_field) = 'array'
						then jsonb_array_length(p_enriched_food -> v_field) > 0
					else false
				end
			) then
			v_food := jsonb_set(
				v_food,
				array[v_field],
				p_enriched_food -> v_field,
				true
			);
			v_applied_fields := array_append(v_applied_fields, v_field);
		end if;
	end loop;

	if cardinality(v_applied_fields) = 0 then
		return v_applied_fields;
	end if;

	foreach v_field in array v_applied_fields
	loop
		if (p_enriched_food -> 'fieldProvenance') ? v_field then
			v_food := jsonb_set(
				v_food,
				array['fieldProvenance', v_field],
				p_enriched_food -> 'fieldProvenance' -> v_field,
				true
			);
		end if;
	end loop;

	for v_observation in
		select value
		from jsonb_array_elements(p_observations)
	loop
		v_field := v_observation ->> 'trackedField';
		continue when not (v_field = any(v_applied_fields));
		if not exists (
			select 1
			from public.product_data_sources source
			where source.key = v_observation ->> 'source'
				and source.enabled
				and source.canonical_storage_allowed
				and source.canonical_license_name =
					v_observation ->> 'sourceLicense'
		) then
			raise exception 'Automatic enrichment requires an exact legally reusable source';
		end if;

		select observation.id
		into v_observation_id
		from public.shared_product_observations observation
		where observation.barcode = p_barcode
			and observation.source = v_observation ->> 'source'
			and observation.source_reference is not distinct from
				nullif(v_observation ->> 'sourceReference', '')
			and observation.content_hash = v_observation ->> 'contentHash'
		order by observation.observed_at desc
		limit 1;

		if v_observation_id is null then
			insert into public.shared_product_observations (
				barcode,
				source,
				source_reference,
				source_license,
				raw_payload,
				normalized_food,
				content_hash,
				observed_at
			)
			values (
				p_barcode,
				v_observation ->> 'source',
				nullif(v_observation ->> 'sourceReference', ''),
				v_observation ->> 'sourceLicense',
				v_observation -> 'rawPayload',
				null,
				v_observation ->> 'contentHash',
				coalesce(
					(v_observation ->> 'observedAt')::timestamptz,
					now()
				)
			)
			returning id into v_observation_id;
		end if;

		v_observation_ids := jsonb_set(
			v_observation_ids,
			array[v_observation ->> 'key'],
			to_jsonb(v_observation_id::text),
			true
		);
	end loop;

	for v_provenance in
		select value
		from jsonb_array_elements(p_provenance)
	loop
		v_field := v_provenance ->> 'fieldPath';
		continue when not (v_field = any(v_applied_fields));
		v_observation_id := (
			v_observation_ids ->> (v_provenance ->> 'observationKey')
		)::uuid;
		if v_observation_id is null then
			raise exception 'Canonical enrichment provenance is missing an observation';
		end if;

		update public.shared_product_field_provenance
		set selected = false
		where shared_product_id = v_product.id
			and field_path = v_field
			and selected;

		insert into public.shared_product_field_provenance (
			shared_product_id,
			observation_id,
			field_path,
			source_value,
			normalized_value,
			selected,
			confidence,
			verification_method
		)
		values (
			v_product.id,
			v_observation_id,
			v_field,
			v_provenance -> 'sourceValue',
			v_provenance -> 'normalizedValue',
			true,
			v_provenance ->> 'confidence',
			v_provenance ->> 'verificationMethod'
		);

		v_canonical_provenance := jsonb_set(
			v_canonical_provenance,
			array[v_field],
			jsonb_build_object(
				'source', v_provenance ->> 'source',
				'sourceReference', v_provenance ->> 'sourceReference',
				'observationId', v_observation_id,
				'confidence', v_provenance ->> 'confidence',
				'verificationMethod', v_provenance ->> 'verificationMethod'
			),
			true
		);
	end loop;

	update public.shared_products
	set
		food = v_food,
		category_option_id = case
			when 'categories' = any(v_applied_fields)
				then p_category_option_id
			else category_option_id
		end,
		canonical_provenance = v_canonical_provenance,
		last_verified_at = now(),
		updated_at = now()
	where id = v_product.id;

	select coalesce(max(revision_number), 0) + 1
	into v_revision_number
	from public.shared_product_revisions
	where shared_product_id = v_product.id;

	insert into public.shared_product_revisions (
		shared_product_id,
		revision_number,
		food,
		source,
		source_reference,
		category_option_id
	)
	values (
		v_product.id,
		v_revision_number,
		v_food,
		v_product.source,
		v_product.source_reference,
		case
			when 'categories' = any(v_applied_fields)
				then p_category_option_id
			else v_product.category_option_id
		end
	);

	return v_applied_fields;
end;
$$;

revoke all on function public.apply_shared_product_external_enrichment(
	uuid,
	text,
	jsonb,
	text,
	text[],
	jsonb,
	jsonb
) from public, anon, authenticated;

grant execute on function public.apply_shared_product_external_enrichment(
	uuid,
	text,
	jsonb,
	text,
	text[],
	jsonb,
	jsonb
) to service_role;
