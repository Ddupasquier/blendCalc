create table public.nutrient_definitions (
	nutrient_id bigint primary key check (nutrient_id > 0),
	nutrient_name text not null check (btrim(nutrient_name) <> ''),
	nutrient_number text,
	default_unit_name text not null check (btrim(default_unit_name) <> ''),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table public.food_nutrients (
	id bigint generated always as identity primary key,
	owner_user_id uuid references auth.users(id) on delete cascade,
	user_food_list_item_id uuid references public.user_food_list_items(id) on delete cascade,
	custom_food_id uuid references public.custom_foods(id) on delete cascade,
	shared_product_submission_id uuid references public.shared_product_submissions(id) on delete cascade,
	shared_product_id uuid references public.shared_products(id) on delete cascade,
	shared_product_revision_id uuid references public.shared_product_revisions(id) on delete cascade,
	shared_product_observation_id uuid references public.shared_product_observations(id) on delete cascade,
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete restrict,
	amount_per_100g numeric not null check (amount_per_100g >= 0),
	unit_name text not null check (btrim(unit_name) <> ''),
	value_origin text not null check (value_origin in ('reported', 'derived')),
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
	source_observation_id uuid references public.shared_product_observations(id) on delete set null,
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
	constraint food_nutrients_exactly_one_parent check (
		num_nonnulls(
			user_food_list_item_id,
			custom_food_id,
			shared_product_submission_id,
			shared_product_id,
			shared_product_revision_id,
			shared_product_observation_id
		) = 1
	),
	constraint food_nutrients_private_owner check (
		owner_user_id is null
		or user_food_list_item_id is not null
		or custom_food_id is not null
		or shared_product_submission_id is not null
	)
);

create unique index food_nutrients_list_item_nutrient_unique
	on public.food_nutrients (user_food_list_item_id, nutrient_id)
	where user_food_list_item_id is not null;

create unique index food_nutrients_custom_food_nutrient_unique
	on public.food_nutrients (custom_food_id, nutrient_id)
	where custom_food_id is not null;

create unique index food_nutrients_submission_nutrient_unique
	on public.food_nutrients (shared_product_submission_id, nutrient_id)
	where shared_product_submission_id is not null;

create unique index food_nutrients_shared_product_nutrient_unique
	on public.food_nutrients (shared_product_id, nutrient_id)
	where shared_product_id is not null;

create unique index food_nutrients_revision_nutrient_unique
	on public.food_nutrients (shared_product_revision_id, nutrient_id)
	where shared_product_revision_id is not null;

create unique index food_nutrients_observation_nutrient_unique
	on public.food_nutrients (shared_product_observation_id, nutrient_id)
	where shared_product_observation_id is not null;

create index food_nutrients_owner_nutrient_amount_idx
	on public.food_nutrients (owner_user_id, nutrient_id, amount_per_100g desc)
	where owner_user_id is not null;

create index food_nutrients_shared_nutrient_amount_idx
	on public.food_nutrients (nutrient_id, amount_per_100g desc, shared_product_id)
	where shared_product_id is not null;

create index food_nutrients_source_observation_idx
	on public.food_nutrients (source_observation_id)
	where source_observation_id is not null;

create trigger set_nutrient_definitions_updated_at
	before update on public.nutrient_definitions
	for each row execute function public.set_updated_at();

create trigger set_food_nutrients_updated_at
	before update on public.food_nutrients
	for each row execute function public.set_updated_at();

create function public.replace_food_nutrients(
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
		raise exception 'Exactly one nutrient parent is required';
	end if;

	if p_default_source not in (
		'usda',
		'open-food-facts',
		'user-label',
		'manufacturer',
		'gs1',
		'community-reviewed',
		'unknown'
	) then
		raise exception 'Unsupported nutrient source';
	end if;

	if p_default_confidence not in (
		'source-verified',
		'moderator-reviewed',
		'corroborated',
		'user-reported',
		'imported',
		'unknown'
	) then
		raise exception 'Unsupported nutrient confidence';
	end if;

	delete from public.food_nutrients
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

	if p_food is null or jsonb_typeof(p_food -> 'foodNutrients') <> 'array' then
		return;
	end if;

	with parsed as (
		select distinct on (nutrient_id)
			nutrient_id,
			nutrient_name,
			nutrient_number,
			unit_name,
			amount_per_100g,
			case
				when jsonb_typeof(p_food -> 'reportedNutrientIds') = 'array'
					and not (
						(p_food -> 'reportedNutrientIds') @> jsonb_build_array(nutrient_id)
					)
				then 'derived'
				else 'reported'
			end as value_origin
		from (
			select
				(item ->> 'nutrientId')::bigint as nutrient_id,
				btrim(item ->> 'nutrientName') as nutrient_name,
				nullif(btrim(item ->> 'nutrientNumber'), '') as nutrient_number,
				upper(btrim(item ->> 'unitName')) as unit_name,
				(item ->> 'value')::numeric as amount_per_100g,
				ordinality
			from jsonb_array_elements(p_food -> 'foodNutrients')
				with ordinality as nutrient_items(item, ordinality)
			where jsonb_typeof(item) = 'object'
				and jsonb_typeof(item -> 'nutrientId') = 'number'
				and jsonb_typeof(item -> 'value') = 'number'
				and (item ->> 'nutrientId')::bigint > 0
				and (item ->> 'value')::numeric >= 0
				and btrim(coalesce(item ->> 'nutrientName', '')) <> ''
				and btrim(coalesce(item ->> 'unitName', '')) <> ''
		) valid_nutrients
		order by nutrient_id, ordinality
	),
	definitions as (
		insert into public.nutrient_definitions (
			nutrient_id,
			nutrient_name,
			nutrient_number,
			default_unit_name
		)
		select
			nutrient_id,
			nutrient_name,
			nutrient_number,
			unit_name
		from parsed
		on conflict (nutrient_id) do update
		set nutrient_name = case
				when p_default_source = 'usda' then excluded.nutrient_name
				else public.nutrient_definitions.nutrient_name
			end,
			nutrient_number = case
				when p_default_source = 'usda' then excluded.nutrient_number
				else public.nutrient_definitions.nutrient_number
			end,
			default_unit_name = case
				when p_default_source = 'usda' then excluded.default_unit_name
				else public.nutrient_definitions.default_unit_name
			end,
			updated_at = case
				when p_default_source = 'usda' then now()
				else public.nutrient_definitions.updated_at
			end
		returning nutrient_id
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
		source,
		source_reference,
		source_observation_id,
		confidence
	)
	select
		p_owner_user_id,
		p_user_food_list_item_id,
		p_custom_food_id,
		p_shared_product_submission_id,
		p_shared_product_id,
		p_shared_product_revision_id,
		p_shared_product_observation_id,
		parsed.nutrient_id,
		parsed.amount_per_100g,
		parsed.unit_name,
		parsed.value_origin,
		coalesce(selected_source.source, p_default_source),
		coalesce(selected_source.source_reference, p_default_source_reference),
		selected_source.observation_id,
		coalesce(selected_source.confidence, p_default_confidence)
	from parsed
	join definitions using (nutrient_id)
	left join lateral (
		select
			observation.id as observation_id,
			observation.source,
			observation.source_reference,
			provenance.confidence
		from public.shared_product_field_provenance provenance
		join public.shared_product_observations observation
			on observation.id = provenance.observation_id
		where p_shared_product_id is not null
			and provenance.shared_product_id = p_shared_product_id
			and provenance.field_path = 'nutrient:' || parsed.nutrient_id::text
			and provenance.selected
		limit 1
	) selected_source on true;
end;
$$;

create function public.sync_food_nutrients_from_parent()
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
		raise exception 'Unsupported nutrient parent schema';
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
				else case
					when new.food ? 'sharedProductId' then 'community-reviewed'
					when lower(coalesce(new.food ->> 'dataType', '')) = 'custom' then 'user-label'
					when new.food ? 'fdcId' then 'usda'
					else 'unknown'
				end
			end;
			v_source_reference := coalesce(new.food ->> 'barcode', new.fdc_id::text);
			v_confidence := case new.food ->> 'sharedProductConfidence'
				when 'source-verified' then 'source-verified'
				when 'moderator-reviewed' then 'moderator-reviewed'
				when 'corroborated' then 'corroborated'
				else case v_source
					when 'usda' then 'source-verified'
					when 'user-label' then 'user-reported'
					when 'community-reviewed' then 'moderator-reviewed'
					else 'imported'
				end
			end;

			perform public.replace_food_nutrients(
				v_food,
				v_owner_user_id,
				new.id,
				null,
				null,
				null,
				null,
				null,
				v_source,
				v_source_reference,
				v_confidence
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

			perform public.replace_food_nutrients(
				v_food,
				v_owner_user_id,
				null,
				new.id,
				null,
				null,
				null,
				null,
				v_source,
				v_source_reference,
				v_confidence
			);

		when 'shared_product_submissions' then
			v_food := new.food;
			v_owner_user_id := new.submitted_by;
			v_source := case new.matched_source
				when 'usda' then 'usda'
				when 'open-food-facts' then 'open-food-facts'
				else case new.food ->> 'barcodeSource'
					when 'usda' then 'usda'
					when 'open-food-facts' then 'open-food-facts'
					else 'user-label'
				end
			end;
			v_source_reference := coalesce(new.matched_reference, new.barcode);
			v_confidence := case new.verification_status
				when 'source_verified' then 'source-verified'
				when 'manual_review' then 'moderator-reviewed'
				else 'user-reported'
			end;

			perform public.replace_food_nutrients(
				v_food,
				v_owner_user_id,
				null,
				null,
				new.id,
				null,
				null,
				null,
				v_source,
				v_source_reference,
				v_confidence
			);

		when 'shared_products' then
			perform public.replace_food_nutrients(
				new.food,
				null,
				null,
				null,
				null,
				new.id,
				null,
				null,
				new.source,
				new.source_reference,
				new.confidence
			);

		when 'shared_product_revisions' then
			v_confidence := case new.source
				when 'usda' then 'source-verified'
				when 'open-food-facts' then 'imported'
				else 'moderator-reviewed'
			end;

			perform public.replace_food_nutrients(
				new.food,
				null,
				null,
				null,
				null,
				null,
				new.id,
				null,
				new.source,
				new.source_reference,
				v_confidence
			);

		when 'shared_product_observations' then
			v_confidence := case new.source
				when 'usda' then 'source-verified'
				when 'manufacturer' then 'source-verified'
				when 'gs1' then 'source-verified'
				when 'user-label' then 'user-reported'
				else 'imported'
			end;

			perform public.replace_food_nutrients(
				new.normalized_food,
				null,
				null,
				null,
				null,
				null,
				null,
				new.id,
				new.source,
				new.source_reference,
				v_confidence
			);

		else
			raise exception 'Unsupported nutrient parent table: %', tg_table_name;
	end case;

	return new;
end;
$$;

create trigger sync_user_food_list_item_nutrients
	after insert or update of food on public.user_food_list_items
	for each row execute function public.sync_food_nutrients_from_parent();

create trigger sync_custom_food_nutrients
	after insert or update of food on public.custom_foods
	for each row execute function public.sync_food_nutrients_from_parent();

create trigger sync_shared_product_submission_nutrients
	after insert or update of food, matched_source, matched_reference, verification_status
	on public.shared_product_submissions
	for each row execute function public.sync_food_nutrients_from_parent();

create trigger sync_shared_product_nutrients
	after insert or update of food, source, source_reference, confidence, canonical_provenance
	on public.shared_products
	for each row execute function public.sync_food_nutrients_from_parent();

create trigger sync_shared_product_revision_nutrients
	after insert or update of food, source, source_reference on public.shared_product_revisions
	for each row execute function public.sync_food_nutrients_from_parent();

create trigger sync_shared_product_observation_nutrients
	after insert or update of normalized_food, source, source_reference
	on public.shared_product_observations
	for each row execute function public.sync_food_nutrients_from_parent();

alter table public.nutrient_definitions enable row level security;
alter table public.nutrient_definitions force row level security;
alter table public.food_nutrients enable row level security;
alter table public.food_nutrients force row level security;

create policy "Authenticated users can read nutrient definitions"
	on public.nutrient_definitions
	for select
	to authenticated
	using (true);

create policy "Users can read accessible normalized nutrients"
	on public.food_nutrients
	for select
	to authenticated
	using (
		owner_user_id = (select auth.uid())
		or (
			shared_product_id is not null
			and exists (
				select 1
				from public.shared_products product
				where product.id = food_nutrients.shared_product_id
					and product.status = 'active'
			)
		)
	);

revoke all on table public.nutrient_definitions from public, anon, authenticated;
revoke all on table public.food_nutrients from public, anon, authenticated;
grant select on table public.nutrient_definitions to authenticated;
grant select on table public.food_nutrients to authenticated;

revoke all on function public.replace_food_nutrients(
	jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text
) from public, anon, authenticated;

revoke all on function public.sync_food_nutrients_from_parent()
	from public, anon, authenticated;

select public.replace_food_nutrients(
	item.food,
	item.user_id,
	item.id,
	null,
	null,
	null,
	null,
	null,
	case item.food ->> 'barcodeSource'
		when 'usda' then 'usda'
		when 'open-food-facts' then 'open-food-facts'
		when 'community' then 'community-reviewed'
		when 'manual' then 'user-label'
		else case
			when item.food ? 'sharedProductId' then 'community-reviewed'
			when lower(coalesce(item.food ->> 'dataType', '')) = 'custom' then 'user-label'
			when item.food ? 'fdcId' then 'usda'
			else 'unknown'
		end
	end,
	coalesce(item.food ->> 'barcode', item.fdc_id::text),
	case item.food ->> 'sharedProductConfidence'
		when 'source-verified' then 'source-verified'
		when 'moderator-reviewed' then 'moderator-reviewed'
		when 'corroborated' then 'corroborated'
		else case item.food ->> 'barcodeSource'
			when 'usda' then 'source-verified'
			when 'open-food-facts' then 'imported'
			when 'community' then 'moderator-reviewed'
			when 'manual' then 'user-reported'
			else case
				when lower(coalesce(item.food ->> 'dataType', '')) = 'custom' then 'user-reported'
				when item.food ? 'fdcId' then 'source-verified'
				else 'imported'
			end
		end
	end
)
from public.user_food_list_items item;

select public.replace_food_nutrients(
	food.food,
	food.user_id,
	null,
	food.id,
	null,
	null,
	null,
	null,
	case food.food ->> 'barcodeSource'
		when 'usda' then 'usda'
		when 'open-food-facts' then 'open-food-facts'
		when 'community' then 'community-reviewed'
		else 'user-label'
	end,
	coalesce(food.barcode, food.fdc_id::text),
	case food.food ->> 'barcodeSource'
		when 'usda' then 'source-verified'
		when 'community' then 'moderator-reviewed'
		when 'open-food-facts' then 'imported'
		else 'user-reported'
	end
)
from public.custom_foods food;

select public.replace_food_nutrients(
	submission.food,
	submission.submitted_by,
	null,
	null,
	submission.id,
	null,
	null,
	null,
	case submission.matched_source
		when 'usda' then 'usda'
		when 'open-food-facts' then 'open-food-facts'
		else 'user-label'
	end,
	coalesce(submission.matched_reference, submission.barcode),
	case submission.verification_status
		when 'source_verified' then 'source-verified'
		when 'manual_review' then 'moderator-reviewed'
		else 'user-reported'
	end
)
from public.shared_product_submissions submission;

select public.replace_food_nutrients(
	product.food,
	null,
	null,
	null,
	null,
	product.id,
	null,
	null,
	product.source,
	product.source_reference,
	product.confidence
)
from public.shared_products product;

select public.replace_food_nutrients(
	revision.food,
	null,
	null,
	null,
	null,
	null,
	revision.id,
	null,
	revision.source,
	revision.source_reference,
	case revision.source
		when 'usda' then 'source-verified'
		when 'open-food-facts' then 'imported'
		else 'moderator-reviewed'
	end
)
from public.shared_product_revisions revision;

select public.replace_food_nutrients(
	observation.normalized_food,
	null,
	null,
	null,
	null,
	null,
	null,
	observation.id,
	observation.source,
	observation.source_reference,
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
