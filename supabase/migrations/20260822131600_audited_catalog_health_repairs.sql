create table public.catalog_health_repair_runs (
	id uuid primary key default gen_random_uuid(),
	requested_by uuid not null references auth.users(id) on delete restrict,
	occurrence_key text not null,
	issue_code text not null references public.app_issue_codes(code) on delete restrict,
	repair_key text not null,
	mode text not null check (mode in ('dry_run', 'apply')),
	dry_run_id uuid references public.catalog_health_repair_runs(id) on delete restrict,
	status text not null default 'running'
		check (status in ('running', 'completed', 'completed_with_unresolved', 'failed')),
	candidate_count integer not null default 0 check (candidate_count >= 0),
	changed_count integer not null default 0 check (changed_count >= 0),
	skipped_count integer not null default 0 check (skipped_count >= 0),
	unresolved_count integer not null default 0 check (unresolved_count >= 0),
	error_count integer not null default 0 check (error_count >= 0),
	summary text,
	started_at timestamptz not null default now(),
	completed_at timestamptz,
	check (
		(mode = 'dry_run' and dry_run_id is null)
		or (mode = 'apply' and dry_run_id is not null)
	),
	check (
		(status = 'running' and completed_at is null)
		or (status <> 'running' and completed_at is not null)
	)
);

create index catalog_health_repair_runs_recent_idx
	on public.catalog_health_repair_runs (started_at desc);

create index catalog_health_repair_runs_occurrence_idx
	on public.catalog_health_repair_runs (occurrence_key, started_at desc);

create table public.catalog_health_repair_run_items (
	id bigint generated always as identity primary key,
	run_id uuid not null
		references public.catalog_health_repair_runs(id) on delete cascade,
	item_key text not null,
	result text not null
		check (result in ('would_change', 'changed', 'skipped', 'unresolved', 'failed')),
	reason_code text not null,
	before_value jsonb,
	after_value jsonb,
	created_at timestamptz not null default now(),
	unique (run_id, item_key)
);

create index catalog_health_repair_run_items_result_idx
	on public.catalog_health_repair_run_items (run_id, result, id);

alter table public.catalog_health_repair_runs enable row level security;
alter table public.catalog_health_repair_runs force row level security;
alter table public.catalog_health_repair_run_items enable row level security;
alter table public.catalog_health_repair_run_items force row level security;

revoke all on table public.catalog_health_repair_runs
	from public, anon, authenticated;
revoke all on table public.catalog_health_repair_run_items
	from public, anon, authenticated;
grant select, insert, update on table public.catalog_health_repair_runs
	to service_role;
grant select, insert on table public.catalog_health_repair_run_items
	to service_role;

create or replace function public.catalog_health_field_value(
	p_food jsonb,
	p_product_name text,
	p_brand_owner text,
	p_field_path text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
	select case p_field_path
		when 'productName' then to_jsonb(p_product_name)
		when 'brandOwner' then to_jsonb(p_brand_owner)
		when 'package' then p_food -> 'packageQuantity'
		else p_food -> p_field_path
	end;
$$;

create or replace function public.catalog_health_observation_field_value(
	p_food jsonb,
	p_field_path text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
	select case p_field_path
		when 'productName' then p_food -> 'description'
		when 'package' then p_food -> 'packageQuantity'
		else p_food -> p_field_path
	end;
$$;

create or replace function public.run_catalog_health_repair(
	p_occurrence_key text,
	p_apply boolean default false,
	p_dry_run_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_occurrence record;
	v_issue public.app_issue_codes%rowtype;
	v_product public.shared_products%rowtype;
	v_run_id uuid;
	v_mode text := case when p_apply then 'apply' else 'dry_run' end;
	v_candidate_count integer := 0;
	v_changed_count integer := 0;
	v_skipped_count integer := 0;
	v_unresolved_count integer := 0;
	v_error_count integer := 0;
	v_run_status text;
	v_field_path text;
	v_current_value jsonb;
	v_observation_id uuid;
	v_observation_source text;
	v_observation_reference text;
	v_observation_value jsonb;
	v_matching_source_count integer;
	v_nutrient record;
	v_serving record;
	v_candidate_serving record;
	v_confidence text;
	v_verification_method text;
	v_result text;
begin
	if not public.authorize_app_permission('data_operations.catalog_health.repair') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog repair access is required.';
	end if;

	select occurrence.*
	into v_occurrence
	from public.catalog_health_issue_occurrences occurrence
	where occurrence.occurrence_key = p_occurrence_key
		and occurrence.status = 'open';
	if not found then
		raise exception using
			errcode = 'P0002',
			message = 'The catalog issue is no longer open.';
	end if;

	select *
	into v_issue
	from public.app_issue_codes issue
	where issue.code = v_occurrence.issue_code
		and issue.enabled;
	if not found
		or not v_issue.automated_repair_allowed
		or nullif(btrim(v_issue.automated_repair_key), '') is null then
		raise exception 'This catalog issue does not support an evidence-only repair';
	end if;

	if p_apply then
		if p_dry_run_id is null or not exists (
			select 1
			from public.catalog_health_repair_runs dry_run
			where dry_run.id = p_dry_run_id
				and dry_run.requested_by = (select auth.uid())
				and dry_run.occurrence_key = p_occurrence_key
				and dry_run.repair_key = v_issue.automated_repair_key
				and dry_run.mode = 'dry_run'
				and dry_run.status in ('completed', 'completed_with_unresolved')
				and dry_run.candidate_count > 0
				and dry_run.started_at >= now() - interval '1 hour'
		) then
			raise exception 'A current successful dry run is required before applying this repair';
		end if;
	elsif p_dry_run_id is not null then
		raise exception 'A dry run cannot reference another dry run';
	end if;

	insert into public.catalog_health_repair_runs (
		requested_by,
		occurrence_key,
		issue_code,
		repair_key,
		mode,
		dry_run_id
	)
	values (
		(select auth.uid()),
		p_occurrence_key,
		v_occurrence.issue_code,
		v_issue.automated_repair_key,
		v_mode,
		p_dry_run_id
	)
	returning id into v_run_id;

	begin
		if v_occurrence.shared_product_id is null then
			insert into public.catalog_health_repair_run_items (
				run_id, item_key, result, reason_code
			)
			values (
				v_run_id, v_occurrence.subject_key, 'unresolved',
				'product_required'
			);
			v_unresolved_count := 1;
		else
			select * into v_product
			from public.shared_products product
			where product.id = v_occurrence.shared_product_id
			for update;
		end if;

		if v_unresolved_count = 0
			and v_issue.automated_repair_key = 'link_existing_field_observation' then
			v_field_path := v_occurrence.parameters ->> 'key';
			v_current_value := public.catalog_health_field_value(
				v_product.food,
				v_product.product_name,
				v_product.brand_owner,
				v_field_path
			);

			if v_field_path is null or v_current_value is null or v_current_value = 'null'::jsonb then
				insert into public.catalog_health_repair_run_items (
					run_id, item_key, result, reason_code, before_value
				)
				values (
					v_run_id, coalesce(v_field_path, 'field'), 'unresolved',
					'canonical_value_missing', v_current_value
				);
				v_unresolved_count := v_unresolved_count + 1;
			else
				select
					(array_agg(observation.id order by observation.observed_at desc, observation.id))[1],
					(array_agg(observation.source order by observation.observed_at desc, observation.id))[1],
					(array_agg(observation.source_reference order by observation.observed_at desc, observation.id))[1],
					(array_agg(public.catalog_health_observation_field_value(
						observation.normalized_food, v_field_path
					) order by observation.observed_at desc, observation.id))[1],
					count(distinct observation.source)::integer
				into
					v_observation_id,
					v_observation_source,
					v_observation_reference,
					v_observation_value,
					v_matching_source_count
				from public.shared_product_observations observation
				where observation.barcode = v_product.barcode
					and observation.normalized_food is not null
					and nullif(btrim(observation.source_reference), '') is not null
					and public.blendcalc_api_v1_source_attribution_is_complete(
						observation.source,
						observation.source_reference
					)
					and public.catalog_health_observation_field_value(
						observation.normalized_food,
						v_field_path
					) = v_current_value;

				if v_observation_id is null then
					insert into public.catalog_health_repair_run_items (
						run_id, item_key, result, reason_code, before_value
					)
					values (
						v_run_id, v_field_path, 'unresolved',
						'no_exact_redistributable_observation', v_current_value
					);
					v_unresolved_count := v_unresolved_count + 1;
				else
					v_candidate_count := v_candidate_count + 1;
					v_result := case when p_apply then 'changed' else 'would_change' end;
					insert into public.catalog_health_repair_run_items (
						run_id, item_key, result, reason_code, before_value, after_value
					)
					values (
						v_run_id,
						v_field_path,
						v_result,
						'exact_value_match',
						v_current_value,
						jsonb_build_object(
							'observationId', v_observation_id,
							'source', v_observation_source,
							'sourceReference', v_observation_reference
						)
					);

					if p_apply then
						v_confidence := case when v_matching_source_count > 1
							then 'corroborated' else 'source-verified' end;
						v_verification_method := case when v_matching_source_count > 1
							then 'cross-source' else 'exact-barcode' end;
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
						select
							v_product.id,
							v_observation_id,
							v_field_path,
							v_observation_value,
							v_current_value,
							true,
							v_confidence,
							v_verification_method
						where not exists (
							select 1
							from public.shared_product_field_provenance provenance
							where provenance.shared_product_id = v_product.id
								and provenance.field_path = v_field_path
								and provenance.selected
						);

						if found then
							update public.shared_products
							set canonical_provenance = jsonb_set(
								coalesce(canonical_provenance, '{}'::jsonb),
								array[v_field_path],
								jsonb_build_object(
									'source', v_observation_source,
									'sourceReference', v_observation_reference,
									'observationId', v_observation_id,
									'confidence', v_confidence,
									'verificationMethod', v_verification_method
								),
								true
							)
							where id = v_product.id;
							v_changed_count := v_changed_count + 1;
						else
							update public.catalog_health_repair_run_items
							set result = 'skipped', reason_code = 'already_repaired'
							where run_id = v_run_id and item_key = v_field_path;
							v_skipped_count := v_skipped_count + 1;
						end if;
					end if;
				end if;
			end if;
		elsif v_unresolved_count = 0
			and v_issue.automated_repair_key = 'link_existing_nutrient_observation' then
			for v_nutrient in
				select nutrient.*
				from public.food_nutrients nutrient
				where nutrient.shared_product_id = v_product.id
					and not exists (
						select 1
						from public.shared_product_field_provenance provenance
						where provenance.shared_product_id = v_product.id
							and provenance.field_path = 'nutrient:' || nutrient.nutrient_id::text
							and provenance.selected
					)
				order by nutrient.nutrient_id
				limit 250
			loop
				v_observation_id := null;
				select
					(array_agg(observation.id order by observation.observed_at desc, observation.id))[1],
					(array_agg(observation.source order by observation.observed_at desc, observation.id))[1],
					(array_agg(observation.source_reference order by observation.observed_at desc, observation.id))[1],
					count(distinct observation.source)::integer
				into
					v_observation_id,
					v_observation_source,
					v_observation_reference,
					v_matching_source_count
				from public.food_nutrients observed_nutrient
				join public.shared_product_observations observation
					on observation.id = observed_nutrient.shared_product_observation_id
				where observation.barcode = v_product.barcode
					and observed_nutrient.nutrient_id = v_nutrient.nutrient_id
					and observed_nutrient.amount_per_100g = v_nutrient.amount_per_100g
					and upper(observed_nutrient.unit_name) = upper(v_nutrient.unit_name)
					and observed_nutrient.value_status = v_nutrient.value_status
					and nullif(btrim(observation.source_reference), '') is not null
					and public.blendcalc_api_v1_source_attribution_is_complete(
						observation.source,
						observation.source_reference
					);

				if v_observation_id is null then
					insert into public.catalog_health_repair_run_items (
						run_id, item_key, result, reason_code, before_value
					)
					values (
						v_run_id,
						'nutrient:' || v_nutrient.nutrient_id::text,
						'unresolved',
						'no_exact_redistributable_observation',
						jsonb_build_object(
							'amountPer100Grams', v_nutrient.amount_per_100g,
							'unit', v_nutrient.unit_name,
							'valueStatus', v_nutrient.value_status
						)
					);
					v_unresolved_count := v_unresolved_count + 1;
					continue;
				end if;

				v_candidate_count := v_candidate_count + 1;
				v_result := case when p_apply then 'changed' else 'would_change' end;
				insert into public.catalog_health_repair_run_items (
					run_id, item_key, result, reason_code, before_value, after_value
				)
				values (
					v_run_id,
					'nutrient:' || v_nutrient.nutrient_id::text,
					v_result,
					'exact_nutrient_match',
					jsonb_build_object(
						'amountPer100Grams', v_nutrient.amount_per_100g,
						'unit', v_nutrient.unit_name,
						'valueStatus', v_nutrient.value_status
					),
					jsonb_build_object(
						'observationId', v_observation_id,
						'source', v_observation_source,
						'sourceReference', v_observation_reference
					)
				);

				if p_apply then
					v_confidence := case when v_matching_source_count > 1
						then 'corroborated' else 'source-verified' end;
					v_verification_method := case when v_matching_source_count > 1
						then 'cross-source' else 'exact-barcode' end;
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
					select
						v_product.id,
						v_observation_id,
						'nutrient:' || v_nutrient.nutrient_id::text,
						jsonb_build_object(
							'amountPer100Grams', v_nutrient.amount_per_100g,
							'unit', v_nutrient.unit_name,
							'valueStatus', v_nutrient.value_status
						),
						jsonb_build_object(
							'amountPer100Grams', v_nutrient.amount_per_100g,
							'unit', v_nutrient.unit_name,
							'valueStatus', v_nutrient.value_status
						),
						true,
						v_confidence,
						v_verification_method
					where not exists (
						select 1
						from public.shared_product_field_provenance provenance
						where provenance.shared_product_id = v_product.id
							and provenance.field_path = 'nutrient:' || v_nutrient.nutrient_id::text
							and provenance.selected
					);
					if found then
						update public.food_nutrients
						set
							source_observation_id = v_observation_id,
							source = v_observation_source,
							source_reference = v_observation_reference,
							confidence = v_confidence
						where id = v_nutrient.id;
						v_changed_count := v_changed_count + 1;
					else
						update public.catalog_health_repair_run_items
						set result = 'skipped', reason_code = 'already_repaired'
						where run_id = v_run_id
							and item_key = 'nutrient:' || v_nutrient.nutrient_id::text;
						v_skipped_count := v_skipped_count + 1;
					end if;
				end if;
			end loop;
		elsif v_unresolved_count = 0
			and v_issue.automated_repair_key = 'link_existing_serving_observation' then
			select serving.*
			into v_serving
			from public.food_servings serving
			where serving.shared_product_id = v_product.id
				and serving.is_primary
			order by serving.serving_order, serving.id
			limit 1;

			if not found then
				insert into public.catalog_health_repair_run_items (
					run_id, item_key, result, reason_code
				)
				values (
					v_run_id, 'serving', 'unresolved',
					'primary_serving_missing'
				);
				v_unresolved_count := v_unresolved_count + 1;
			else
				select
					observation.id as observation_id,
					observation.source,
					observation.source_reference,
					observed_serving.id as observed_serving_id
				into v_candidate_serving
				from public.food_servings observed_serving
				join public.shared_product_observations observation
					on observation.id = observed_serving.shared_product_observation_id
				where observation.barcode = v_product.barcode
					and lower(btrim(observed_serving.label)) = lower(btrim(v_serving.label))
					and observed_serving.gram_weight = v_serving.gram_weight
					and observed_serving.amount is not distinct from v_serving.amount
					and observed_serving.unit_key is not distinct from v_serving.unit_key
					and nullif(btrim(observation.source_reference), '') is not null
					and public.blendcalc_api_v1_source_attribution_is_complete(
						observation.source,
						observation.source_reference
					)
				order by observation.observed_at desc, observation.id
				limit 1;

				if not found then
					insert into public.catalog_health_repair_run_items (
						run_id, item_key, result, reason_code, before_value
					)
					values (
						v_run_id,
						'serving',
						'unresolved',
						'no_exact_redistributable_observation',
						jsonb_build_object(
							'label', v_serving.label,
							'gramWeight', v_serving.gram_weight,
							'amount', v_serving.amount,
							'unitKey', v_serving.unit_key
						)
					);
					v_unresolved_count := v_unresolved_count + 1;
				else
					v_candidate_count := v_candidate_count + 1;
					v_result := case when p_apply then 'changed' else 'would_change' end;
					insert into public.catalog_health_repair_run_items (
						run_id, item_key, result, reason_code, before_value, after_value
					)
					values (
						v_run_id,
						'serving',
						v_result,
						'exact_serving_match',
						jsonb_build_object(
							'label', v_serving.label,
							'gramWeight', v_serving.gram_weight,
							'amount', v_serving.amount,
							'unitKey', v_serving.unit_key
						),
						jsonb_build_object(
							'observationId', v_candidate_serving.observation_id,
							'source', v_candidate_serving.source,
							'sourceReference', v_candidate_serving.source_reference
						)
					);

					if p_apply then
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
						select
							v_product.id,
							v_candidate_serving.observation_id,
							field_path,
							jsonb_build_object(
								'label', v_serving.label,
								'gramWeight', v_serving.gram_weight,
								'amount', v_serving.amount,
								'unitKey', v_serving.unit_key
							),
							case when field_path = 'servingWeightGrams'
								then to_jsonb(v_serving.gram_weight)
								else jsonb_build_object(
									'label', v_serving.label,
									'gramWeight', v_serving.gram_weight,
									'amount', v_serving.amount,
									'unitKey', v_serving.unit_key
								)
							end,
							true,
							'source-verified',
							'exact-barcode'
						from unnest(array['serving', 'servingWeightGrams'])
							as requested_field_path(field_path)
						where not exists (
							select 1
							from public.shared_product_field_provenance provenance
							where provenance.shared_product_id = v_product.id
								and provenance.field_path = requested_field_path.field_path
								and provenance.selected
						);

						update public.food_servings
						set
							source_observation_id = v_candidate_serving.observation_id,
							source = v_candidate_serving.source,
							source_reference = v_candidate_serving.source_reference,
							confidence = 'source-verified'
						where id = v_serving.id;
						v_changed_count := v_changed_count + 1;
					end if;
				end if;
			end if;
		else
			insert into public.catalog_health_repair_run_items (
				run_id, item_key, result, reason_code
			)
			values (
				v_run_id, v_occurrence.subject_key, 'unresolved',
				'repair_handler_not_available'
			);
			v_unresolved_count := v_unresolved_count + 1;
		end if;

		v_run_status := case
			when v_unresolved_count > 0 then 'completed_with_unresolved'
			else 'completed'
		end;
		update public.catalog_health_repair_runs
		set
			status = v_run_status,
			candidate_count = v_candidate_count,
			changed_count = v_changed_count,
			skipped_count = v_skipped_count,
			unresolved_count = v_unresolved_count,
			error_count = v_error_count,
			summary = case
				when p_apply then 'Evidence-only catalog repair completed.'
				else 'Evidence-only catalog repair dry run completed.'
			end,
			completed_at = now()
		where id = v_run_id;
	exception when others then
		v_error_count := v_error_count + 1;
		insert into public.catalog_health_repair_run_items (
			run_id, item_key, result, reason_code
		)
		values (
			v_run_id, v_occurrence.subject_key, 'failed', 'repair_execution_failed'
		)
		on conflict (run_id, item_key) do update
		set result = 'failed', reason_code = 'repair_execution_failed';
		update public.catalog_health_repair_runs
		set
			status = 'failed',
			error_count = v_error_count,
			summary = 'The repair could not be completed safely.',
			completed_at = now()
		where id = v_run_id;
	end;

	return jsonb_build_object(
		'runId', v_run_id,
		'mode', v_mode,
		'status', (
			select run.status from public.catalog_health_repair_runs run where run.id = v_run_id
		),
		'candidateCount', (
			select run.candidate_count from public.catalog_health_repair_runs run where run.id = v_run_id
		),
		'changedCount', (
			select run.changed_count from public.catalog_health_repair_runs run where run.id = v_run_id
		),
		'skippedCount', (
			select run.skipped_count from public.catalog_health_repair_runs run where run.id = v_run_id
		),
		'unresolvedCount', (
			select run.unresolved_count from public.catalog_health_repair_runs run where run.id = v_run_id
		),
		'items', coalesce((
			select jsonb_agg(jsonb_build_object(
				'itemKey', item.item_key,
				'result', item.result,
				'reasonCode', item.reason_code
			) order by item.id)
			from public.catalog_health_repair_run_items item
			where item.run_id = v_run_id
		), '[]'::jsonb)
	);
end;
$$;

revoke all on function public.catalog_health_field_value(jsonb, text, text, text)
	from public, anon, authenticated;
revoke all on function public.catalog_health_observation_field_value(jsonb, text)
	from public, anon, authenticated;
grant execute on function public.catalog_health_field_value(jsonb, text, text, text)
	to service_role;
grant execute on function public.catalog_health_observation_field_value(jsonb, text)
	to service_role;

revoke all on function public.run_catalog_health_repair(text, boolean, uuid)
	from public, anon, authenticated, service_role;
grant execute on function public.run_catalog_health_repair(text, boolean, uuid)
	to authenticated;

update public.app_issue_codes
set automated_repair_allowed = false
where code = 'CATALOG_REVISION_MISSING';

comment on table public.catalog_health_repair_runs is
	'Immutable operator-facing dry-run and apply history for bounded evidence-only catalog repairs.';
comment on table public.catalog_health_repair_run_items is
	'Per-record catalog repair outcomes. Values are bounded audit snapshots and never substitute for source observations.';
comment on function public.run_catalog_health_repair(text, boolean, uuid) is
	'Runs an AAL2 evidence-only catalog repair. Apply requires a current successful dry run and records every changed, skipped, unresolved, or failed item.';
