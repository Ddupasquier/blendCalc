alter table public.serving_measure_units
	drop constraint if exists serving_measure_units_dimension_check,
	drop constraint if exists serving_measure_units_base_unit_key_check;

alter table public.serving_measure_units
	add constraint serving_measure_units_dimension_check
		check (dimension in ('weight', 'volume', 'count')),
	add constraint serving_measure_units_base_unit_key_check
		check (base_unit_key in ('g', 'ml', 'item'));

insert into public.serving_measure_units (
	key,
	display_label,
	short_label,
	dimension,
	base_unit_key,
	conversion_to_base,
	standards_code,
	display_order,
	is_default,
	enabled,
	source_key,
	source_reference,
	observed_at
)
select
	'item',
	'Items',
	'item',
	'count',
	'item',
	1,
	'{item}',
	coalesce(max(display_order), 0) + 1,
	true,
	true,
	'ucum-standard',
	'https://ucum.org/ucum',
	now()
from public.serving_measure_units
on conflict (key) do update
set
	display_label = excluded.display_label,
	short_label = excluded.short_label,
	dimension = excluded.dimension,
	base_unit_key = excluded.base_unit_key,
	conversion_to_base = excluded.conversion_to_base,
	standards_code = excluded.standards_code,
	is_default = excluded.is_default,
	enabled = excluded.enabled,
	source_key = excluded.source_key,
	source_reference = excluded.source_reference,
	observed_at = excluded.observed_at,
	updated_at = now();

insert into public.serving_measure_aliases (
	unit_key,
	alias,
	normalized_alias,
	source_key,
	observation_count,
	first_observed_at,
	last_observed_at
)
values
	('item', 'item', 'item', 'ucum-standard', 1, now(), now()),
	('item', 'items', 'items', 'ucum-standard', 1, now(), now()),
	('item', 'each', 'each', 'ucum-standard', 1, now(), now()),
	('item', 'piece', 'piece', 'ucum-standard', 1, now(), now()),
	('item', 'pieces', 'pieces', 'ucum-standard', 1, now(), now()),
	('item', 'cookie', 'cookie', 'ucum-standard', 1, now(), now()),
	('item', 'cookies', 'cookies', 'ucum-standard', 1, now(), now()),
	('item', 'slice', 'slice', 'ucum-standard', 1, now(), now()),
	('item', 'slices', 'slices', 'ucum-standard', 1, now(), now()),
	('item', 'bar', 'bar', 'ucum-standard', 1, now(), now()),
	('item', 'bars', 'bars', 'ucum-standard', 1, now(), now()),
	('item', 'bottle', 'bottle', 'ucum-standard', 1, now(), now()),
	('item', 'bottles', 'bottles', 'ucum-standard', 1, now(), now()),
	('item', 'can', 'can', 'ucum-standard', 1, now(), now()),
	('item', 'cans', 'cans', 'ucum-standard', 1, now(), now()),
	('item', 'cracker', 'cracker', 'ucum-standard', 1, now(), now()),
	('item', 'crackers', 'crackers', 'ucum-standard', 1, now(), now()),
	('item', 'package', 'package', 'ucum-standard', 1, now(), now()),
	('item', 'packages', 'packages', 'ucum-standard', 1, now(), now()),
	('item', 'packet', 'packet', 'ucum-standard', 1, now(), now()),
	('item', 'packets', 'packets', 'ucum-standard', 1, now(), now()),
	('item', 'pouch', 'pouch', 'ucum-standard', 1, now(), now()),
	('item', 'pouches', 'pouches', 'ucum-standard', 1, now(), now()),
	('item', 'scoop', 'scoop', 'ucum-standard', 1, now(), now()),
	('item', 'scoops', 'scoops', 'ucum-standard', 1, now(), now()),
	('item', 'stick', 'stick', 'ucum-standard', 1, now(), now()),
	('item', 'sticks', 'sticks', 'ucum-standard', 1, now(), now())
on conflict (normalized_alias) do nothing;

alter table public.food_servings
	alter column gram_weight drop not null,
	add column if not exists milliliter_volume numeric;

alter table public.food_servings
	drop constraint if exists food_servings_gram_weight_check,
	drop constraint if exists food_servings_milliliter_volume_check,
	drop constraint if exists food_servings_exact_measurement_basis_check;

alter table public.food_servings
	add constraint food_servings_gram_weight_check
		check (gram_weight is null or gram_weight > 0),
	add constraint food_servings_milliliter_volume_check
		check (milliliter_volume is null or milliliter_volume > 0),
	add constraint food_servings_exact_measurement_basis_check check (
		gram_weight is not null
		or milliliter_volume is not null
		or (amount is not null and unit_key is not null)
	);

create table public.food_nutrient_measurements (
	id bigint generated always as identity primary key,
	owner_user_id uuid references auth.users(id) on delete cascade,
	user_food_list_item_id uuid references public.user_food_list_items(id) on delete cascade,
	custom_food_id uuid references public.custom_foods(id) on delete cascade,
	shared_product_submission_id uuid references public.shared_product_submissions(id) on delete cascade,
	shared_product_id uuid references public.shared_products(id) on delete cascade,
	shared_product_revision_id uuid references public.shared_product_revisions(id) on delete cascade,
	shared_product_observation_id uuid references public.shared_product_observations(id) on delete cascade,
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete restrict,
	amount numeric not null check (amount >= 0),
	unit_name text not null check (btrim(unit_name) <> ''),
	basis_kind text not null check (basis_kind in ('mass', 'volume', 'serving')),
	basis_quantity numeric not null check (basis_quantity > 0),
	basis_unit_key text not null check (btrim(basis_unit_key) <> ''),
	basis_serving_label text,
	value_origin text not null,
	value_status text not null default 'unknown',
	value_qualifier text,
	source text not null,
	source_reference text,
	confidence text not null,
	standard_error numeric,
	source_nutrient_key text,
	source_nutrient_code text,
	mapping_status text not null default 'unknown',
	mapping_method text,
	mapping_review_reference text,
	derivation_method text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint food_nutrient_measurements_exactly_one_parent check (
		num_nonnulls(
			user_food_list_item_id,
			custom_food_id,
			shared_product_submission_id,
			shared_product_id,
			shared_product_revision_id,
			shared_product_observation_id
		) = 1
	),
	constraint food_nutrient_measurements_private_owner check (
		owner_user_id is null
		or user_food_list_item_id is not null
		or custom_food_id is not null
		or shared_product_submission_id is not null
	),
	constraint food_nutrient_measurements_basis_label_check check (
		(basis_kind = 'serving' and nullif(btrim(basis_serving_label), '') is not null)
		or (basis_kind <> 'serving' and basis_serving_label is null)
	),
	constraint food_nutrient_measurements_standard_error_check check (
		standard_error is null or standard_error >= 0
	)
);

create unique index food_nutrient_measurements_list_item_unique
	on public.food_nutrient_measurements (user_food_list_item_id, nutrient_id)
	where user_food_list_item_id is not null;
create unique index food_nutrient_measurements_custom_food_unique
	on public.food_nutrient_measurements (custom_food_id, nutrient_id)
	where custom_food_id is not null;
create unique index food_nutrient_measurements_submission_unique
	on public.food_nutrient_measurements (shared_product_submission_id, nutrient_id)
	where shared_product_submission_id is not null;
create unique index food_nutrient_measurements_shared_product_unique
	on public.food_nutrient_measurements (shared_product_id, nutrient_id)
	where shared_product_id is not null;
create unique index food_nutrient_measurements_revision_unique
	on public.food_nutrient_measurements (shared_product_revision_id, nutrient_id)
	where shared_product_revision_id is not null;
create unique index food_nutrient_measurements_observation_unique
	on public.food_nutrient_measurements (shared_product_observation_id, nutrient_id)
	where shared_product_observation_id is not null;

create index food_nutrient_measurements_owner_lookup_idx
	on public.food_nutrient_measurements (owner_user_id, nutrient_id, basis_kind)
	where owner_user_id is not null;
create index food_nutrient_measurements_shared_lookup_idx
	on public.food_nutrient_measurements (shared_product_id, nutrient_id, basis_kind)
	where shared_product_id is not null;

create trigger set_food_nutrient_measurements_updated_at
	before update on public.food_nutrient_measurements
	for each row execute function public.set_updated_at();

create or replace function private.apply_food_nutrient_uncertainty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_food jsonb;
	v_nutrient jsonb;
	v_explicit_status text;
	v_mapping_status text;
	v_value_qualifier text;
	v_is_exact_native_projection boolean;
begin
	v_is_exact_native_projection := coalesce(
		new.derivation_method = 'exact-native-basis-to-100g',
		false
	);

	if new.user_food_list_item_id is not null then
		select food into v_food from public.user_food_list_items where id = new.user_food_list_item_id;
	elsif new.custom_food_id is not null then
		select food into v_food from public.custom_foods where id = new.custom_food_id;
	elsif new.shared_product_submission_id is not null then
		select food into v_food from public.shared_product_submissions where id = new.shared_product_submission_id;
	elsif new.shared_product_id is not null then
		select food into v_food from public.shared_products where id = new.shared_product_id;
	elsif new.shared_product_revision_id is not null then
		select food into v_food from public.shared_product_revisions where id = new.shared_product_revision_id;
	elsif new.shared_product_observation_id is not null then
		select normalized_food into v_food from public.shared_product_observations where id = new.shared_product_observation_id;
	end if;

	if jsonb_typeof(v_food -> 'foodNutrients') = 'array' then
		select nutrient.value into v_nutrient
		from jsonb_array_elements(v_food -> 'foodNutrients') nutrient(value)
		where jsonb_typeof(nutrient.value) = 'object'
			and jsonb_typeof(nutrient.value -> 'nutrientId') = 'number'
			and (nutrient.value ->> 'nutrientId')::bigint = new.nutrient_id
		limit 1;
	end if;

	v_value_qualifier := nullif(btrim(v_nutrient ->> 'valueQualifier'), '');
	v_explicit_status := nullif(btrim(v_nutrient ->> 'valueStatus'), '');
	new.value_status := case
		when v_is_exact_native_projection then 'derived'
		when v_value_qualifier = 'source-estimate' then 'estimated'
		when v_explicit_status in ('reported', 'reported-zero', 'estimated', 'derived', 'trace', 'present-unquantified', 'missing', 'invalid', 'unknown') then v_explicit_status
		when new.value_origin = 'estimated' then 'estimated'
		when new.value_origin = 'derived' then 'derived'
		when new.value_origin = 'reported' and new.amount_per_100g = 0 then 'reported-zero'
		when new.value_origin = 'reported' then 'reported'
		else 'unknown'
	end;
	new.value_origin := case
		when new.value_status = 'estimated' then 'estimated'
		when new.value_status = 'derived' then 'derived'
		else 'reported'
	end;
	new.value_qualifier := case
		when new.value_status = 'estimated' then 'source-estimate'
		else null
	end;

	if new.value_status = 'reported-zero' and new.amount_per_100g <> 0 then
		new.value_status := 'reported';
	end if;

	if not v_is_exact_native_projection then
		new.standard_error := case
			when jsonb_typeof(v_nutrient -> 'standardError') = 'number'
				and (v_nutrient ->> 'standardError')::numeric >= 0
				then (v_nutrient ->> 'standardError')::numeric
			else null
		end;
	end if;
	new.source_nutrient_key := nullif(btrim(v_nutrient ->> 'sourceNutrientKey'), '');
	new.source_nutrient_code := nullif(btrim(v_nutrient ->> 'sourceNutrientCode'), '');
	v_mapping_status := nullif(btrim(v_nutrient ->> 'mappingStatus'), '');
	new.mapping_status := case
		when v_mapping_status in ('canonical', 'unmapped', 'excluded', 'unknown') then v_mapping_status
		else 'unknown'
	end;
	new.mapping_method := nullif(btrim(v_nutrient ->> 'mappingMethod'), '');
	new.mapping_review_reference := nullif(btrim(v_nutrient ->> 'mappingReviewReference'), '');
	if not v_is_exact_native_projection then
		new.derivation_method := nullif(btrim(v_nutrient ->> 'derivationMethod'), '');
	end if;
	return new;
end;
$$;

create function public.sync_native_food_measurements_from_parent()
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
		else
			raise exception 'Unsupported native measurement parent table';
	end case;

	v_default_source := coalesce(v_default_source, case v_food ->> 'barcodeSource'
		when 'usda' then 'usda'
		when 'open-food-facts' then 'open-food-facts'
		when 'community' then 'community-reviewed'
		when 'manual' then 'user-label'
		else case
			when v_owner_user_id is not null then 'user-label'
			else 'unknown'
		end
	end);
	v_default_source_reference := coalesce(
		nullif(btrim(v_food ->> 'barcode'), ''),
		nullif(btrim(v_food ->> 'gtinUpc'), '')
	);
	v_default_confidence := case
		when v_default_source = 'user-label' then 'user-reported'
		when v_default_source = 'usda' then 'source-verified'
		else 'imported'
	end;

	delete from public.food_nutrient_measurements measurement
	where (v_user_food_list_item_id is not null and measurement.user_food_list_item_id = v_user_food_list_item_id)
		or (v_custom_food_id is not null and measurement.custom_food_id = v_custom_food_id)
		or (v_shared_product_submission_id is not null and measurement.shared_product_submission_id = v_shared_product_submission_id)
		or (v_shared_product_id is not null and measurement.shared_product_id = v_shared_product_id)
		or (v_shared_product_revision_id is not null and measurement.shared_product_revision_id = v_shared_product_revision_id)
		or (v_shared_product_observation_id is not null and measurement.shared_product_observation_id = v_shared_product_observation_id);

	if jsonb_typeof(v_food -> 'foodNutrients') = 'array' then
		insert into public.food_nutrient_measurements (
			owner_user_id,
			user_food_list_item_id,
			custom_food_id,
			shared_product_submission_id,
			shared_product_id,
			shared_product_revision_id,
			shared_product_observation_id,
			nutrient_id,
			amount,
			unit_name,
			basis_kind,
			basis_quantity,
			basis_unit_key,
			basis_serving_label,
			value_origin,
			value_status,
			value_qualifier,
			source,
			source_reference,
			confidence,
			standard_error,
			source_nutrient_key,
			source_nutrient_code,
			mapping_status,
			mapping_method,
			mapping_review_reference,
			derivation_method
		)
		select distinct on ((nutrient.value ->> 'nutrientId')::bigint)
			v_owner_user_id,
			v_user_food_list_item_id,
			v_custom_food_id,
			v_shared_product_submission_id,
			v_shared_product_id,
			v_shared_product_revision_id,
			v_shared_product_observation_id,
			(nutrient.value ->> 'nutrientId')::bigint,
			(nutrient.value ->> 'value')::numeric,
			coalesce(
				nullif(upper(btrim(nutrient.value ->> 'unitName')), ''),
				upper(definition.default_unit_name)
			),
			coalesce(nullif(btrim(nutrient.value #>> '{measurementBasis,kind}'), ''), 'mass'),
			case
				when jsonb_typeof(nutrient.value #> '{measurementBasis,quantity}') = 'number'
				then (nutrient.value #>> '{measurementBasis,quantity}')::numeric
				else 100
			end,
			coalesce(nullif(btrim(nutrient.value #>> '{measurementBasis,unitKey}'), ''), 'g'),
			case
				when nutrient.value #>> '{measurementBasis,kind}' = 'serving'
				then nullif(btrim(nutrient.value #>> '{measurementBasis,servingLabel}'), '')
				else null
			end,
			coalesce(nullif(btrim(nutrient.value ->> 'valueOrigin'), ''), 'reported'),
			coalesce(nullif(btrim(nutrient.value ->> 'valueStatus'), ''), 'unknown'),
			nullif(btrim(nutrient.value ->> 'valueQualifier'), ''),
			coalesce(nullif(btrim(nutrient.value ->> 'source'), ''), v_default_source),
			coalesce(nullif(btrim(nutrient.value ->> 'sourceReference'), ''), v_default_source_reference),
			coalesce(nullif(btrim(nutrient.value ->> 'confidence'), ''), v_default_confidence),
			case when jsonb_typeof(nutrient.value -> 'standardError') = 'number'
				then (nutrient.value ->> 'standardError')::numeric else null end,
			nullif(btrim(nutrient.value ->> 'sourceNutrientKey'), ''),
			nullif(btrim(nutrient.value ->> 'sourceNutrientCode'), ''),
			coalesce(nullif(btrim(nutrient.value ->> 'mappingStatus'), ''), 'unknown'),
			nullif(btrim(nutrient.value ->> 'mappingMethod'), ''),
			nullif(btrim(nutrient.value ->> 'mappingReviewReference'), ''),
			nullif(btrim(nutrient.value ->> 'derivationMethod'), '')
		from jsonb_array_elements(v_food -> 'foodNutrients') with ordinality nutrient(value, position)
		join public.nutrient_definitions definition
			on definition.nutrient_id = (nutrient.value ->> 'nutrientId')::bigint
		where jsonb_typeof(nutrient.value) = 'object'
			and jsonb_typeof(nutrient.value -> 'nutrientId') = 'number'
			and jsonb_typeof(nutrient.value -> 'value') = 'number'
			and (nutrient.value ->> 'nutrientId')::bigint > 0
			and (nutrient.value ->> 'value')::numeric >= 0
			and coalesce(nullif(btrim(nutrient.value #>> '{measurementBasis,kind}'), ''), 'mass') in ('mass', 'volume', 'serving')
			and case
				when jsonb_typeof(nutrient.value #> '{measurementBasis,quantity}') = 'number'
				then (nutrient.value #>> '{measurementBasis,quantity}')::numeric > 0
				else true
			end
			and (
				coalesce(nullif(btrim(nutrient.value #>> '{measurementBasis,kind}'), ''), 'mass') <> 'serving'
				or nullif(btrim(nutrient.value #>> '{measurementBasis,servingLabel}'), '') is not null
			)
		order by (nutrient.value ->> 'nutrientId')::bigint, nutrient.position;
	end if;

	if jsonb_typeof(v_food -> 'foodServings') = 'array' then
		insert into public.food_servings (
			owner_user_id,
			user_food_list_item_id,
			custom_food_id,
			shared_product_submission_id,
			shared_product_id,
			shared_product_revision_id,
			shared_product_observation_id,
			serving_order,
			label,
			gram_weight,
			milliliter_volume,
			amount,
			unit_key,
			is_primary,
			measure_type,
			is_household_measure,
			source_measure_key,
			origin,
			gram_weight_method,
			calculation_basis,
			source,
			source_reference,
			confidence
		)
		select
			v_owner_user_id,
			v_user_food_list_item_id,
			v_custom_food_id,
			v_shared_product_submission_id,
			v_shared_product_id,
			v_shared_product_revision_id,
			v_shared_product_observation_id,
			serving.position::smallint,
			btrim(serving.value ->> 'label'),
			null,
			case when jsonb_typeof(serving.value -> 'milliliterVolume') = 'number'
				then (serving.value ->> 'milliliterVolume')::numeric else null end,
			case when jsonb_typeof(serving.value -> 'amount') = 'number'
				then (serving.value ->> 'amount')::numeric else null end,
			nullif(btrim(serving.value ->> 'unitKey'), ''),
			case when jsonb_typeof(serving.value -> 'isPrimary') = 'boolean'
				then (serving.value ->> 'isPrimary')::boolean else false end,
			nullif(btrim(serving.value ->> 'measureType'), ''),
			case when jsonb_typeof(serving.value -> 'isHouseholdMeasure') = 'boolean'
				then (serving.value ->> 'isHouseholdMeasure')::boolean else false end,
			nullif(btrim(serving.value ->> 'sourceMeasureKey'), ''),
			coalesce(nullif(btrim(serving.value ->> 'origin'), ''), 'unknown'),
			coalesce(nullif(btrim(serving.value ->> 'gramWeightMethod'), ''), 'unknown'),
			nullif(btrim(serving.value ->> 'calculationBasis'), ''),
			coalesce(nullif(btrim(serving.value ->> 'source'), ''), v_default_source),
			coalesce(nullif(btrim(serving.value ->> 'sourceReference'), ''), v_default_source_reference),
			coalesce(nullif(btrim(serving.value ->> 'confidence'), ''), v_default_confidence)
		from jsonb_array_elements(v_food -> 'foodServings') with ordinality serving(value, position)
		where jsonb_typeof(serving.value) = 'object'
			and jsonb_typeof(serving.value -> 'gramWeight') <> 'number'
			and nullif(btrim(serving.value ->> 'label'), '') is not null
			and (
				(jsonb_typeof(serving.value -> 'milliliterVolume') = 'number' and (serving.value ->> 'milliliterVolume')::numeric > 0)
				or (
					jsonb_typeof(serving.value -> 'amount') = 'number'
					and (serving.value ->> 'amount')::numeric > 0
					and exists (
						select 1 from public.serving_measure_units unit
						where unit.key = serving.value ->> 'unitKey' and unit.enabled
					)
				)
			)
		on conflict do nothing;
	end if;

	delete from public.food_nutrients nutrient
	where nutrient.derivation_method = 'exact-native-basis-to-100g'
		and (
			(v_user_food_list_item_id is not null and nutrient.user_food_list_item_id = v_user_food_list_item_id)
			or (v_custom_food_id is not null and nutrient.custom_food_id = v_custom_food_id)
			or (v_shared_product_submission_id is not null and nutrient.shared_product_submission_id = v_shared_product_submission_id)
			or (v_shared_product_id is not null and nutrient.shared_product_id = v_shared_product_id)
			or (v_shared_product_revision_id is not null and nutrient.shared_product_revision_id = v_shared_product_revision_id)
			or (v_shared_product_observation_id is not null and nutrient.shared_product_observation_id = v_shared_product_observation_id)
		);

	with current_measurements as (
		select measurement.*
		from public.food_nutrient_measurements measurement
		where (v_user_food_list_item_id is not null and measurement.user_food_list_item_id = v_user_food_list_item_id)
			or (v_custom_food_id is not null and measurement.custom_food_id = v_custom_food_id)
			or (v_shared_product_submission_id is not null and measurement.shared_product_submission_id = v_shared_product_submission_id)
			or (v_shared_product_id is not null and measurement.shared_product_id = v_shared_product_id)
			or (v_shared_product_revision_id is not null and measurement.shared_product_revision_id = v_shared_product_revision_id)
			or (v_shared_product_observation_id is not null and measurement.shared_product_observation_id = v_shared_product_observation_id)
	), exact_mass_bases as (
		select
			measurement.*,
			case
				when measurement.basis_kind = 'mass' and basis_unit.dimension = 'weight'
					then measurement.basis_quantity * basis_unit.conversion_to_base
				when measurement.basis_kind = 'volume'
					and basis_unit.dimension = 'volume'
					and exact_serving.gram_weight is not null
					and exact_serving.milliliter_volume is not null
					then measurement.basis_quantity * basis_unit.conversion_to_base
						* exact_serving.gram_weight / exact_serving.milliliter_volume
				when measurement.basis_kind = 'serving'
					and exact_serving.gram_weight is not null
					then measurement.basis_quantity * exact_serving.gram_weight
				else null
			end as exact_basis_grams
		from current_measurements measurement
		left join public.serving_measure_units basis_unit
			on basis_unit.key = measurement.basis_unit_key
			and basis_unit.enabled
		left join lateral (
			select serving.gram_weight, serving.milliliter_volume
			from public.food_servings serving
			where ((v_user_food_list_item_id is not null and serving.user_food_list_item_id = v_user_food_list_item_id)
				or (v_custom_food_id is not null and serving.custom_food_id = v_custom_food_id)
				or (v_shared_product_submission_id is not null and serving.shared_product_submission_id = v_shared_product_submission_id)
				or (v_shared_product_id is not null and serving.shared_product_id = v_shared_product_id)
				or (v_shared_product_revision_id is not null and serving.shared_product_revision_id = v_shared_product_revision_id)
				or (v_shared_product_observation_id is not null and serving.shared_product_observation_id = v_shared_product_observation_id))
				and serving.gram_weight is not null
				and serving.gram_weight_method <> 'unknown'
				and (
					(measurement.basis_kind = 'volume' and serving.milliliter_volume is not null)
					or (
						measurement.basis_kind = 'serving'
						and btrim(regexp_replace(
							lower(serving.label),
							'[[:space:]]*[(][[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*(g|gram|grams)[[:space:]]*[)][[:space:]]*$',
							'',
							'i'
						)) = btrim(regexp_replace(
							lower(measurement.basis_serving_label),
							'[[:space:]]*[(][[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*(g|gram|grams)[[:space:]]*[)][[:space:]]*$',
							'',
							'i'
						))
					)
				)
			order by serving.is_primary desc, serving.serving_order
			limit 1
		) exact_serving on measurement.basis_kind in ('volume', 'serving')
	)
	insert into public.food_nutrients (
		owner_user_id,
		user_food_list_item_id,
		custom_food_id,
		shared_product_submission_id,
		shared_product_id,
		shared_product_revision_id,
		shared_product_observation_id,
		nutrient_id,
		amount_per_100g,
		unit_name,
		value_origin,
		value_status,
		value_qualifier,
		source,
		source_reference,
		confidence,
		standard_error,
		source_nutrient_key,
		source_nutrient_code,
		mapping_status,
		mapping_method,
		mapping_review_reference,
		derivation_method
	)
	select
		measurement.owner_user_id,
		measurement.user_food_list_item_id,
		measurement.custom_food_id,
		measurement.shared_product_submission_id,
		measurement.shared_product_id,
		measurement.shared_product_revision_id,
		measurement.shared_product_observation_id,
		measurement.nutrient_id,
		measurement.amount * 100 / measurement.exact_basis_grams,
		measurement.unit_name,
		'derived',
		'derived',
		measurement.value_qualifier,
		measurement.source,
		measurement.source_reference,
		measurement.confidence,
		case when measurement.standard_error is null then null
			else measurement.standard_error * 100 / measurement.exact_basis_grams end,
		measurement.source_nutrient_key,
		measurement.source_nutrient_code,
		measurement.mapping_status,
		measurement.mapping_method,
		measurement.mapping_review_reference,
		'exact-native-basis-to-100g'
	from exact_mass_bases measurement
	where measurement.exact_basis_grams > 0
		and not (
			measurement.basis_kind = 'mass'
			and measurement.basis_quantity = 100
			and measurement.basis_unit_key = 'g'
		)
	on conflict do nothing;

	return new;
end;
$$;

create function public.skip_non_mass_food_nutrient_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_food jsonb;
	v_basis_kind text;
	v_basis_quantity numeric;
	v_basis_unit_key text;
begin
	if new.derivation_method = 'exact-native-basis-to-100g' then
		return new;
	end if;

	if new.user_food_list_item_id is not null then
		select food into v_food from public.user_food_list_items where id = new.user_food_list_item_id;
	elsif new.custom_food_id is not null then
		select food into v_food from public.custom_foods where id = new.custom_food_id;
	elsif new.shared_product_submission_id is not null then
		select food into v_food from public.shared_product_submissions where id = new.shared_product_submission_id;
	elsif new.shared_product_id is not null then
		select food into v_food from public.shared_products where id = new.shared_product_id;
	elsif new.shared_product_revision_id is not null then
		select food into v_food from public.shared_product_revisions where id = new.shared_product_revision_id;
	elsif new.shared_product_observation_id is not null then
		select normalized_food into v_food from public.shared_product_observations where id = new.shared_product_observation_id;
	end if;

	select
		coalesce(nullif(btrim(nutrient.value #>> '{measurementBasis,kind}'), ''), 'mass'),
		case
			when jsonb_typeof(nutrient.value #> '{measurementBasis,quantity}') = 'number'
			then (nutrient.value #>> '{measurementBasis,quantity}')::numeric
			else 100
		end,
		coalesce(nullif(btrim(nutrient.value #>> '{measurementBasis,unitKey}'), ''), 'g')
	into v_basis_kind, v_basis_quantity, v_basis_unit_key
	from jsonb_array_elements(coalesce(v_food -> 'foodNutrients', '[]'::jsonb)) nutrient(value)
	where jsonb_typeof(nutrient.value -> 'nutrientId') = 'number'
		and (nutrient.value ->> 'nutrientId')::bigint = new.nutrient_id
	limit 1;

	if found and not (
		v_basis_kind = 'mass'
		and v_basis_quantity = 100
		and v_basis_unit_key = 'g'
	) then
		return null;
	end if;
	return new;
end;
$$;

create trigger aa_skip_non_mass_food_nutrient_projection
	before insert on public.food_nutrients
	for each row execute function public.skip_non_mass_food_nutrient_projection();

create trigger zz_sync_user_food_list_item_native_measurements
	after insert or update of food on public.user_food_list_items
	for each row execute function public.sync_native_food_measurements_from_parent();
create trigger zz_sync_custom_food_native_measurements
	after insert or update of food on public.custom_foods
	for each row execute function public.sync_native_food_measurements_from_parent();
create trigger zz_sync_shared_product_submission_native_measurements
	after insert or update of food on public.shared_product_submissions
	for each row execute function public.sync_native_food_measurements_from_parent();
create trigger zz_sync_shared_product_native_measurements
	after insert or update of food on public.shared_products
	for each row execute function public.sync_native_food_measurements_from_parent();
create trigger zz_sync_shared_product_revision_native_measurements
	after insert or update of food on public.shared_product_revisions
	for each row execute function public.sync_native_food_measurements_from_parent();
create trigger zz_sync_shared_product_observation_native_measurements
	after insert or update of normalized_food on public.shared_product_observations
	for each row execute function public.sync_native_food_measurements_from_parent();

insert into public.food_nutrient_measurements (
	owner_user_id,
	user_food_list_item_id,
	custom_food_id,
	shared_product_submission_id,
	shared_product_id,
	shared_product_revision_id,
	shared_product_observation_id,
	nutrient_id,
	amount,
	unit_name,
	basis_kind,
	basis_quantity,
	basis_unit_key,
	value_origin,
	value_status,
	value_qualifier,
	source,
	source_reference,
	confidence,
	standard_error,
	source_nutrient_key,
	source_nutrient_code,
	mapping_status,
	mapping_method,
	mapping_review_reference,
	derivation_method,
	created_at,
	updated_at
)
select
	owner_user_id,
	user_food_list_item_id,
	custom_food_id,
	shared_product_submission_id,
	shared_product_id,
	shared_product_revision_id,
	shared_product_observation_id,
	nutrient_id,
	amount_per_100g,
	unit_name,
	'mass',
	100,
	'g',
	value_origin,
	value_status,
	value_qualifier,
	source,
	source_reference,
	confidence,
	standard_error,
	source_nutrient_key,
	source_nutrient_code,
	mapping_status,
	mapping_method,
	mapping_review_reference,
	derivation_method,
	created_at,
	updated_at
from public.food_nutrients;

alter table public.food_nutrient_measurements enable row level security;
alter table public.food_nutrient_measurements force row level security;

create policy "Users can read accessible nutrient measurements"
	on public.food_nutrient_measurements
	for select
	to authenticated
	using (
		owner_user_id = (select auth.uid())
		or (
			shared_product_id is not null
			and exists (
				select 1 from public.shared_products product
				where product.id = food_nutrient_measurements.shared_product_id
					and product.status = 'active'
			)
		)
	);

revoke all on table public.food_nutrient_measurements from public, anon, authenticated;
grant select on table public.food_nutrient_measurements to authenticated;
grant all on table public.food_nutrient_measurements to service_role;

revoke all on function public.sync_native_food_measurements_from_parent()
	from public, anon, authenticated;
revoke all on function public.skip_non_mass_food_nutrient_projection()
	from public, anon, authenticated;
grant execute on function public.sync_native_food_measurements_from_parent()
	to service_role;
grant execute on function public.skip_non_mass_food_nutrient_projection()
	to service_role;

comment on table public.food_nutrient_measurements is
	'Canonical nutrient values preserved in their exact source basis. food_nutrients remains the backward-compatible per-100-gram projection.';
comment on column public.food_nutrient_measurements.basis_kind is
	'Exact measurement dimension: mass, volume, or a source-defined serving.';
comment on column public.food_nutrient_measurements.basis_serving_label is
	'Required source label for serving-based nutrients, such as 1 cookie. It is never treated as a mass conversion without evidence.';
comment on column public.food_servings.milliliter_volume is
	'Exact source-reported serving volume. Null means volume was not reported; it is never inferred from mass without verified density.';
