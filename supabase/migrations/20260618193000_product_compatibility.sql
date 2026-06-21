create table public.compatibility_tags (
	id uuid primary key default gen_random_uuid(),
	slug text not null unique check (btrim(slug) <> ''),
	label text not null check (btrim(label) <> ''),
	category text not null
		check (category in ('allergen', 'dietary', 'ingredient', 'avoidance')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table public.user_compatibility_rules (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	tag_id uuid references public.compatibility_tags(id) on delete set null,
	rule_type text not null
		check (
			rule_type in (
				'allergen',
				'dietary_restriction',
				'ingredient_avoid',
				'dislike'
			)
		),
	severity text not null check (severity in ('warn', 'downrank')),
	raw_value text not null check (btrim(raw_value) <> ''),
	normalized_value text not null check (btrim(normalized_value) <> ''),
	active boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (user_id, rule_type, normalized_value)
);

create table public.product_compatibility_facts (
	id uuid primary key default gen_random_uuid(),
	shared_product_id uuid references public.shared_products(id) on delete cascade,
	shared_product_observation_id uuid
		references public.shared_product_observations(id) on delete cascade,
	shared_product_submission_id uuid
		references public.shared_product_submissions(id) on delete cascade,
	tag_id uuid not null references public.compatibility_tags(id) on delete restrict,
	fact_type text not null
		check (
			fact_type in (
				'contains',
				'may_contain',
				'free_from',
				'dietary_claim',
				'ingredient_present'
			)
		),
	source_type text not null
		check (
			source_type in (
				'shared_product_metadata',
				'shared_observation_metadata',
				'shared_submission_metadata',
				'label_allergen_field',
				'label_trace_field',
				'label_dietary_field'
			)
		),
	source_text text,
	confidence text not null check (confidence in ('confirmed', 'inferred', 'uncertain')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint product_compatibility_facts_exactly_one_parent check (
		num_nonnulls(
			shared_product_id,
			shared_product_observation_id,
			shared_product_submission_id
		) = 1
	)
);

create index user_compatibility_rules_user_rule_idx
	on public.user_compatibility_rules (user_id, rule_type, active);

create index product_compatibility_facts_shared_product_idx
	on public.product_compatibility_facts (shared_product_id, fact_type, tag_id)
	where shared_product_id is not null;

create index product_compatibility_facts_observation_idx
	on public.product_compatibility_facts (shared_product_observation_id, fact_type, tag_id)
	where shared_product_observation_id is not null;

create index product_compatibility_facts_submission_idx
	on public.product_compatibility_facts (shared_product_submission_id, fact_type, tag_id)
	where shared_product_submission_id is not null;

create trigger set_compatibility_tags_updated_at
	before update on public.compatibility_tags
	for each row execute function public.set_updated_at();

create trigger set_user_compatibility_rules_updated_at
	before update on public.user_compatibility_rules
	for each row execute function public.set_updated_at();

create trigger set_product_compatibility_facts_updated_at
	before update on public.product_compatibility_facts
	for each row execute function public.set_updated_at();

alter table public.shared_products
	add column if not exists compatibility_summary jsonb not null default '{}'::jsonb
		check (jsonb_typeof(compatibility_summary) = 'object');

create or replace function public.compatibility_normalize_text(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
	select trim(
		regexp_replace(
			lower(coalesce(p_value, '')),
			'[^a-z0-9]+',
			' ',
			'g'
		)
	);
$$;

insert into public.compatibility_tags (slug, label, category)
values
	('dairy', 'Dairy', 'allergen'),
	('milk', 'Milk', 'allergen'),
	('peanut', 'Peanut', 'allergen'),
	('tree-nut', 'Tree Nut', 'allergen'),
	('soy', 'Soy', 'allergen'),
	('egg', 'Egg', 'allergen'),
	('wheat', 'Wheat', 'allergen'),
	('gluten', 'Gluten', 'allergen'),
	('fish', 'Fish', 'allergen'),
	('shellfish', 'Shellfish', 'allergen'),
	('sesame', 'Sesame', 'allergen'),
	('vegan', 'Vegan', 'dietary'),
	('vegetarian', 'Vegetarian', 'dietary'),
	('dairy-free', 'Dairy-free', 'dietary'),
	('gluten-free', 'Gluten-free', 'dietary'),
	('nut-free', 'Nut-free', 'dietary'),
	('soy-free', 'Soy-free', 'dietary'),
	('egg-free', 'Egg-free', 'dietary'),
	('halal', 'Halal', 'dietary'),
	('kosher', 'Kosher', 'dietary')
on conflict (slug) do update
set
	label = excluded.label,
	category = excluded.category,
	updated_at = now();

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

create or replace function public.rebuild_shared_product_compatibility_summary(
	p_shared_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_summary jsonb;
begin
	select jsonb_build_object(
		'version', 1,
		'generatedAt', now(),
		'allFacts', coalesce(
			jsonb_agg(
				jsonb_build_object(
					'slug', tag.slug,
					'label', tag.label,
					'category', tag.category,
					'factType', fact.fact_type,
					'sourceType', fact.source_type,
					'sourceText', fact.source_text,
					'confidence', fact.confidence
				)
				order by tag.category, tag.label, fact.fact_type
			),
			'[]'::jsonb
		),
		'contains', coalesce(
			jsonb_agg(
				jsonb_build_object(
					'slug', tag.slug,
					'label', tag.label,
					'category', tag.category,
					'factType', fact.fact_type,
					'sourceType', fact.source_type,
					'sourceText', fact.source_text,
					'confidence', fact.confidence
				)
			) filter (where fact.fact_type = 'contains'),
			'[]'::jsonb
		),
		'mayContain', coalesce(
			jsonb_agg(
				jsonb_build_object(
					'slug', tag.slug,
					'label', tag.label,
					'category', tag.category,
					'factType', fact.fact_type,
					'sourceType', fact.source_type,
					'sourceText', fact.source_text,
					'confidence', fact.confidence
				)
			) filter (where fact.fact_type = 'may_contain'),
			'[]'::jsonb
		),
		'dietaryClaims', coalesce(
			jsonb_agg(
				jsonb_build_object(
					'slug', tag.slug,
					'label', tag.label,
					'category', tag.category,
					'factType', fact.fact_type,
					'sourceType', fact.source_type,
					'sourceText', fact.source_text,
					'confidence', fact.confidence
				)
			) filter (where fact.fact_type = 'dietary_claim'),
			'[]'::jsonb
		),
		'ingredientSignals', coalesce(
			jsonb_agg(
				jsonb_build_object(
					'slug', tag.slug,
					'label', tag.label,
					'category', tag.category,
					'factType', fact.fact_type,
					'sourceType', fact.source_type,
					'sourceText', fact.source_text,
					'confidence', fact.confidence
				)
			) filter (where fact.fact_type = 'ingredient_present'),
			'[]'::jsonb
		)
	)
	into v_summary
	from public.product_compatibility_facts fact
	join public.compatibility_tags tag
		on tag.id = fact.tag_id
	where fact.shared_product_id = p_shared_product_id;

	update public.shared_products
	set compatibility_summary = coalesce(v_summary, '{}'::jsonb),
		updated_at = now()
	where id = p_shared_product_id;
end;
$$;

create or replace function public.sync_shared_product_compatibility_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if tg_op = 'DELETE' then
		if old.shared_product_id is not null then
			perform public.rebuild_shared_product_compatibility_summary(old.shared_product_id);
		end if;
		return old;
	end if;

	if new.shared_product_id is not null then
		perform public.rebuild_shared_product_compatibility_summary(new.shared_product_id);
	end if;
	return new;
end;
$$;

create or replace function public.sync_shared_product_compatibility_from_food()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	perform public.extract_product_compatibility_facts(
		new.id,
		null,
		null,
		new.food,
		'shared_product_metadata'
	);
	return new;
end;
$$;

create or replace function public.sync_shared_product_observation_compatibility_from_food()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	perform public.extract_product_compatibility_facts(
		null,
		new.id,
		null,
		coalesce(new.normalized_food, '{}'::jsonb),
		'shared_observation_metadata'
	);
	return new;
end;
$$;

create or replace function public.sync_shared_product_submission_compatibility_from_food()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	perform public.extract_product_compatibility_facts(
		null,
		null,
		new.id,
		new.food,
		'shared_submission_metadata'
	);
	return new;
end;
$$;

drop trigger if exists sync_shared_product_compatibility_summary
	on public.product_compatibility_facts;
create trigger sync_shared_product_compatibility_summary
	after insert or update or delete on public.product_compatibility_facts
	for each row execute function public.sync_shared_product_compatibility_summary();

drop trigger if exists sync_shared_product_compatibility_from_food
	on public.shared_products;
create trigger sync_shared_product_compatibility_from_food
	after insert or update of food on public.shared_products
	for each row execute function public.sync_shared_product_compatibility_from_food();

drop trigger if exists sync_shared_product_observation_compatibility_from_food
	on public.shared_product_observations;
create trigger sync_shared_product_observation_compatibility_from_food
	after insert or update of normalized_food on public.shared_product_observations
	for each row execute function public.sync_shared_product_observation_compatibility_from_food();

drop trigger if exists sync_shared_product_submission_compatibility_from_food
	on public.shared_product_submissions;
create trigger sync_shared_product_submission_compatibility_from_food
	after insert or update of food on public.shared_product_submissions
	for each row execute function public.sync_shared_product_submission_compatibility_from_food();

alter table public.compatibility_tags enable row level security;
alter table public.compatibility_tags force row level security;
alter table public.user_compatibility_rules enable row level security;
alter table public.user_compatibility_rules force row level security;
alter table public.product_compatibility_facts enable row level security;
alter table public.product_compatibility_facts force row level security;

create policy "Authenticated users can read compatibility tags"
	on public.compatibility_tags
	for select
	to authenticated
	using (true);

create policy "Users can read their compatibility rules"
	on public.user_compatibility_rules
	for select
	to authenticated
	using (user_id = (select auth.uid()));

create policy "Users can create their compatibility rules"
	on public.user_compatibility_rules
	for insert
	to authenticated
	with check (user_id = (select auth.uid()));

create policy "Users can update their compatibility rules"
	on public.user_compatibility_rules
	for update
	to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

create policy "Users can delete their compatibility rules"
	on public.user_compatibility_rules
	for delete
	to authenticated
	using (user_id = (select auth.uid()));

create policy "Authenticated users can read shared product compatibility facts"
	on public.product_compatibility_facts
	for select
	to authenticated
	using (
		(shared_product_id is not null and exists (
			select 1
			from public.shared_products product
			where product.id = product_compatibility_facts.shared_product_id
				and product.status = 'active'
		))
		or (
			shared_product_submission_id is not null
			and exists (
				select 1
				from public.shared_product_submissions submission
				where submission.id = product_compatibility_facts.shared_product_submission_id
					and submission.submitted_by = (select auth.uid())
			)
		)
	);

revoke all on table public.compatibility_tags from public, anon, authenticated;
revoke all on table public.user_compatibility_rules from public, anon;
revoke all on table public.product_compatibility_facts from public, anon, authenticated;

grant select on table public.compatibility_tags to authenticated;
grant select, insert, update, delete on table public.user_compatibility_rules to authenticated;
grant select on table public.product_compatibility_facts to authenticated;

revoke all on function public.compatibility_normalize_text(text)
	from public, anon, authenticated;
revoke all on function public.sync_user_compatibility_rules(uuid, text[], text[], text[], text[])
	from public, anon, authenticated;
revoke all on function public.extract_product_compatibility_facts(uuid, uuid, uuid, jsonb, text)
	from public, anon, authenticated;
revoke all on function public.rebuild_shared_product_compatibility_summary(uuid)
	from public, anon, authenticated;
revoke all on function public.sync_shared_product_compatibility_summary()
	from public, anon, authenticated;
revoke all on function public.sync_shared_product_compatibility_from_food()
	from public, anon, authenticated;
revoke all on function public.sync_shared_product_observation_compatibility_from_food()
	from public, anon, authenticated;
revoke all on function public.sync_shared_product_submission_compatibility_from_food()
	from public, anon, authenticated;

grant execute on function public.sync_user_compatibility_rules(
	uuid,
	text[],
	text[],
	text[],
	text[]
) to authenticated;

grant execute on function public.extract_product_compatibility_facts(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) to service_role;
grant execute on function public.rebuild_shared_product_compatibility_summary(uuid)
	to service_role;
grant execute on function public.sync_shared_product_compatibility_summary()
	to service_role;
grant execute on function public.sync_shared_product_compatibility_from_food()
	to service_role;
grant execute on function public.sync_shared_product_observation_compatibility_from_food()
	to service_role;
grant execute on function public.sync_shared_product_submission_compatibility_from_food()
	to service_role;

select public.sync_user_compatibility_rules(
	preferences.user_id,
	preferences.food_preferences,
	preferences.allergens,
	preferences.dietary_restrictions,
	preferences.ingredients_to_avoid
)
from public.user_food_preferences preferences;

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
