alter table public.shared_product_submissions
	add column category_option_id text
		references public.custom_food_category_options(id) on delete restrict;

alter table public.shared_products
	add column category_option_id text
		references public.custom_food_category_options(id) on delete restrict;

alter table public.shared_product_revisions
	add column category_option_id text
		references public.custom_food_category_options(id) on delete restrict;

create index shared_product_submissions_category_option_idx
	on public.shared_product_submissions (category_option_id)
	where category_option_id is not null;

create index shared_products_category_option_idx
	on public.shared_products (category_option_id)
	where category_option_id is not null;

create index shared_product_revisions_category_option_idx
	on public.shared_product_revisions (category_option_id)
	where category_option_id is not null;

create or replace function public.normalize_food_category_value(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
	select btrim(
		regexp_replace(
			regexp_replace(
				regexp_replace(
					regexp_replace(lower(btrim(p_value)), '^[a-z]{2}:', '', 'i'),
					'&',
					' and ',
					'g'
				),
				'-',
				' ',
				'g'
			),
			'[^a-z0-9]+',
			' ',
			'g'
		)
	);
$$;

create or replace function public.resolve_custom_food_category_option(
	p_source_values text[]
)
returns table (
	category_option_id text,
	category_option_label text,
	source_normalized_value text,
	confidence text
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
		candidate.confidence
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

update public.shared_product_submissions submission
set category_option_id = (
	select resolved.category_option_id
	from public.resolve_custom_food_category_option(
		array(
			select category.value
			from jsonb_array_elements_text(
				coalesce(submission.food -> 'categories', '[]'::jsonb)
			) with ordinality as category(value, source_order)
			order by category.source_order
		)
	) resolved
	limit 1
)
where submission.category_option_id is null;

update public.shared_products product
set category_option_id = submission.category_option_id
from public.shared_product_submissions submission
where product.approved_submission_id = submission.id
	and product.category_option_id is null
	and submission.category_option_id is not null;

update public.shared_product_revisions revision
set category_option_id = product.category_option_id
from public.shared_products product
where revision.shared_product_id = product.id
	and revision.category_option_id is null
	and product.category_option_id is not null;

create or replace function public.set_shared_product_category_from_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	select submission.category_option_id
	into new.category_option_id
	from public.shared_product_submissions submission
	where submission.id = new.approved_submission_id;

	if new.category_option_id is null then
		raise exception 'A canonical food category is required before publishing a shared product';
	end if;

	return new;
end;
$$;

create trigger set_shared_product_category_from_submission
	before insert or update of approved_submission_id
	on public.shared_products
	for each row execute function public.set_shared_product_category_from_submission();

create or replace function public.set_shared_product_revision_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	select product.category_option_id
	into new.category_option_id
	from public.shared_products product
	where product.id = new.shared_product_id;

	if new.category_option_id is null then
		raise exception 'A canonical food category is required before creating a shared product revision';
	end if;

	return new;
end;
$$;

create trigger set_shared_product_revision_category
	before insert or update of shared_product_id
	on public.shared_product_revisions
	for each row execute function public.set_shared_product_revision_category();

revoke all on function public.normalize_food_category_value(text)
	from public, anon, authenticated;
grant execute on function public.normalize_food_category_value(text)
	to authenticated, service_role;

revoke all on function public.resolve_custom_food_category_option(text[])
	from public, anon, authenticated;
grant execute on function public.resolve_custom_food_category_option(text[])
	to authenticated, service_role;

revoke all on function public.set_shared_product_category_from_submission()
	from public, anon, authenticated;
revoke all on function public.set_shared_product_revision_category()
	from public, anon, authenticated;
