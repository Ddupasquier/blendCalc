create table public.food_preference_option_catalog (
	id uuid primary key default gen_random_uuid(),
	category text not null
		check (category in ('allergen', 'dietary', 'ingredient')),
	label text not null check (btrim(label) <> ''),
	normalized_value text not null check (btrim(normalized_value) <> ''),
	source_type text not null
		check (source_type in ('compatibility_fact', 'ingredient_list')),
	tag_id uuid references public.compatibility_tags(id) on delete set null,
	source_values text[] not null default '{}'::text[],
	usage_count integer not null default 0 check (usage_count >= 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (category, normalized_value)
);

create index food_preference_option_catalog_category_usage_idx
	on public.food_preference_option_catalog (category, usage_count desc, label asc);

create trigger set_food_preference_option_catalog_updated_at
	before update on public.food_preference_option_catalog
	for each row execute function public.set_updated_at();

create or replace function public.rebuild_food_preference_option_catalog()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	delete from public.food_preference_option_catalog;

	insert into public.food_preference_option_catalog (
		category,
		label,
		normalized_value,
		source_type,
		tag_id,
		source_values,
		usage_count
	)
	select
		'allergen',
		tag.label,
		public.compatibility_normalize_text(tag.label),
		'compatibility_fact',
		tag.id,
		array_agg(distinct coalesce(fact.source_text, tag.label) order by coalesce(fact.source_text, tag.label)),
		count(distinct fact.shared_product_id)::integer
	from public.product_compatibility_facts fact
	join public.shared_products product
		on product.id = fact.shared_product_id
		and product.status = 'active'
	join public.compatibility_tags tag
		on tag.id = fact.tag_id
	where tag.category = 'allergen'
		and fact.fact_type in ('contains', 'may_contain')
	group by tag.id, tag.label;

	insert into public.food_preference_option_catalog (
		category,
		label,
		normalized_value,
		source_type,
		tag_id,
		source_values,
		usage_count
	)
	select
		'dietary',
		tag.label,
		public.compatibility_normalize_text(tag.label),
		'compatibility_fact',
		tag.id,
		array_agg(distinct coalesce(fact.source_text, tag.label) order by coalesce(fact.source_text, tag.label)),
		count(distinct fact.shared_product_id)::integer
	from public.product_compatibility_facts fact
	join public.shared_products product
		on product.id = fact.shared_product_id
		and product.status = 'active'
	join public.compatibility_tags tag
		on tag.id = fact.tag_id
	where tag.category = 'dietary'
		and fact.fact_type = 'dietary_claim'
	group by tag.id, tag.label;

	insert into public.food_preference_option_catalog (
		category,
		label,
		normalized_value,
		source_type,
		tag_id,
		source_values,
		usage_count
	)
	select
		'ingredient',
		min(raw_values.value),
		normalized.normalized_value,
		'ingredient_list',
		null,
		array_agg(distinct raw_values.value order by raw_values.value),
		count(distinct product.id)::integer
	from public.shared_products product
	cross join lateral jsonb_array_elements_text(
		case
			when jsonb_typeof(product.food -> 'ingredientList') = 'array' then product.food -> 'ingredientList'
			else '[]'::jsonb
		end
	) as raw_values(value)
	cross join lateral (
		select public.compatibility_normalize_text(raw_values.value) as normalized_value
	) normalized
	where product.status = 'active'
		and normalized.normalized_value <> ''
		and char_length(normalized.normalized_value) <= 60
	group by normalized.normalized_value;
end;
$$;

create or replace function public.sync_food_preference_option_catalog()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	perform public.rebuild_food_preference_option_catalog();
	return null;
end;
$$;

drop trigger if exists sync_food_preference_option_catalog_from_shared_products
	on public.shared_products;
create trigger sync_food_preference_option_catalog_from_shared_products
	after insert or update of food, status or delete on public.shared_products
	for each statement execute function public.sync_food_preference_option_catalog();

alter table public.food_preference_option_catalog enable row level security;
alter table public.food_preference_option_catalog force row level security;

create policy "Authenticated users can read food preference option catalog"
	on public.food_preference_option_catalog
	for select
	to authenticated
	using (true);

revoke all on table public.food_preference_option_catalog
	from public, anon, authenticated;
grant select on table public.food_preference_option_catalog to authenticated;

revoke all on function public.rebuild_food_preference_option_catalog()
	from public, anon, authenticated;
revoke all on function public.sync_food_preference_option_catalog()
	from public, anon, authenticated;

grant execute on function public.rebuild_food_preference_option_catalog()
	to service_role;
grant execute on function public.sync_food_preference_option_catalog()
	to service_role;

select public.rebuild_food_preference_option_catalog();
