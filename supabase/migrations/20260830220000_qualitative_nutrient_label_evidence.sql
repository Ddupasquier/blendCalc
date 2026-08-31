create table public.food_nutrient_qualitative_evidence (
	id bigint generated always as identity primary key,
	owner_user_id uuid references auth.users(id) on delete cascade,
	user_food_list_item_id uuid references public.user_food_list_items(id) on delete cascade,
	custom_food_id uuid references public.custom_foods(id) on delete cascade,
	shared_product_submission_id uuid references public.shared_product_submissions(id) on delete cascade,
	shared_product_id uuid references public.shared_products(id) on delete cascade,
	shared_product_revision_id uuid references public.shared_product_revisions(id) on delete cascade,
	shared_product_observation_id uuid references public.shared_product_observations(id) on delete cascade,
	source_observation_id uuid references public.shared_product_observations(id) on delete set null,
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete restrict,
	qualitative_status text not null check (
		qualitative_status in ('below-reporting-threshold', 'present-unquantified')
	),
	statement_text text not null check (btrim(statement_text) <> ''),
	maximum_amount numeric check (maximum_amount is null or maximum_amount >= 0),
	unit_name text not null check (btrim(unit_name) <> ''),
	basis_kind text not null check (basis_kind in ('mass', 'volume', 'serving')),
	basis_quantity numeric not null check (basis_quantity > 0),
	basis_unit_key text not null check (btrim(basis_unit_key) <> ''),
	basis_serving_label text,
	source text not null check (btrim(source) <> ''),
	source_reference text,
	confidence text not null check (btrim(confidence) <> ''),
	source_nutrient_key text,
	source_nutrient_code text,
	mapping_status text not null default 'unknown' check (
		mapping_status in ('canonical', 'unmapped', 'excluded', 'unknown')
	),
	mapping_method text,
	mapping_review_reference text,
	policy_key text,
	policy_reference text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint food_nutrient_qualitative_evidence_one_parent check (
		num_nonnulls(
			user_food_list_item_id,
			custom_food_id,
			shared_product_submission_id,
			shared_product_id,
			shared_product_revision_id,
			shared_product_observation_id
		) = 1
	),
	constraint food_nutrient_qualitative_evidence_private_owner check (
		owner_user_id is null
		or user_food_list_item_id is not null
		or custom_food_id is not null
		or shared_product_submission_id is not null
	),
	constraint food_nutrient_qualitative_evidence_basis_label check (
		(basis_kind = 'serving' and nullif(btrim(basis_serving_label), '') is not null)
		or (basis_kind <> 'serving' and basis_serving_label is null)
	)
);

create unique index food_nutrient_qualitative_evidence_list_item_unique
	on public.food_nutrient_qualitative_evidence (user_food_list_item_id, nutrient_id)
	where user_food_list_item_id is not null;
create unique index food_nutrient_qualitative_evidence_custom_food_unique
	on public.food_nutrient_qualitative_evidence (custom_food_id, nutrient_id)
	where custom_food_id is not null;
create unique index food_nutrient_qualitative_evidence_submission_unique
	on public.food_nutrient_qualitative_evidence (shared_product_submission_id, nutrient_id)
	where shared_product_submission_id is not null;
create unique index food_nutrient_qualitative_evidence_product_unique
	on public.food_nutrient_qualitative_evidence (shared_product_id, nutrient_id)
	where shared_product_id is not null;
create unique index food_nutrient_qualitative_evidence_revision_unique
	on public.food_nutrient_qualitative_evidence (shared_product_revision_id, nutrient_id)
	where shared_product_revision_id is not null;
create unique index food_nutrient_qualitative_evidence_observation_unique
	on public.food_nutrient_qualitative_evidence (shared_product_observation_id, nutrient_id)
	where shared_product_observation_id is not null;

create index food_nutrient_qualitative_evidence_product_lookup_idx
	on public.food_nutrient_qualitative_evidence (
		shared_product_id,
		nutrient_id,
		qualitative_status
	)
	where shared_product_id is not null;

create trigger set_food_nutrient_qualitative_evidence_updated_at
	before update on public.food_nutrient_qualitative_evidence
	for each row execute function public.set_updated_at();

create function public.sync_food_nutrient_qualitative_evidence_from_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_food jsonb;
	v_owner_user_id uuid;
	v_default_source text;
	v_default_source_reference text;
	v_default_confidence text;
	v_user_food_list_item_id uuid;
	v_custom_food_id uuid;
	v_shared_product_submission_id uuid;
	v_shared_product_id uuid;
	v_shared_product_revision_id uuid;
	v_shared_product_observation_id uuid;
begin
	case tg_table_name
		when 'user_food_list_items' then
			v_food := new.food;
			v_owner_user_id := new.user_id;
			v_user_food_list_item_id := new.id;
		when 'custom_foods' then
			v_food := new.food;
			v_owner_user_id := new.user_id;
			v_custom_food_id := new.id;
		when 'shared_product_submissions' then
			v_food := new.food;
			v_owner_user_id := new.submitted_by;
			v_shared_product_submission_id := new.id;
		when 'shared_products' then
			v_food := new.food;
			v_shared_product_id := new.id;
		when 'shared_product_revisions' then
			v_food := new.food;
			v_shared_product_revision_id := new.id;
		when 'shared_product_observations' then
			v_food := new.normalized_food;
			v_shared_product_observation_id := new.id;
			v_default_source := new.source;
			v_default_source_reference := new.source_reference;
		else
			raise exception 'Unsupported qualitative nutrient evidence parent table';
	end case;

	v_default_source := coalesce(v_default_source, case v_food ->> 'barcodeSource'
		when 'usda' then 'usda'
		when 'open-food-facts' then 'open-food-facts'
		when 'community' then 'community-reviewed'
		when 'manual' then 'user-label'
		else case when v_owner_user_id is not null then 'user-label' else 'unknown' end
	end);
	v_default_source_reference := coalesce(
		v_default_source_reference,
		nullif(btrim(v_food ->> 'barcode'), ''),
		nullif(btrim(v_food ->> 'gtinUpc'), '')
	);
	v_default_confidence := case
		when v_default_source = 'user-label' then 'user-reported'
		when v_default_source = 'usda' then 'source-verified'
		else 'imported'
	end;

	delete from public.food_nutrient_qualitative_evidence evidence
	where (v_user_food_list_item_id is not null and evidence.user_food_list_item_id = v_user_food_list_item_id)
		or (v_custom_food_id is not null and evidence.custom_food_id = v_custom_food_id)
		or (v_shared_product_submission_id is not null and evidence.shared_product_submission_id = v_shared_product_submission_id)
		or (v_shared_product_id is not null and evidence.shared_product_id = v_shared_product_id)
		or (v_shared_product_revision_id is not null and evidence.shared_product_revision_id = v_shared_product_revision_id)
		or (v_shared_product_observation_id is not null and evidence.shared_product_observation_id = v_shared_product_observation_id);

	if jsonb_typeof(v_food -> 'nutrientQualitativeFacts') = 'array' then
		insert into public.food_nutrient_qualitative_evidence (
			owner_user_id,
			user_food_list_item_id,
			custom_food_id,
			shared_product_submission_id,
			shared_product_id,
			shared_product_revision_id,
			shared_product_observation_id,
			source_observation_id,
			nutrient_id,
			qualitative_status,
			statement_text,
			maximum_amount,
			unit_name,
			basis_kind,
			basis_quantity,
			basis_unit_key,
			basis_serving_label,
			source,
			source_reference,
			confidence,
			source_nutrient_key,
			source_nutrient_code,
			mapping_status,
			mapping_method,
			mapping_review_reference,
			policy_key,
			policy_reference
		)
		select distinct on ((fact.value ->> 'nutrientId')::bigint)
			v_owner_user_id,
			v_user_food_list_item_id,
			v_custom_food_id,
			v_shared_product_submission_id,
			v_shared_product_id,
			v_shared_product_revision_id,
			v_shared_product_observation_id,
			coalesce(
				case when jsonb_typeof(fact.value -> 'sourceObservationId') = 'string'
					then (fact.value ->> 'sourceObservationId')::uuid else null end,
				v_shared_product_observation_id
			),
			(fact.value ->> 'nutrientId')::bigint,
			fact.value ->> 'status',
			btrim(fact.value ->> 'statement'),
			case when jsonb_typeof(fact.value -> 'maximumAmount') = 'number'
				then (fact.value ->> 'maximumAmount')::numeric else null end,
			upper(btrim(fact.value ->> 'unitName')),
			fact.value #>> '{measurementBasis,kind}',
			(fact.value #>> '{measurementBasis,quantity}')::numeric,
			fact.value #>> '{measurementBasis,unitKey}',
			case when fact.value #>> '{measurementBasis,kind}' = 'serving'
				then nullif(btrim(fact.value #>> '{measurementBasis,servingLabel}'), '')
				else null end,
			coalesce(nullif(btrim(fact.value ->> 'source'), ''), v_default_source),
			coalesce(nullif(btrim(fact.value ->> 'sourceReference'), ''), v_default_source_reference),
			coalesce(nullif(btrim(fact.value ->> 'confidence'), ''), v_default_confidence),
			nullif(btrim(fact.value ->> 'sourceNutrientKey'), ''),
			nullif(btrim(fact.value ->> 'sourceNutrientCode'), ''),
			coalesce(nullif(btrim(fact.value ->> 'mappingStatus'), ''), 'unknown'),
			nullif(btrim(fact.value ->> 'mappingMethod'), ''),
			nullif(btrim(fact.value ->> 'mappingReviewReference'), ''),
			nullif(btrim(fact.value ->> 'policyKey'), ''),
			nullif(btrim(fact.value ->> 'policyReference'), '')
		from jsonb_array_elements(v_food -> 'nutrientQualitativeFacts') with ordinality fact(value, position)
		join public.nutrient_definitions definition
			on definition.nutrient_id = (fact.value ->> 'nutrientId')::bigint
		where jsonb_typeof(fact.value) = 'object'
			and jsonb_typeof(fact.value -> 'nutrientId') = 'number'
			and fact.value ->> 'status' in ('below-reporting-threshold', 'present-unquantified')
			and nullif(btrim(fact.value ->> 'statement'), '') is not null
			and nullif(btrim(fact.value ->> 'unitName'), '') is not null
			and fact.value #>> '{measurementBasis,kind}' in ('mass', 'volume', 'serving')
			and jsonb_typeof(fact.value #> '{measurementBasis,quantity}') = 'number'
			and (fact.value #>> '{measurementBasis,quantity}')::numeric > 0
			and nullif(btrim(fact.value #>> '{measurementBasis,unitKey}'), '') is not null
			and (
				fact.value #>> '{measurementBasis,kind}' <> 'serving'
				or nullif(btrim(fact.value #>> '{measurementBasis,servingLabel}'), '') is not null
			)
		order by (fact.value ->> 'nutrientId')::bigint, fact.position;
	end if;

	return new;
end;
$$;

create trigger zz_sync_user_food_list_item_qualitative_nutrients
	after insert or update of food on public.user_food_list_items
	for each row execute function public.sync_food_nutrient_qualitative_evidence_from_parent();
create trigger zz_sync_custom_food_qualitative_nutrients
	after insert or update of food on public.custom_foods
	for each row execute function public.sync_food_nutrient_qualitative_evidence_from_parent();
create trigger zz_sync_shared_product_submission_qualitative_nutrients
	after insert or update of food on public.shared_product_submissions
	for each row execute function public.sync_food_nutrient_qualitative_evidence_from_parent();
create trigger zz_sync_shared_product_qualitative_nutrients
	after insert or update of food on public.shared_products
	for each row execute function public.sync_food_nutrient_qualitative_evidence_from_parent();
create trigger zz_sync_shared_product_revision_qualitative_nutrients
	after insert or update of food on public.shared_product_revisions
	for each row execute function public.sync_food_nutrient_qualitative_evidence_from_parent();
create trigger zz_sync_shared_product_observation_qualitative_nutrients
	after insert or update of normalized_food on public.shared_product_observations
	for each row execute function public.sync_food_nutrient_qualitative_evidence_from_parent();

alter table public.food_nutrient_qualitative_evidence enable row level security;
alter table public.food_nutrient_qualitative_evidence force row level security;

create policy "Users can read accessible qualitative nutrient evidence"
	on public.food_nutrient_qualitative_evidence
	for select
	to authenticated
	using (
		owner_user_id = (select auth.uid())
		or (
			shared_product_id is not null
			and exists (
				select 1
				from public.shared_products product
				where product.id = food_nutrient_qualitative_evidence.shared_product_id
					and product.status = 'active'
			)
		)
	);

revoke all on table public.food_nutrient_qualitative_evidence from public, anon, authenticated;
grant select on table public.food_nutrient_qualitative_evidence to authenticated;
grant all on table public.food_nutrient_qualitative_evidence to service_role;
revoke all on function public.sync_food_nutrient_qualitative_evidence_from_parent()
	from public, anon, authenticated;
grant execute on function public.sync_food_nutrient_qualitative_evidence_from_parent()
	to service_role;

comment on table public.food_nutrient_qualitative_evidence is
	'Source-backed nutrient statements that are meaningful but not exact numeric amounts. They may satisfy publication completeness but never enter exact nutrition math.';
comment on column public.food_nutrient_qualitative_evidence.maximum_amount is
	'Optional source-reported exclusive upper bound. Null preserves qualitative wording without inventing a numeric threshold.';

alter function public.blendcalc_api_v1_product_readiness_reasons(uuid)
	rename to blendcalc_api_v1_product_readiness_reasons_numeric_evidence;

create function public.blendcalc_api_v1_product_readiness_reasons(
	p_shared_product_id uuid
)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(array_agg(reason order by reason), '{}'::text[])
	from unnest(
		public.blendcalc_api_v1_product_readiness_reasons_numeric_evidence(
			p_shared_product_id
		)
	) reason
	where not (
		reason like 'missing_required_nutrient:%'
		and exists (
			select 1
			from public.food_nutrient_qualitative_evidence evidence
			where evidence.shared_product_id = p_shared_product_id
				and evidence.nutrient_id = split_part(reason, ':', 2)::bigint
				and evidence.qualitative_status in (
					'below-reporting-threshold',
					'present-unquantified'
				)
				and evidence.mapping_status = 'canonical'
				and evidence.confidence in (
					'source-verified',
					'moderator-reviewed',
					'corroborated'
				)
				and nullif(btrim(evidence.statement_text), '') is not null
				and nullif(btrim(evidence.source_reference), '') is not null
				and evidence.source_observation_id is not null
				and public.blendcalc_api_v1_source_attribution_is_complete(
					evidence.source,
					evidence.source_reference
				)
		)
	);
$$;

do $$
declare
	v_view_definition text;
begin
	select pg_get_viewdef('public.blendcalc_api_v1_product_readiness'::regclass, true)
	into v_view_definition;

	if position(
		'blendcalc_api_v1_product_readiness_reasons_numeric_evidence'
		in v_view_definition
	) = 0 then
		raise exception 'The API readiness view did not retain the numeric-evidence function dependency';
	end if;

	execute 'create or replace view public.blendcalc_api_v1_product_readiness as '
		|| replace(
			v_view_definition,
			'blendcalc_api_v1_product_readiness_reasons_numeric_evidence',
			'blendcalc_api_v1_product_readiness_reasons'
		);
end;
$$;

revoke all on function public.blendcalc_api_v1_product_readiness_reasons_numeric_evidence(uuid)
	from public, anon, authenticated;
grant execute on function public.blendcalc_api_v1_product_readiness_reasons_numeric_evidence(uuid)
	to service_role;
revoke all on function public.blendcalc_api_v1_product_readiness_reasons(uuid)
	from public, anon, authenticated;
grant execute on function public.blendcalc_api_v1_product_readiness_reasons(uuid)
	to service_role;

create temporary table corrected_coconut_oil_label_nutrients (
	nutrient_id bigint primary key,
	serving_value numeric not null,
	amount_per_100g numeric not null,
	unit_name text not null
) on commit drop;

insert into corrected_coconut_oil_label_nutrients values
	(1008, 120, 857.142857142857, 'KCAL'),
	(1004, 14, 100, 'G'),
	(1258, 13, 92.8571428571429, 'G'),
	(1293, 0, 0, 'G'),
	(1292, 1, 7.14285714285714, 'G'),
	(1093, 0, 0, 'MG'),
	(1005, 0, 0, 'G'),
	(1003, 0, 0, 'G');

create temporary table corrected_coconut_oil_qualitative_nutrients (
	nutrient_id bigint primary key
) on commit drop;

insert into corrected_coconut_oil_qualitative_nutrients values
	(1257),
	(1253),
	(1079),
	(2000),
	(1235),
	(1114),
	(1087),
	(1089),
	(1092);

create temporary table corrected_coconut_oil_product on commit drop as
select product.id as shared_product_id, product.food as previous_food
from public.shared_products product
where product.barcode = '00011110863065'
	and product.status = 'active';

create temporary table corrected_coconut_oil_observation (
	observation_id uuid primary key
) on commit drop;

with corrected_food as (
	select
		product.barcode,
		product.food || jsonb_build_object(
			'foodNutrients', (
				select jsonb_agg(
					jsonb_build_object(
						'nutrientId', nutrient.nutrient_id,
						'nutrientName', definition.nutrient_name,
						'nutrientNumber', coalesce(definition.nutrient_number, ''),
						'unitName', nutrient.unit_name,
						'value', nutrient.amount_per_100g,
						'valueOrigin', 'reported',
						'valueStatus', case when nutrient.serving_value = 0
							then 'reported-zero' else 'reported' end,
						'mappingStatus', 'canonical',
						'mappingMethod', 'reviewed-label-alias',
						'source', 'community-reviewed',
						'sourceReference', 'package-label:00011110863065:2026-08-30',
						'confidence', 'moderator-reviewed'
					)
					order by nutrient.nutrient_id
				)
				from corrected_coconut_oil_label_nutrients nutrient
				join public.nutrient_definitions definition
					on definition.nutrient_id = nutrient.nutrient_id
			),
			'nutrientQualitativeFacts', (
				select jsonb_agg(
					jsonb_build_object(
						'nutrientId', nutrient.nutrient_id,
						'nutrientName', definition.nutrient_name,
						'nutrientNumber', coalesce(definition.nutrient_number, ''),
						'unitName', upper(definition.default_unit_name),
						'status', 'below-reporting-threshold',
						'statement', 'Not a significant source of trans fat, cholesterol, dietary fiber, total sugars, added sugars, vitamin D, calcium, iron or potassium.',
						'measurementBasis', jsonb_build_object(
							'kind', 'mass', 'quantity', 14, 'unitKey', 'g'
						),
						'source', 'community-reviewed',
						'sourceReference', 'package-label:00011110863065:2026-08-30',
						'confidence', 'moderator-reviewed',
						'mappingStatus', 'canonical',
						'mappingMethod', 'reviewed-label-alias',
						'policyKey', 'us-fda-nutrition-facts',
						'policyReference', 'https://www.fda.gov/media/134505/download'
					)
					order by nutrient.nutrient_id
				)
				from corrected_coconut_oil_qualitative_nutrients nutrient
				join public.nutrient_definitions definition
					on definition.nutrient_id = nutrient.nutrient_id
			),
			'reportedNutrientIds', (
				select jsonb_agg(nutrient_id order by nutrient_id)
				from corrected_coconut_oil_label_nutrients
			),
			'servingSize', 14,
			'servingSizeUnit', 'g',
			'householdServingFullText', '1 Tbsp (14 g)',
			'hasSourceServing', true,
			'foodServings', jsonb_build_array(jsonb_build_object(
				'label', '1 Tbsp (14 g)',
				'gramWeight', 14,
				'amount', 1,
				'unitKey', 'tbsp',
				'isPrimary', true,
				'measureType', 'Package serving',
				'isHouseholdMeasure', true,
				'sourceMeasureKey', 'package-label:00011110863065:serving',
				'origin', 'package-label',
				'gramWeightMethod', 'source-reported',
				'source', 'community-reviewed',
				'sourceReference', 'package-label:00011110863065:2026-08-30',
				'confidence', 'moderator-reviewed'
			)),
			'ingredients', 'Virgin coconut oil',
			'ingredientList', jsonb_build_array('Virgin coconut oil'),
			'allergens', jsonb_build_array('coconut'),
			'traces', '[]'::jsonb,
			'fieldProvenance', coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
				|| jsonb_build_object(
					'ingredients', jsonb_build_object(
						'source', 'community-reviewed',
						'sourceReference', 'package-label:00011110863065:2026-08-30',
						'confidence', 'moderator-reviewed',
						'verificationMethod', 'package-label'
					),
					'allergens', jsonb_build_object(
						'source', 'community-reviewed',
						'sourceReference', 'package-label:00011110863065:2026-08-30',
						'confidence', 'moderator-reviewed',
						'verificationMethod', 'package-label'
					),
					'traces', jsonb_build_object(
						'source', 'community-reviewed',
						'sourceReference', 'package-label:00011110863065:2026-08-30',
						'confidence', 'moderator-reviewed',
						'verificationMethod', 'package-label'
					)
				),
			'sourceMetadata', coalesce(product.food -> 'sourceMetadata', '{}'::jsonb)
				|| jsonb_build_object(
					'language', 'en',
					'marketCountries', jsonb_build_array('United States'),
					'labelObservedAt', '2026-08-30T00:00:00.000Z'
				)
		) as normalized_food
	from public.shared_products product
	join corrected_coconut_oil_product target
		on target.shared_product_id = product.id
), inserted as (
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
	select
		corrected_food.barcode,
		'community-reviewed',
		'package-label:00011110863065:2026-08-30',
		'User-provided package label; factual data retained without redistributing the image',
		jsonb_build_object(
			'evidenceType', 'package-label-review',
			'labelObservedAt', '2026-08-30T00:00:00.000Z',
			'serving', jsonb_build_object('label', '1 Tbsp', 'weightGrams', 14),
			'allergenDeclaration', 'Contains coconut',
			'precautionaryStatements', '[]'::jsonb,
			'notSignificantSource', jsonb_build_array(
				'trans fat', 'cholesterol', 'dietary fiber', 'total sugars',
				'added sugars', 'vitamin D', 'calcium', 'iron', 'potassium'
			)
		),
		corrected_food.normalized_food,
		encode(extensions.digest(corrected_food.normalized_food::text, 'sha256'), 'hex'),
		'2026-08-30T00:00:00.000Z'::timestamptz
	from corrected_food
	returning id
)
insert into corrected_coconut_oil_observation (observation_id)
select id from inserted;

update public.shared_products product
set
	food = observation.normalized_food || jsonb_build_object(
		'nutrientQualitativeFacts', (
			select jsonb_agg(
				fact.value || jsonb_build_object(
					'sourceObservationId', evidence.observation_id
				)
				order by fact.position
			)
			from jsonb_array_elements(observation.normalized_food -> 'nutrientQualitativeFacts')
				with ordinality fact(value, position)
		)
	),
	last_verified_at = now(),
	updated_at = now()
from public.shared_product_observations observation
join corrected_coconut_oil_observation evidence
	on evidence.observation_id = observation.id
where product.id in (select shared_product_id from corrected_coconut_oil_product);

update public.shared_product_field_provenance provenance
set selected = false
where provenance.shared_product_id in (
	select shared_product_id from corrected_coconut_oil_product
)
	and (
		provenance.field_path in (
			'nutrition', 'serving', 'ingredients', 'allergens', 'traces'
		)
		or provenance.field_path like 'nutrient:%'
	)
	and provenance.selected;

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
	target.shared_product_id,
	observation.observation_id,
	'nutrient:' || definition.nutrient_id::text,
	case
		when exact.nutrient_id is not null then jsonb_build_object(
			'value', exact.serving_value,
			'unitName', exact.unit_name,
			'basis', '1 Tbsp (14 g) label serving'
		)
		else jsonb_build_object(
			'status', 'below-reporting-threshold',
			'statement', 'Not a significant source',
			'basis', '1 Tbsp (14 g) label serving'
		)
	end,
	case
		when exact.nutrient_id is not null then jsonb_build_object(
			'value', exact.amount_per_100g,
			'unitName', exact.unit_name,
			'basis', 'per 100 g'
		)
		else jsonb_build_object(
			'status', 'below-reporting-threshold',
			'amountPer100g', null,
			'basis', '1 Tbsp (14 g) label serving'
		)
	end,
	true,
	'moderator-reviewed',
	'label-review'
from corrected_coconut_oil_product target
cross join corrected_coconut_oil_observation observation
join public.nutrient_definitions definition on definition.nutrient_id in (
	select nutrient_id from corrected_coconut_oil_label_nutrients
	union
	select nutrient_id from corrected_coconut_oil_qualitative_nutrients
)
left join corrected_coconut_oil_label_nutrients exact
	on exact.nutrient_id = definition.nutrient_id;

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
	target.shared_product_id,
	observation.observation_id,
	field.field_path,
	field.value,
	field.value,
	true,
	'moderator-reviewed',
	'label-review'
from corrected_coconut_oil_product target
cross join corrected_coconut_oil_observation observation
cross join lateral (
	values
		('nutrition'::text, jsonb_build_object('basis', '1 Tbsp (14 g) package label')),
		('serving'::text, jsonb_build_object('label', '1 Tbsp', 'weightGrams', 14)),
		('ingredients'::text, jsonb_build_array('Virgin coconut oil')),
		('allergens'::text, jsonb_build_array('coconut')),
		('traces'::text, '[]'::jsonb)
) field(field_path, value);

update public.shared_products product
set
	canonical_provenance = coalesce(product.canonical_provenance, '{}'::jsonb)
		|| jsonb_build_object(
			'nutrition', jsonb_build_object(
				'source', 'community-reviewed',
				'sourceReference', 'package-label:00011110863065:2026-08-30',
				'observationId', observation.observation_id,
				'confidence', 'moderator-reviewed',
				'verificationMethod', 'package-label'
			),
			'serving', jsonb_build_object(
				'source', 'community-reviewed',
				'sourceReference', 'package-label:00011110863065:2026-08-30',
				'observationId', observation.observation_id,
				'confidence', 'moderator-reviewed',
				'verificationMethod', 'package-label'
			),
			'ingredients', jsonb_build_object(
				'source', 'community-reviewed',
				'sourceReference', 'package-label:00011110863065:2026-08-30',
				'observationId', observation.observation_id,
				'confidence', 'moderator-reviewed',
				'verificationMethod', 'package-label'
			),
			'allergens', jsonb_build_object(
				'source', 'community-reviewed',
				'sourceReference', 'package-label:00011110863065:2026-08-30',
				'observationId', observation.observation_id,
				'confidence', 'moderator-reviewed',
				'verificationMethod', 'package-label'
			),
			'traces', jsonb_build_object(
				'source', 'community-reviewed',
				'sourceReference', 'package-label:00011110863065:2026-08-30',
				'observationId', observation.observation_id,
				'confidence', 'moderator-reviewed',
				'verificationMethod', 'package-label'
			)
		),
	updated_at = now()
from corrected_coconut_oil_observation observation
where product.id in (
	select shared_product_id from corrected_coconut_oil_product
);

update public.shared_products product
set food = product.food
where product.id in (
	select shared_product_id from corrected_coconut_oil_product
);

with latest_revision as (
	select distinct on (revision.shared_product_id)
		revision.shared_product_id,
		revision.id,
		revision.revision_number
	from public.shared_product_revisions revision
	join corrected_coconut_oil_product target
		on target.shared_product_id = revision.shared_product_id
	order by revision.shared_product_id, revision.revision_number desc
)
insert into public.shared_product_revisions (
	shared_product_id,
	revision_number,
	food,
	source,
	source_reference,
	supersedes_revision_id,
	change_summary,
	label_observed_at
)
select
	product.id,
	coalesce(latest.revision_number, 0) + 1,
	product.food,
	'community-reviewed',
	'package-label:00011110863065:2026-08-30',
	latest.id,
	jsonb_build_object(
		'audit', 'package-label-nutrition-and-qualitative-evidence',
		'changes', jsonb_build_array(jsonb_build_object(
			'field', 'nutrition',
			'label', 'Nutrition',
			'changeType', 'changed',
			'previousValue', target.previous_food -> 'foodNutrients',
			'submittedValue', product.food -> 'foodNutrients',
			'severity', 'high',
			'reason', 'Replaced stale provider values and preserved explicit low-amount package-label statements without inventing zeroes.'
		))
	),
	'2026-08-30T00:00:00.000Z'::timestamptz
from public.shared_products product
join corrected_coconut_oil_product target on target.shared_product_id = product.id
left join latest_revision latest on latest.shared_product_id = product.id;

update public.shared_product_conflicts conflict
set
	status = 'resolved',
	resolution_note = 'Resolved against the reviewed current package label dated 2026-08-30.',
	resolved_at = now()
where conflict.shared_product_id in (
	select shared_product_id from corrected_coconut_oil_product
)
	and conflict.status = 'open'
	and conflict.field_path in (
		select 'nutrient:' || nutrient_id::text from corrected_coconut_oil_label_nutrients
		union
		select 'nutrient:' || nutrient_id::text from corrected_coconut_oil_qualitative_nutrients
		union all select 'serving'
	);

update public.user_food_list_items item
set
	food = item.food || jsonb_build_object(
		'foodNutrients', product.food -> 'foodNutrients',
		'nutrientQualitativeFacts', product.food -> 'nutrientQualitativeFacts',
		'reportedNutrientIds', product.food -> 'reportedNutrientIds',
		'servingSize', product.food -> 'servingSize',
		'servingSizeUnit', product.food -> 'servingSizeUnit',
		'householdServingFullText', product.food -> 'householdServingFullText',
		'hasSourceServing', product.food -> 'hasSourceServing',
		'foodServings', product.food -> 'foodServings',
		'ingredients', product.food -> 'ingredients',
		'ingredientList', product.food -> 'ingredientList',
		'allergens', product.food -> 'allergens',
		'traces', product.food -> 'traces'
	),
	updated_at = now()
from public.shared_products product
join corrected_coconut_oil_product target on target.shared_product_id = product.id
where item.shared_product_id = product.id;

do $$
declare
	v_product_count integer;
	v_fact_count integer;
	v_label_safety_field_count integer;
	v_allergens jsonb;
	v_traces jsonb;
	v_missing_reasons text[];
begin
	select count(*)::integer into v_product_count
	from public.shared_products product
	where product.barcode = '00011110863065'
		and product.status = 'active';

	if v_product_count > 1 then
		raise exception 'Coconut oil package-label correction matched multiple active products: %',
			v_product_count;
	end if;

	select count(*) into v_fact_count
	from public.food_nutrient_qualitative_evidence evidence
	join public.shared_products product on product.id = evidence.shared_product_id
	where product.barcode = '00011110863065'
		and evidence.nutrient_id in (1079, 2000)
		and evidence.qualitative_status = 'below-reporting-threshold';

	if v_product_count = 1 and v_fact_count <> 2 then
		raise exception 'Coconut oil qualitative nutrient evidence is incomplete: %', v_fact_count;
	end if;

	select count(*)::integer into v_label_safety_field_count
	from public.shared_product_field_provenance provenance
	join public.shared_products product on product.id = provenance.shared_product_id
	where product.barcode = '00011110863065'
		and provenance.field_path in ('ingredients', 'allergens', 'traces')
		and provenance.selected;

	if v_product_count = 1 and v_label_safety_field_count <> 3 then
		raise exception 'Coconut oil package-label safety provenance is incomplete: %',
			v_label_safety_field_count;
	end if;

	select product.food -> 'allergens', product.food -> 'traces'
	into v_allergens, v_traces
	from public.shared_products product
	where product.barcode = '00011110863065'
		and product.status = 'active';

	if v_product_count = 1 and v_allergens is distinct from '["coconut"]'::jsonb then
		raise exception 'Coconut oil contains declaration was not preserved: %', v_allergens;
	end if;

	if v_product_count = 1 and v_traces is distinct from '[]'::jsonb then
		raise exception 'Coconut oil reviewed trace coverage was not preserved: %', v_traces;
	end if;

	select public.blendcalc_api_v1_product_readiness_reasons(product.id)
	into v_missing_reasons
	from public.shared_products product
	where product.barcode = '00011110863065'
		and product.status = 'active';

	if cardinality(coalesce(v_missing_reasons, '{}'::text[])) > 0 then
		raise exception 'Coconut oil still has publication blockers after reviewed label correction: %', v_missing_reasons;
	end if;
end;
$$;
