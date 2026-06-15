alter table public.shared_products
	drop constraint if exists shared_products_source_check,
	add constraint shared_products_source_check
		check (source in ('usda', 'open-food-facts', 'community-reviewed'));

alter table public.shared_products
	drop constraint if exists shared_products_confidence_check,
	add constraint shared_products_confidence_check
		check (
			confidence in (
				'source-verified',
				'moderator-reviewed',
				'corroborated',
				'imported'
			)
		);

alter table public.shared_product_revisions
	drop constraint if exists shared_product_revisions_source_check,
	add constraint shared_product_revisions_source_check
		check (source in ('usda', 'open-food-facts', 'community-reviewed'));

alter table public.shared_product_observations
	drop constraint if exists shared_product_observations_source_check,
	add constraint shared_product_observations_source_check
		check (
			source in (
				'usda',
				'open-food-facts',
				'user-label',
				'manufacturer',
				'gs1'
			)
		);

alter table public.shared_product_field_provenance
	drop constraint if exists shared_product_field_provenance_confidence_check,
	add constraint shared_product_field_provenance_confidence_check
		check (
			confidence in (
				'source-verified',
				'moderator-reviewed',
				'corroborated',
				'imported'
			)
		);

create or replace function public.publish_shared_product_submission(
	p_submission_id uuid,
	p_food jsonb,
	p_product_name text,
	p_brand_owner text,
	p_source text,
	p_source_reference text,
	p_confidence text,
	p_approved_by uuid default null,
	p_observations jsonb default '[]'::jsonb,
	p_provenance jsonb default '[]'::jsonb,
	p_conflicts jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_submission public.shared_product_submissions%rowtype;
	v_product_id uuid;
	v_revision_number integer;
	v_observation jsonb;
	v_provenance jsonb;
	v_conflict jsonb;
	v_observation_id uuid;
	v_observation_ids jsonb := '{}'::jsonb;
	v_canonical_provenance jsonb := '{}'::jsonb;
begin
	if p_source not in ('usda', 'open-food-facts', 'community-reviewed') then
		raise exception 'Unsupported shared product source';
	end if;
	if p_confidence not in (
		'source-verified',
		'moderator-reviewed',
		'corroborated',
		'imported'
	) then
		raise exception 'Unsupported shared product confidence';
	end if;
	if jsonb_typeof(p_food) <> 'object' then
		raise exception 'Shared product food must be a JSON object';
	end if;
	if jsonb_typeof(p_observations) <> 'array'
		or jsonb_typeof(p_provenance) <> 'array'
		or jsonb_typeof(p_conflicts) <> 'array' then
		raise exception 'Catalog verification metadata must use arrays';
	end if;
	if btrim(p_product_name) = '' then
		raise exception 'Shared product name cannot be blank';
	end if;

	select *
	into v_submission
	from public.shared_product_submissions
	where id = p_submission_id
	for update;

	if not found then
		raise exception 'Shared product submission not found';
	end if;
	if v_submission.status <> 'pending' then
		raise exception 'Shared product submission has already been reviewed';
	end if;

	perform pg_advisory_xact_lock(hashtext(v_submission.barcode));

	for v_observation in select value from jsonb_array_elements(p_observations)
	loop
		insert into public.shared_product_observations (
			barcode,
			source,
			source_reference,
			source_license,
			submission_id,
			submitted_by,
			raw_payload,
			normalized_food,
			content_hash,
			observed_at,
			expires_at
		)
		values (
			v_submission.barcode,
			v_observation ->> 'source',
			nullif(v_observation ->> 'sourceReference', ''),
			v_observation ->> 'sourceLicense',
			v_submission.id,
			case when v_observation ->> 'source' = 'user-label'
				then v_submission.submitted_by else null end,
			coalesce(v_observation -> 'rawPayload', '{}'::jsonb),
			v_observation -> 'normalizedFood',
			v_observation ->> 'contentHash',
			coalesce((v_observation ->> 'observedAt')::timestamptz, now()),
			case when v_observation ? 'expiresAt'
				then (v_observation ->> 'expiresAt')::timestamptz else null end
		)
		returning id into v_observation_id;

		v_observation_ids := jsonb_set(
			v_observation_ids,
			array[v_observation ->> 'key'],
			to_jsonb(v_observation_id::text),
			true
		);
	end loop;

	insert into public.shared_products (
		barcode,
		product_name,
		brand_owner,
		search_text,
		food,
		source,
		source_reference,
		confidence,
		status,
		approved_submission_id,
		approved_by,
		last_verified_at
	)
	values (
		v_submission.barcode,
		btrim(p_product_name),
		nullif(btrim(p_brand_owner), ''),
		lower(concat_ws(' ', p_product_name, p_brand_owner, v_submission.barcode)),
		p_food,
		p_source,
		p_source_reference,
		p_confidence,
		'active',
		v_submission.id,
		p_approved_by,
		now()
	)
	on conflict (barcode) do update
	set product_name = excluded.product_name,
		brand_owner = excluded.brand_owner,
		search_text = excluded.search_text,
		food = excluded.food,
		source = excluded.source,
		source_reference = excluded.source_reference,
		confidence = excluded.confidence,
		status = 'active',
		approved_submission_id = excluded.approved_submission_id,
		approved_by = excluded.approved_by,
		last_verified_at = now(),
		updated_at = now()
	returning id into v_product_id;

	update public.shared_product_field_provenance
	set selected = false
	where shared_product_id = v_product_id and selected;

	for v_provenance in select value from jsonb_array_elements(p_provenance)
	loop
		v_observation_id := (v_observation_ids ->> (v_provenance ->> 'observationKey'))::uuid;
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
			v_product_id,
			v_observation_id,
			v_provenance ->> 'fieldPath',
			v_provenance -> 'sourceValue',
			v_provenance -> 'normalizedValue',
			true,
			v_provenance ->> 'confidence',
			v_provenance ->> 'verificationMethod'
		);

		v_canonical_provenance := jsonb_set(
			v_canonical_provenance,
			array[v_provenance ->> 'fieldPath'],
			jsonb_build_object(
				'source', v_provenance ->> 'observationKey',
				'confidence', v_provenance ->> 'confidence',
				'verificationMethod', v_provenance ->> 'verificationMethod'
			),
			true
		);
	end loop;

	update public.shared_products
	set canonical_provenance = v_canonical_provenance
	where id = v_product_id;

	update public.shared_product_conflicts
	set status = 'superseded'
	where shared_product_id = v_product_id and status = 'open';

	for v_conflict in select value from jsonb_array_elements(p_conflicts)
	loop
		insert into public.shared_product_conflicts (
			shared_product_id,
			barcode,
			field_path,
			observed_values,
			severity
		)
		values (
			v_product_id,
			v_submission.barcode,
			v_conflict ->> 'fieldPath',
			v_conflict -> 'observedValues',
			v_conflict ->> 'severity'
		);
	end loop;

	select coalesce(max(revision_number), 0) + 1
	into v_revision_number
	from public.shared_product_revisions
	where shared_product_id = v_product_id;

	insert into public.shared_product_revisions (
		shared_product_id,
		revision_number,
		food,
		source,
		source_reference,
		created_by
	)
	values (
		v_product_id,
		v_revision_number,
		p_food,
		p_source,
		p_source_reference,
		p_approved_by
	);

	update public.shared_product_submissions
	set status = 'approved',
		verification_status = case
			when p_source = 'usda' then 'source_verified'
			else 'manual_review'
		end,
		reviewed_by = p_approved_by,
		reviewed_at = now()
	where id = v_submission.id;

	return v_product_id;
end;
$$;

revoke all on function public.publish_shared_product_submission(
	uuid, jsonb, text, text, text, text, text, uuid, jsonb, jsonb, jsonb
)
	from public, anon, authenticated;
grant execute on function public.publish_shared_product_submission(
	uuid, jsonb, text, text, text, text, text, uuid, jsonb, jsonb, jsonb
)
	to service_role;
