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
