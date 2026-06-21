alter table public.product_compatibility_facts
	drop constraint if exists product_compatibility_facts_source_type_check;

delete from public.product_compatibility_facts
where source_type = 'ingredient_parse';

alter table public.product_compatibility_facts
	add constraint product_compatibility_facts_source_type_check
	check (
		source_type in (
			'shared_product_metadata',
			'shared_observation_metadata',
			'shared_submission_metadata',
			'label_allergen_field',
			'label_trace_field',
			'label_dietary_field'
		)
	);

drop policy if exists "Authenticated users can read compatibility aliases"
	on public.compatibility_tag_aliases;

drop trigger if exists set_compatibility_tag_aliases_updated_at
	on public.compatibility_tag_aliases;

drop table if exists public.compatibility_tag_aliases;

drop function if exists public.compatibility_food_text(jsonb);
drop function if exists public.compatibility_text_has_term(text, text);

create or replace function public.sync_user_compatibility_rules(
	p_user_id uuid,
	p_food_preferences text[] default '{}'::text[],
	p_allergens text[] default '{}'::text[],
	p_dietary_restrictions text[] default '{}'::text[],
	p_ingredients_to_avoid text[] default '{}'::text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	delete from public.user_compatibility_rules
	where user_id = p_user_id;

	insert into public.user_compatibility_rules (
		user_id,
		tag_id,
		rule_type,
		severity,
		raw_value,
		normalized_value
	)
	select
		p_user_id,
		tag.id,
		values_with_rules.rule_type,
		values_with_rules.severity,
		values_with_rules.raw_value,
		values_with_rules.normalized_value
	from (
		select
			'dislike'::text as rule_type,
			'downrank'::text as severity,
			raw_value,
			public.compatibility_normalize_text(raw_value) as normalized_value
		from unnest(coalesce(p_food_preferences, '{}'::text[])) as raw_value
		union all
		select
			'allergen'::text,
			'warn'::text,
			raw_value,
			public.compatibility_normalize_text(raw_value)
		from unnest(coalesce(p_allergens, '{}'::text[])) as raw_value
		union all
		select
			'dietary_restriction'::text,
			'warn'::text,
			raw_value,
			public.compatibility_normalize_text(raw_value)
		from unnest(coalesce(p_dietary_restrictions, '{}'::text[])) as raw_value
		union all
		select
			'ingredient_avoid'::text,
			'warn'::text,
			raw_value,
			public.compatibility_normalize_text(raw_value)
		from unnest(coalesce(p_ingredients_to_avoid, '{}'::text[])) as raw_value
	) as values_with_rules
	left join public.compatibility_tags tag
		on public.compatibility_normalize_text(tag.slug) = values_with_rules.normalized_value
		or public.compatibility_normalize_text(tag.label) = values_with_rules.normalized_value
	where values_with_rules.normalized_value <> ''
	on conflict (user_id, rule_type, normalized_value) do update
	set
		tag_id = excluded.tag_id,
		severity = excluded.severity,
		raw_value = excluded.raw_value,
		active = true,
		updated_at = now();
end;
$$;

create or replace function public.extract_product_compatibility_facts(
	p_shared_product_id uuid default null,
	p_shared_product_observation_id uuid default null,
	p_shared_product_submission_id uuid default null,
	p_food jsonb default '{}'::jsonb,
	p_parent_source text default 'shared_product_metadata'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	perform coalesce(p_parent_source, 'shared_product_metadata');

	delete from public.product_compatibility_facts
	where (
			p_shared_product_id is not null
			and shared_product_id = p_shared_product_id
		)
		or (
			p_shared_product_observation_id is not null
			and shared_product_observation_id = p_shared_product_observation_id
		)
		or (
			p_shared_product_submission_id is not null
			and shared_product_submission_id = p_shared_product_submission_id
		);

	if p_food is null or jsonb_typeof(p_food) <> 'object' then
		return;
	end if;

	insert into public.product_compatibility_facts (
		shared_product_id,
		shared_product_observation_id,
		shared_product_submission_id,
		tag_id,
		fact_type,
		source_type,
		source_text,
		confidence
	)
	select distinct
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id,
		tag.id,
		'contains',
		'label_allergen_field',
		raw_values.value,
		'confirmed'
	from jsonb_array_elements_text(
		case
			when jsonb_typeof(p_food -> 'allergens') = 'array' then p_food -> 'allergens'
			else '[]'::jsonb
		end
	) as raw_values(value)
	cross join lateral (
		select public.compatibility_normalize_text(raw_values.value) as normalized_value
	) normalized
	join public.compatibility_tags tag
		on public.compatibility_normalize_text(tag.slug) = normalized.normalized_value
		or public.compatibility_normalize_text(tag.label) = normalized.normalized_value
	where tag.category = 'allergen';

	insert into public.product_compatibility_facts (
		shared_product_id,
		shared_product_observation_id,
		shared_product_submission_id,
		tag_id,
		fact_type,
		source_type,
		source_text,
		confidence
	)
	select distinct
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id,
		tag.id,
		'may_contain',
		'label_trace_field',
		raw_values.value,
		'confirmed'
	from jsonb_array_elements_text(
		case
			when jsonb_typeof(p_food -> 'traces') = 'array' then p_food -> 'traces'
			else '[]'::jsonb
		end
	) as raw_values(value)
	cross join lateral (
		select public.compatibility_normalize_text(raw_values.value) as normalized_value
	) normalized
	join public.compatibility_tags tag
		on public.compatibility_normalize_text(tag.slug) = normalized.normalized_value
		or public.compatibility_normalize_text(tag.label) = normalized.normalized_value
	where tag.category = 'allergen';

	insert into public.product_compatibility_facts (
		shared_product_id,
		shared_product_observation_id,
		shared_product_submission_id,
		tag_id,
		fact_type,
		source_type,
		source_text,
		confidence
	)
	select distinct
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id,
		tag.id,
		'dietary_claim',
		'label_dietary_field',
		raw_values.value,
		'confirmed'
	from (
		select value
		from jsonb_array_elements_text(
			case
				when jsonb_typeof(p_food -> 'dietaryTags') = 'array' then p_food -> 'dietaryTags'
				else '[]'::jsonb
			end
		)
		union all
		select value
		from jsonb_array_elements_text(
			case
				when jsonb_typeof(p_food -> 'labels') = 'array' then p_food -> 'labels'
				else '[]'::jsonb
			end
		)
		union all
		select value
		from jsonb_array_elements_text(
			case
				when jsonb_typeof(p_food -> 'categories') = 'array' then p_food -> 'categories'
				else '[]'::jsonb
			end
		)
	) as raw_values
	cross join lateral (
		select public.compatibility_normalize_text(raw_values.value) as normalized_value
	) normalized
	join public.compatibility_tags tag
		on public.compatibility_normalize_text(tag.slug) = normalized.normalized_value
		or public.compatibility_normalize_text(tag.label) = normalized.normalized_value
	where tag.category = 'dietary';
end;
$$;

select public.extract_product_compatibility_facts(
	product.id,
	null,
	null,
	product.food,
	'shared_product_metadata'
)
from public.shared_products product;

select public.extract_product_compatibility_facts(
	null,
	observation.id,
	null,
	coalesce(observation.normalized_food, '{}'::jsonb),
	'shared_observation_metadata'
)
from public.shared_product_observations observation
where observation.normalized_food is not null;

select public.extract_product_compatibility_facts(
	null,
	null,
	submission.id,
	submission.food,
	'shared_submission_metadata'
)
from public.shared_product_submissions submission;
