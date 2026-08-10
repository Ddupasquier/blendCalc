create or replace function public.resolve_custom_food_category_option_with_symbol(
	p_source_values text[]
)
returns table (
	category_option_id text,
	category_option_label text,
	source_normalized_value text,
	confidence text,
	symbol_key text
)
language sql
stable
security invoker
set search_path = ''
as $$
	with source_values as (
		select distinct on (normalized_value)
			public.normalize_food_category_value(source_value) as normalized_value,
			source_order
		from unnest(coalesce(p_source_values, '{}'::text[]))
			with ordinality as source(source_value, source_order)
		where public.normalize_food_category_value(source_value) <> ''
		order by normalized_value, source_order desc
	), candidates as (
		select
			mapping.category_option_id,
			mapping.category_option_label,
			mapping.source_normalized_value,
			mapping.confidence,
			mapping.observation_count,
			option.symbol_key,
			source.source_order
		from source_values source
		join public.custom_food_category_mappings mapping
			on mapping.source_normalized_value = source.normalized_value
		join public.custom_food_category_options option
			on option.id = mapping.category_option_id
			and option.enabled
	)
	select
		candidate.category_option_id,
		candidate.category_option_label,
		candidate.source_normalized_value,
		candidate.confidence,
		candidate.symbol_key
	from candidates candidate
	order by
		case candidate.confidence
			when 'exact' then 4
			when 'strong' then 3
			when 'related' then 2
			else 1
		end desc,
		candidate.source_order desc,
		candidate.observation_count desc,
		candidate.category_option_id
	limit 1;
$$;

revoke all on function public.resolve_custom_food_category_option_with_symbol(text[])
	from public;
grant execute on function public.resolve_custom_food_category_option_with_symbol(text[])
	to authenticated, service_role;

comment on function public.resolve_custom_food_category_option_with_symbol(text[]) is
	'Resolves one canonical category and its display symbol in a single database call.';
