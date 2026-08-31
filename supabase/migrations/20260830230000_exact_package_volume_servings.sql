create table public.shared_product_mass_volume_conversion_policies (
	id uuid primary key default gen_random_uuid(),
	shared_product_id uuid not null references public.shared_products(id) on delete cascade,
	source_observation_id uuid not null references public.shared_product_observations(id) on delete restrict,
	grams_per_milliliter numeric not null check (grams_per_milliliter > 0),
	calculation_basis text not null check (btrim(calculation_basis) <> ''),
	evidence_reference text not null check (btrim(evidence_reference) <> ''),
	reviewed_by uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz not null,
	enabled boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create unique index shared_product_mass_volume_conversion_policies_active_unique
	on public.shared_product_mass_volume_conversion_policies (shared_product_id)
	where enabled;

create trigger set_shared_product_mass_volume_conversion_policies_updated_at
	before update on public.shared_product_mass_volume_conversion_policies
	for each row execute function public.set_updated_at();

create function public.enforce_shared_product_mass_volume_policy_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_product_barcode text;
	v_observation_barcode text;
begin
	select product.barcode
	into v_product_barcode
	from public.shared_products product
	where product.id = new.shared_product_id;

	select observation.barcode
	into v_observation_barcode
	from public.shared_product_observations observation
	where observation.id = new.source_observation_id;

	if v_product_barcode is null
		or v_observation_barcode is null
		or v_product_barcode <> v_observation_barcode
	then
		raise exception 'Conversion policy evidence must match the shared product barcode';
	end if;

	return new;
end;
$$;

create trigger enforce_shared_product_mass_volume_policy_evidence
	before insert or update of shared_product_id, source_observation_id
	on public.shared_product_mass_volume_conversion_policies
	for each row execute function public.enforce_shared_product_mass_volume_policy_evidence();

alter table public.food_servings
	add column mass_volume_conversion_policy_id uuid references
		public.shared_product_mass_volume_conversion_policies(id) on delete restrict;

create function public.enforce_shared_product_serving_mass_volume_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_policy public.shared_product_mass_volume_conversion_policies%rowtype;
begin
	if new.shared_product_id is null then
		if new.mass_volume_conversion_policy_id is not null then
			raise exception 'Shared product conversion policy requires a shared product serving';
		end if;
		return new;
	end if;

	if new.gram_weight_method = 'calculated-conversion'
		and new.gram_weight is not null
		and new.milliliter_volume is not null
	then
		if new.mass_volume_conversion_policy_id is null then
			raise exception 'Calculated mass from volume requires an active reviewed conversion policy';
		end if;

		select *
		into v_policy
		from public.shared_product_mass_volume_conversion_policies policy
		where policy.id = new.mass_volume_conversion_policy_id
			and policy.shared_product_id = new.shared_product_id
			and policy.enabled;

		if not found then
			raise exception 'Serving conversion policy is not active for this shared product';
		end if;
		if new.source_observation_id is distinct from v_policy.source_observation_id then
			raise exception 'Serving conversion must retain the policy evidence observation';
		end if;
		if abs(
			new.gram_weight - new.milliliter_volume * v_policy.grams_per_milliliter
		) > 0.000001 then
			raise exception 'Serving mass does not match the reviewed conversion policy';
		end if;
		new.calculation_basis := v_policy.calculation_basis;
	elsif new.mass_volume_conversion_policy_id is not null then
		raise exception 'Conversion policy may only be attached to a calculated mass-volume serving';
	end if;

	return new;
end;
$$;

create trigger enforce_shared_product_serving_mass_volume_policy
	before insert or update of
		shared_product_id,
		source_observation_id,
		gram_weight,
		milliliter_volume,
		gram_weight_method,
		mass_volume_conversion_policy_id
	on public.food_servings
	for each row execute function public.enforce_shared_product_serving_mass_volume_policy();

alter table public.shared_product_mass_volume_conversion_policies enable row level security;
alter table public.shared_product_mass_volume_conversion_policies force row level security;
revoke all on table public.shared_product_mass_volume_conversion_policies
	from public, anon, authenticated;
grant all on table public.shared_product_mass_volume_conversion_policies to service_role;
revoke all on function public.enforce_shared_product_serving_mass_volume_policy()
	from public, anon, authenticated;
grant execute on function public.enforce_shared_product_serving_mass_volume_policy()
	to service_role;
revoke all on function public.enforce_shared_product_mass_volume_policy_evidence()
	from public, anon, authenticated;
grant execute on function public.enforce_shared_product_mass_volume_policy_evidence()
	to service_role;

create temporary table exact_package_volume_serving_candidates on commit drop as
select distinct on (product.id)
	product.id as shared_product_id,
	provenance.observation_id,
	observation.source,
	observation.source_reference,
	provenance.confidence,
	product.food -> 'packageQuantity' as source_package,
	coalesce(
		nullif(btrim(product.food #>> '{packageQuantity,label}'), ''),
		(product.food #>> '{packageQuantity,amount}') || ' ' || unit.short_label
	) || ' package' as serving_label,
	(product.food #>> '{packageQuantity,amount}')::numeric as serving_amount,
	unit.key as unit_key,
	(product.food #>> '{packageQuantity,amount}')::numeric
		* unit.conversion_to_base as milliliter_volume
from public.shared_products product
join public.shared_product_field_provenance provenance
	on provenance.shared_product_id = product.id
	and provenance.field_path = 'package'
	and provenance.selected
join public.shared_product_observations observation
	on observation.id = provenance.observation_id
join lateral (
	select candidate.*
	from public.serving_measure_units candidate
	where candidate.enabled
		and candidate.dimension = 'volume'
		and (
			lower(candidate.key) = lower(btrim(product.food #>> '{packageQuantity,unit}'))
			or exists (
				select 1
				from public.serving_measure_aliases alias
				where alias.unit_key = candidate.key
					and alias.normalized_alias = lower(
						btrim(product.food #>> '{packageQuantity,unit}')
					)
			)
		)
	order by case when lower(candidate.key) = lower(
		btrim(product.food #>> '{packageQuantity,unit}')
	) then 0 else 1 end, candidate.key
	limit 1
) unit on true
where product.status = 'active'
	and jsonb_typeof(product.food -> 'packageQuantity') = 'object'
	and jsonb_typeof(product.food #> '{packageQuantity,amount}') = 'number'
	and (product.food #>> '{packageQuantity,amount}')::numeric > 0
	and nullif(btrim(product.food #>> '{packageQuantity,unit}'), '') is not null
	and nullif(btrim(observation.source_reference), '') is not null
	and not exists (
		select 1
		from public.food_servings serving
		where serving.shared_product_id = product.id
			and serving.is_primary
	)
order by product.id, provenance.created_at desc, provenance.id desc;

update public.shared_product_field_provenance provenance
set selected = false
where provenance.field_path = 'serving'
	and provenance.selected
	and provenance.shared_product_id in (
		select candidate.shared_product_id
		from exact_package_volume_serving_candidates candidate
	);

insert into public.food_servings (
	shared_product_id,
	source_observation_id,
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
	candidate.shared_product_id,
	candidate.observation_id,
	1,
	candidate.serving_label,
	null,
	candidate.milliliter_volume,
	candidate.serving_amount,
	candidate.unit_key,
	true,
	'Package amount',
	false,
	'packageQuantity',
	'package-label',
	'unknown',
	null,
	candidate.source,
	candidate.source_reference,
	candidate.confidence
from exact_package_volume_serving_candidates candidate
on conflict do nothing;

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
	candidate.shared_product_id,
	candidate.observation_id,
	'serving',
	candidate.source_package,
	jsonb_build_object(
		'label', candidate.serving_label,
		'milliliterVolume', candidate.milliliter_volume,
		'amount', candidate.serving_amount,
		'unitKey', candidate.unit_key,
		'measureType', 'Package amount',
		'origin', 'package-label',
		'gramWeightMethod', 'unknown'
	),
	true,
	candidate.confidence,
	'exact-barcode'
from exact_package_volume_serving_candidates candidate
on conflict (shared_product_id, observation_id, field_path) do update
set
	source_value = excluded.source_value,
	normalized_value = excluded.normalized_value,
	selected = true,
	confidence = excluded.confidence,
	verification_method = excluded.verification_method;

create function public.shared_product_has_exact_primary_serving(
	p_shared_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.food_servings serving
		left join public.serving_measure_units unit
			on unit.key = serving.unit_key
			and unit.enabled
		where serving.shared_product_id = p_shared_product_id
			and serving.is_primary
			and serving.origin <> 'unknown'
			and (
				(
					serving.gram_weight > 0
					and serving.gram_weight_method <> 'unknown'
					and (
						serving.gram_weight_method <> 'calculated-conversion'
						or nullif(btrim(serving.calculation_basis), '') is not null
					)
				)
				or serving.milliliter_volume > 0
				or (
					serving.amount > 0
					and unit.dimension = 'volume'
				)
			)
	);
$$;

create function public.shared_product_primary_serving_has_complete_provenance(
	p_shared_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.food_servings serving
		where serving.shared_product_id = p_shared_product_id
			and serving.is_primary
			and serving.source_observation_id is not null
			and exists (
				select 1
				from public.shared_product_field_provenance provenance
				where provenance.shared_product_id = p_shared_product_id
					and provenance.observation_id = serving.source_observation_id
					and provenance.field_path = 'serving'
					and provenance.selected
			)
			and (
				serving.gram_weight is null
				or exists (
					select 1
					from public.shared_product_field_provenance weight
					where weight.shared_product_id = p_shared_product_id
						and weight.observation_id = serving.source_observation_id
						and weight.field_path = 'servingWeightGrams'
						and weight.selected
				)
			)
	);
$$;

alter function public.blendcalc_api_v1_product_readiness_reasons(uuid)
	rename to blendcalc_api_v1_readiness_before_volume_servings;

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
		public.blendcalc_api_v1_readiness_before_volume_servings(
			p_shared_product_id
		)
	) reason
	where not (
		reason = 'missing_evidence_backed_primary_serving'
		and public.shared_product_has_exact_primary_serving(p_shared_product_id)
	)
	and not (
		reason = 'missing_serving_provenance'
		and (
			not exists (
				select 1
				from public.food_servings serving
				where serving.shared_product_id = p_shared_product_id
					and serving.is_primary
			)
			or public.shared_product_primary_serving_has_complete_provenance(
				p_shared_product_id
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
		'blendcalc_api_v1_readiness_before_volume_servings'
		in v_view_definition
	) = 0 then
		raise exception 'The API readiness view did not retain the previous serving-readiness dependency';
	end if;

	execute 'create or replace view public.blendcalc_api_v1_product_readiness as '
		|| replace(
			v_view_definition,
			'blendcalc_api_v1_readiness_before_volume_servings',
			'blendcalc_api_v1_product_readiness_reasons'
		);
end;
$$;

revoke all on function public.shared_product_has_exact_primary_serving(uuid)
	from public, anon, authenticated;
grant execute on function public.shared_product_has_exact_primary_serving(uuid)
	to service_role;
revoke all on function public.shared_product_primary_serving_has_complete_provenance(uuid)
	from public, anon, authenticated;
grant execute on function public.shared_product_primary_serving_has_complete_provenance(uuid)
	to service_role;
revoke all on function public.blendcalc_api_v1_readiness_before_volume_servings(uuid)
	from public, anon, authenticated;
grant execute on function public.blendcalc_api_v1_readiness_before_volume_servings(uuid)
	to service_role;
revoke all on function public.blendcalc_api_v1_product_readiness_reasons(uuid)
	from public, anon, authenticated;
grant execute on function public.blendcalc_api_v1_product_readiness_reasons(uuid)
	to service_role;

comment on table public.shared_product_mass_volume_conversion_policies is
	'Product-specific reviewed evidence required before a shared product volume may be converted into mass. No policy is inferred from a title, category, or ingredient name.';
comment on column public.food_servings.mass_volume_conversion_policy_id is
	'Required reviewed policy for a shared-product serving whose gram weight was calculated from an exact volume. Null for source-reported mass and native volume-only measures.';
comment on function public.shared_product_has_exact_primary_serving(uuid) is
	'Accepts exact source-backed mass or native volume as a primary serving basis without treating volume as grams.';
comment on function public.shared_product_primary_serving_has_complete_provenance(uuid) is
	'Requires the primary serving to link to its selected serving observation and retains separate weight evidence when grams are present.';
