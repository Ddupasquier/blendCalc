create table public.food_servings (
	id bigint generated always as identity primary key,
	owner_user_id uuid references auth.users(id) on delete cascade,
	user_food_list_item_id uuid references public.user_food_list_items(id) on delete cascade,
	custom_food_id uuid references public.custom_foods(id) on delete cascade,
	shared_product_submission_id uuid references public.shared_product_submissions(id) on delete cascade,
	shared_product_id uuid references public.shared_products(id) on delete cascade,
	shared_product_revision_id uuid references public.shared_product_revisions(id) on delete cascade,
	shared_product_observation_id uuid references public.shared_product_observations(id) on delete cascade,
	serving_order smallint not null check (serving_order > 0),
	label text not null check (btrim(label) <> ''),
	gram_weight numeric not null check (gram_weight > 0),
	amount numeric check (amount is null or amount > 0),
	unit_key text references public.serving_measure_units(key) on delete restrict,
	is_primary boolean not null default false,
	source text not null check (
		source in (
			'usda',
			'open-food-facts',
			'user-label',
			'manufacturer',
			'gs1',
			'community-reviewed',
			'unknown'
		)
	),
	source_reference text,
	confidence text not null check (
		confidence in (
			'source-verified',
			'moderator-reviewed',
			'corroborated',
			'user-reported',
			'imported',
			'unknown'
		)
	),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint food_servings_exactly_one_parent check (
		num_nonnulls(
			user_food_list_item_id,
			custom_food_id,
			shared_product_submission_id,
			shared_product_id,
			shared_product_revision_id,
			shared_product_observation_id
		) = 1
	),
	constraint food_servings_private_owner check (
		owner_user_id is null
		or user_food_list_item_id is not null
		or custom_food_id is not null
		or shared_product_submission_id is not null
	),
	constraint food_servings_amount_unit_pair check (
		(amount is null and unit_key is null)
		or (amount is not null and unit_key is not null)
	)
);

create unique index food_servings_list_item_order_unique
	on public.food_servings (user_food_list_item_id, serving_order)
	where user_food_list_item_id is not null;
create unique index food_servings_custom_food_order_unique
	on public.food_servings (custom_food_id, serving_order)
	where custom_food_id is not null;
create unique index food_servings_submission_order_unique
	on public.food_servings (shared_product_submission_id, serving_order)
	where shared_product_submission_id is not null;
create unique index food_servings_shared_product_order_unique
	on public.food_servings (shared_product_id, serving_order)
	where shared_product_id is not null;
create unique index food_servings_revision_order_unique
	on public.food_servings (shared_product_revision_id, serving_order)
	where shared_product_revision_id is not null;
create unique index food_servings_observation_order_unique
	on public.food_servings (shared_product_observation_id, serving_order)
	where shared_product_observation_id is not null;

create unique index food_servings_list_item_primary_unique
	on public.food_servings (user_food_list_item_id)
	where user_food_list_item_id is not null and is_primary;
create unique index food_servings_custom_food_primary_unique
	on public.food_servings (custom_food_id)
	where custom_food_id is not null and is_primary;
create unique index food_servings_submission_primary_unique
	on public.food_servings (shared_product_submission_id)
	where shared_product_submission_id is not null and is_primary;
create unique index food_servings_shared_product_primary_unique
	on public.food_servings (shared_product_id)
	where shared_product_id is not null and is_primary;
create unique index food_servings_revision_primary_unique
	on public.food_servings (shared_product_revision_id)
	where shared_product_revision_id is not null and is_primary;
create unique index food_servings_observation_primary_unique
	on public.food_servings (shared_product_observation_id)
	where shared_product_observation_id is not null and is_primary;

create index food_servings_owner_lookup_idx
	on public.food_servings (owner_user_id, is_primary desc, serving_order)
	where owner_user_id is not null;
create index food_servings_shared_lookup_idx
	on public.food_servings (shared_product_id, is_primary desc, serving_order)
	where shared_product_id is not null;

create trigger set_food_servings_updated_at
	before update on public.food_servings
	for each row execute function public.set_updated_at();

create function public.replace_food_servings(
	p_food jsonb,
	p_owner_user_id uuid,
	p_user_food_list_item_id uuid,
	p_custom_food_id uuid,
	p_shared_product_submission_id uuid,
	p_shared_product_id uuid,
	p_shared_product_revision_id uuid,
	p_shared_product_observation_id uuid,
	p_default_source text,
	p_default_source_reference text,
	p_default_confidence text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_parent_count integer;
	v_item jsonb;
	v_order smallint := 0;
	v_inserted_count integer := 0;
	v_primary_used boolean := false;
	v_gram_weight numeric;
	v_amount numeric;
	v_unit_key text;
	v_label text;
	v_source text;
	v_source_reference text;
	v_confidence text;
	v_requested_primary boolean;
	v_legacy_unit_key text;
	v_legacy_unit_dimension text;
	v_legacy_conversion numeric;
	v_legacy_serving_size numeric;
begin
	v_parent_count := num_nonnulls(
		p_user_food_list_item_id,
		p_custom_food_id,
		p_shared_product_submission_id,
		p_shared_product_id,
		p_shared_product_revision_id,
		p_shared_product_observation_id
	);
	if v_parent_count <> 1 then
		raise exception 'Exactly one serving parent is required';
	end if;
	if p_default_source not in (
		'usda', 'open-food-facts', 'user-label', 'manufacturer', 'gs1',
		'community-reviewed', 'unknown'
	) then
		raise exception 'Unsupported serving source';
	end if;
	if p_default_confidence not in (
		'source-verified', 'moderator-reviewed', 'corroborated',
		'user-reported', 'imported', 'unknown'
	) then
		raise exception 'Unsupported serving confidence';
	end if;

	delete from public.food_servings
	where (p_user_food_list_item_id is not null and user_food_list_item_id = p_user_food_list_item_id)
		or (p_custom_food_id is not null and custom_food_id = p_custom_food_id)
		or (
			p_shared_product_submission_id is not null
			and shared_product_submission_id = p_shared_product_submission_id
		)
		or (p_shared_product_id is not null and shared_product_id = p_shared_product_id)
		or (
			p_shared_product_revision_id is not null
			and shared_product_revision_id = p_shared_product_revision_id
		)
		or (
			p_shared_product_observation_id is not null
			and shared_product_observation_id = p_shared_product_observation_id
		);

	if p_food is null or jsonb_typeof(p_food) <> 'object' then
		return;
	end if;

	if jsonb_typeof(p_food -> 'foodServings') = 'array' then
		for v_item in
			select serving.value
			from jsonb_array_elements(p_food -> 'foodServings') serving(value)
		loop
			if jsonb_typeof(v_item) <> 'object'
				or jsonb_typeof(v_item -> 'gramWeight') <> 'number'
				or (v_item ->> 'gramWeight')::numeric <= 0 then
				continue;
			end if;

			v_label := btrim(coalesce(v_item ->> 'label', ''));
			if v_label = '' then
				continue;
			end if;
			v_order := v_order + 1;
			v_gram_weight := (v_item ->> 'gramWeight')::numeric;
			v_amount := case
				when jsonb_typeof(v_item -> 'amount') = 'number'
					and (v_item ->> 'amount')::numeric > 0
				then (v_item ->> 'amount')::numeric
				else null
			end;
			v_unit_key := nullif(btrim(v_item ->> 'unitKey'), '');
			if v_unit_key is not null and not exists (
				select 1 from public.serving_measure_units unit
				where unit.key = v_unit_key and unit.enabled
			) then
				v_unit_key := null;
			end if;
			if v_amount is null or v_unit_key is null then
				v_amount := null;
				v_unit_key := null;
			end if;
			v_source := coalesce(nullif(btrim(v_item ->> 'source'), ''), p_default_source);
			if v_source not in (
				'usda', 'open-food-facts', 'user-label', 'manufacturer', 'gs1',
				'community-reviewed', 'unknown'
			) then
				v_source := p_default_source;
			end if;
			v_source_reference := coalesce(
				nullif(btrim(v_item ->> 'sourceReference'), ''),
				p_default_source_reference
			);
			v_confidence := coalesce(
				nullif(btrim(v_item ->> 'confidence'), ''),
				p_default_confidence
			);
			if v_confidence not in (
				'source-verified', 'moderator-reviewed', 'corroborated',
				'user-reported', 'imported', 'unknown'
			) then
				v_confidence := p_default_confidence;
			end if;
			v_requested_primary := jsonb_typeof(v_item -> 'isPrimary') = 'boolean'
				and (v_item ->> 'isPrimary')::boolean;

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
				amount,
				unit_key,
				is_primary,
				source,
				source_reference,
				confidence
			)
			values (
				p_owner_user_id,
				p_user_food_list_item_id,
				p_custom_food_id,
				p_shared_product_submission_id,
				p_shared_product_id,
				p_shared_product_revision_id,
				p_shared_product_observation_id,
				v_order,
				v_label,
				v_gram_weight,
				v_amount,
				v_unit_key,
				case
					when not v_primary_used and v_requested_primary
						then true
					else false
				end,
				v_source,
				v_source_reference,
				v_confidence
			);
			if not v_primary_used and v_requested_primary then
				v_primary_used := true;
			end if;
			v_inserted_count := v_inserted_count + 1;
		end loop;

		if v_inserted_count > 0 then
			if not v_primary_used then
				update public.food_servings serving
				set is_primary = true
				where serving.serving_order = 1
					and (p_user_food_list_item_id is null or serving.user_food_list_item_id = p_user_food_list_item_id)
					and (p_custom_food_id is null or serving.custom_food_id = p_custom_food_id)
					and (p_shared_product_submission_id is null or serving.shared_product_submission_id = p_shared_product_submission_id)
					and (p_shared_product_id is null or serving.shared_product_id = p_shared_product_id)
					and (p_shared_product_revision_id is null or serving.shared_product_revision_id = p_shared_product_revision_id)
					and (p_shared_product_observation_id is null or serving.shared_product_observation_id = p_shared_product_observation_id);
			end if;
			return;
		end if;
	end if;

	if jsonb_typeof(p_food -> 'hasSourceServing') = 'boolean'
		and (p_food ->> 'hasSourceServing')::boolean is false then
		return;
	end if;

	if jsonb_typeof(p_food -> 'customServingWeightGrams') = 'number'
		and (p_food ->> 'customServingWeightGrams')::numeric > 0 then
		v_gram_weight := (p_food ->> 'customServingWeightGrams')::numeric;
		v_unit_key := 'g';
		v_amount := v_gram_weight;
	else
		v_legacy_serving_size := case
			when jsonb_typeof(p_food -> 'servingSize') = 'number'
				and (p_food ->> 'servingSize')::numeric > 0
			then (p_food ->> 'servingSize')::numeric
			else null
		end;
		if v_legacy_serving_size is null then
			return;
		end if;

		select
			unit.key,
			unit.dimension,
			unit.conversion_to_base
		into
			v_legacy_unit_key,
			v_legacy_unit_dimension,
			v_legacy_conversion
		from public.serving_measure_units unit
		left join public.serving_measure_aliases alias
			on alias.unit_key = unit.key
		where unit.enabled
			and (
				unit.key = btrim(p_food ->> 'servingSizeUnit')
				or alias.normalized_alias = lower(regexp_replace(
					btrim(coalesce(p_food ->> 'servingSizeUnit', '')),
					'\s+',
					'',
					'g'
				))
			)
		order by case when unit.key = btrim(p_food ->> 'servingSizeUnit') then 0 else 1 end
		limit 1;

		if v_legacy_unit_key is null or v_legacy_unit_dimension <> 'weight' then
			return;
		end if;
		v_gram_weight := v_legacy_serving_size * v_legacy_conversion;
		v_unit_key := v_legacy_unit_key;
		v_amount := v_legacy_serving_size;
	end if;

	v_label := coalesce(
		nullif(btrim(p_food ->> 'customServingLabel'), ''),
		nullif(btrim(p_food ->> 'householdServingFullText'), ''),
		trim(to_char(v_gram_weight, 'FM999999990.##')) || 'g'
	);
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
		amount,
		unit_key,
		is_primary,
		source,
		source_reference,
		confidence
	)
	values (
		p_owner_user_id,
		p_user_food_list_item_id,
		p_custom_food_id,
		p_shared_product_submission_id,
		p_shared_product_id,
		p_shared_product_revision_id,
		p_shared_product_observation_id,
		1,
		v_label,
		v_gram_weight,
		v_amount,
		v_unit_key,
		true,
		p_default_source,
		p_default_source_reference,
		p_default_confidence
	);
end;
$$;

create function public.sync_food_servings_from_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_food jsonb;
	v_owner_user_id uuid;
	v_source text;
	v_source_reference text;
	v_confidence text;
begin
	if tg_table_schema <> 'public' then
		raise exception 'Unsupported serving parent schema';
	end if;

	case tg_table_name
		when 'user_food_list_items' then
			v_food := new.food;
			v_owner_user_id := new.user_id;
			v_source := case new.food ->> 'barcodeSource'
				when 'usda' then 'usda'
				when 'open-food-facts' then 'open-food-facts'
				when 'community' then 'community-reviewed'
				when 'manual' then 'user-label'
				else case when new.food ? 'sharedProductId' then 'community-reviewed' else 'usda' end
			end;
			v_source_reference := coalesce(new.food ->> 'barcode', new.food ->> 'gtinUpc', new.fdc_id::text);
			v_confidence := case v_source
				when 'usda' then 'source-verified'
				when 'community-reviewed' then 'moderator-reviewed'
				when 'user-label' then 'user-reported'
				else 'imported'
			end;
			perform public.replace_food_servings(
				v_food, v_owner_user_id, new.id, null, null, null, null, null,
				v_source, v_source_reference, v_confidence
			);

		when 'custom_foods' then
			v_food := new.food;
			v_owner_user_id := new.user_id;
			v_source := case new.food ->> 'barcodeSource'
				when 'usda' then 'usda'
				when 'open-food-facts' then 'open-food-facts'
				when 'community' then 'community-reviewed'
				else 'user-label'
			end;
			v_source_reference := coalesce(new.barcode, new.fdc_id::text);
			v_confidence := case v_source
				when 'usda' then 'source-verified'
				when 'community-reviewed' then 'moderator-reviewed'
				when 'user-label' then 'user-reported'
				else 'imported'
			end;
			perform public.replace_food_servings(
				v_food, v_owner_user_id, null, new.id, null, null, null, null,
				v_source, v_source_reference, v_confidence
			);

		when 'shared_product_submissions' then
			v_source := coalesce(new.matched_source, 'user-label');
			v_confidence := case new.verification_status
				when 'source_verified' then 'source-verified'
				when 'manual_review' then 'moderator-reviewed'
				else 'user-reported'
			end;
			perform public.replace_food_servings(
				new.food, new.submitted_by, null, null, new.id, null, null, null,
				v_source, coalesce(new.matched_reference, new.barcode), v_confidence
			);

		when 'shared_products' then
			perform public.replace_food_servings(
				new.food, null, null, null, null, new.id, null, null,
				new.source, new.source_reference, new.confidence
			);

		when 'shared_product_revisions' then
			v_confidence := case new.source
				when 'usda' then 'source-verified'
				when 'open-food-facts' then 'imported'
				else 'moderator-reviewed'
			end;
			perform public.replace_food_servings(
				new.food, null, null, null, null, null, new.id, null,
				new.source, new.source_reference, v_confidence
			);

		when 'shared_product_observations' then
			v_confidence := case new.source
				when 'usda' then 'source-verified'
				when 'manufacturer' then 'source-verified'
				when 'gs1' then 'source-verified'
				when 'user-label' then 'user-reported'
				else 'imported'
			end;
			perform public.replace_food_servings(
				new.normalized_food, null, null, null, null, null, null, new.id,
				new.source, new.source_reference, v_confidence
			);

		else
			raise exception 'Unsupported serving parent table: %', tg_table_name;
	end case;
	return new;
end;
$$;

create trigger sync_user_food_list_item_servings
	after insert or update of food on public.user_food_list_items
	for each row execute function public.sync_food_servings_from_parent();
create trigger sync_custom_food_servings
	after insert or update of food on public.custom_foods
	for each row execute function public.sync_food_servings_from_parent();
create trigger sync_shared_product_submission_servings
	after insert or update of food, matched_source, matched_reference, verification_status
	on public.shared_product_submissions
	for each row execute function public.sync_food_servings_from_parent();
create trigger sync_shared_product_servings
	after insert or update of food, source, source_reference, confidence
	on public.shared_products
	for each row execute function public.sync_food_servings_from_parent();
create trigger sync_shared_product_revision_servings
	after insert or update of food, source, source_reference on public.shared_product_revisions
	for each row execute function public.sync_food_servings_from_parent();
create trigger sync_shared_product_observation_servings
	after insert or update of normalized_food, source, source_reference
	on public.shared_product_observations
	for each row execute function public.sync_food_servings_from_parent();

alter table public.food_servings enable row level security;
alter table public.food_servings force row level security;

create policy "Users can read accessible normalized servings"
	on public.food_servings
	for select
	to authenticated
	using (
		owner_user_id = (select auth.uid())
		or (
			shared_product_id is not null
			and exists (
				select 1
				from public.shared_products product
				where product.id = food_servings.shared_product_id
					and product.status = 'active'
			)
		)
	);

revoke all on table public.food_servings from public, anon, authenticated;
grant select on table public.food_servings to authenticated;
grant all on table public.food_servings to service_role;
revoke all on function public.replace_food_servings(
	jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text
) from public, anon, authenticated;
revoke all on function public.sync_food_servings_from_parent()
	from public, anon, authenticated;

select public.replace_food_servings(
	item.food, item.user_id, item.id, null, null, null, null, null,
	case item.food ->> 'barcodeSource'
		when 'usda' then 'usda'
		when 'open-food-facts' then 'open-food-facts'
		when 'community' then 'community-reviewed'
		when 'manual' then 'user-label'
		else case when item.food ? 'sharedProductId' then 'community-reviewed' else 'usda' end
	end,
	coalesce(item.food ->> 'barcode', item.food ->> 'gtinUpc', item.fdc_id::text),
	case item.food ->> 'barcodeSource'
		when 'manual' then 'user-reported'
		when 'community' then 'moderator-reviewed'
		when 'open-food-facts' then 'imported'
		else 'source-verified'
	end
)
from public.user_food_list_items item;

select public.replace_food_servings(
	food.food, food.user_id, null, food.id, null, null, null, null,
	case food.food ->> 'barcodeSource'
		when 'usda' then 'usda'
		when 'open-food-facts' then 'open-food-facts'
		when 'community' then 'community-reviewed'
		else 'user-label'
	end,
	coalesce(food.barcode, food.fdc_id::text),
	case food.food ->> 'barcodeSource'
		when 'usda' then 'source-verified'
		when 'open-food-facts' then 'imported'
		when 'community' then 'moderator-reviewed'
		else 'user-reported'
	end
)
from public.custom_foods food;

select public.replace_food_servings(
	submission.food, submission.submitted_by, null, null, submission.id, null, null, null,
	coalesce(submission.matched_source, 'user-label'),
	coalesce(submission.matched_reference, submission.barcode),
	case submission.verification_status
		when 'source_verified' then 'source-verified'
		when 'manual_review' then 'moderator-reviewed'
		else 'user-reported'
	end
)
from public.shared_product_submissions submission;

select public.replace_food_servings(
	product.food, null, null, null, null, product.id, null, null,
	product.source, product.source_reference, product.confidence
)
from public.shared_products product;

select public.replace_food_servings(
	revision.food, null, null, null, null, null, revision.id, null,
	revision.source, revision.source_reference,
	case revision.source
		when 'usda' then 'source-verified'
		when 'open-food-facts' then 'imported'
		else 'moderator-reviewed'
	end
)
from public.shared_product_revisions revision;

select public.replace_food_servings(
	observation.normalized_food, null, null, null, null, null, null, observation.id,
	observation.source, observation.source_reference,
	case observation.source
		when 'usda' then 'source-verified'
		when 'manufacturer' then 'source-verified'
		when 'gs1' then 'source-verified'
		when 'user-label' then 'user-reported'
		else 'imported'
	end
)
from public.shared_product_observations observation
where observation.normalized_food is not null;
