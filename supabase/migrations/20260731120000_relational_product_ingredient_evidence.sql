create table public.ingredient_terms (
	id uuid primary key default gen_random_uuid(),
	canonical_key text not null unique
		check (canonical_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	display_name text not null check (btrim(display_name) <> ''),
	default_language_code text,
	review_status text not null default 'pending'
		check (review_status in ('pending', 'reviewed', 'rejected')),
	source_key text references public.product_data_sources(key) on delete restrict,
	source_reference text,
	reviewed_by uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint ingredient_terms_review_check check (
		(review_status = 'reviewed' and reviewed_at is not null)
		or review_status <> 'reviewed'
	)
);

create table public.ingredient_term_aliases (
	id uuid primary key default gen_random_uuid(),
	ingredient_term_id uuid not null
		references public.ingredient_terms(id) on delete cascade,
	alias text not null check (btrim(alias) <> ''),
	normalized_alias text generated always as (
		public.compatibility_normalize_text(alias)
	) stored,
	language_code text,
	alias_type text not null default 'common'
		check (alias_type in ('common', 'scientific', 'regional', 'source-key')),
	review_status text not null default 'pending'
		check (review_status in ('pending', 'reviewed', 'rejected')),
	source_key text references public.product_data_sources(key) on delete restrict,
	source_reference text,
	reviewed_by uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint ingredient_term_aliases_normalized_check
		check (btrim(normalized_alias) <> ''),
	constraint ingredient_term_aliases_review_check check (
		(review_status = 'reviewed' and reviewed_at is not null)
		or review_status <> 'reviewed'
	)
);

create unique index ingredient_term_aliases_identity_idx
	on public.ingredient_term_aliases (
		ingredient_term_id,
		normalized_alias,
		language_code,
		alias_type,
		source_key
	) nulls not distinct;

create index ingredient_term_aliases_lookup_idx
	on public.ingredient_term_aliases (normalized_alias, review_status, language_code);

create table public.ingredient_term_relationships (
	id uuid primary key default gen_random_uuid(),
	child_term_id uuid not null
		references public.ingredient_terms(id) on delete cascade,
	parent_term_id uuid not null
		references public.ingredient_terms(id) on delete cascade,
	relationship_type text not null
		check (relationship_type in ('is-a', 'derived-from', 'processed-from')),
	processing_state text,
	jurisdiction_code text,
	conflict_inheritance text not null default 'none'
		check (conflict_inheritance in ('none', 'review-required', 'reviewed')),
	review_status text not null default 'pending'
		check (review_status in ('pending', 'reviewed', 'rejected')),
	source_key text references public.product_data_sources(key) on delete restrict,
	source_reference text,
	reviewed_by uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint ingredient_term_relationships_distinct_terms
		check (child_term_id <> parent_term_id),
	constraint ingredient_term_relationships_review_check check (
		(review_status = 'reviewed' and reviewed_at is not null)
		or review_status <> 'reviewed'
	),
	constraint ingredient_term_relationships_inheritance_check check (
		conflict_inheritance <> 'reviewed'
		or review_status = 'reviewed'
	)
);

create unique index ingredient_term_relationships_identity_idx
	on public.ingredient_term_relationships (
		child_term_id,
		parent_term_id,
		relationship_type,
		processing_state,
		jurisdiction_code
	) nulls not distinct;

create index ingredient_term_relationships_parent_idx
	on public.ingredient_term_relationships (
		parent_term_id,
		review_status,
		relationship_type
	);

create table public.product_ingredient_statements (
	id uuid primary key default gen_random_uuid(),
	shared_product_id uuid references public.shared_products(id) on delete cascade,
	shared_product_observation_id uuid
		references public.shared_product_observations(id) on delete cascade,
	shared_product_submission_id uuid
		references public.shared_product_submissions(id) on delete cascade,
	source_observation_id uuid
		references public.shared_product_observations(id) on delete restrict,
	source_field text not null
		check (source_field in ('ingredients', 'ingredientList', 'structuredIngredients')),
	extraction_method text not null
		check (extraction_method in ('raw-statement', 'reported-list', 'reported-tree')),
	language_code text,
	source_key text,
	raw_statement text,
	source_value jsonb not null,
	content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint product_ingredient_statements_exactly_one_owner check (
		num_nonnulls(
			shared_product_id,
			shared_product_observation_id,
			shared_product_submission_id
		) = 1
	),
	constraint product_ingredient_statements_observation_identity check (
		shared_product_observation_id is null
		or source_observation_id = shared_product_observation_id
	),
	constraint product_ingredient_statements_raw_check check (
		raw_statement is null or btrim(raw_statement) <> ''
	)
);

create unique index product_ingredient_statements_owner_field_idx
	on public.product_ingredient_statements (
		shared_product_id,
		shared_product_observation_id,
		shared_product_submission_id,
		source_field
	) nulls not distinct;

create index product_ingredient_statements_product_idx
	on public.product_ingredient_statements (shared_product_id, source_field)
	where shared_product_id is not null;

create index product_ingredient_statements_source_observation_idx
	on public.product_ingredient_statements (source_observation_id)
	where source_observation_id is not null;

create table public.product_ingredient_components (
	id uuid primary key default gen_random_uuid(),
	statement_id uuid not null
		references public.product_ingredient_statements(id) on delete cascade,
	parent_component_id uuid,
	ingredient_term_id uuid
		references public.ingredient_terms(id) on delete set null,
	source_path integer[] not null check (cardinality(source_path) > 0),
	source_order integer not null check (source_order >= 0),
	depth integer not null check (depth >= 0),
	source_component_id text,
	source_text text not null check (btrim(source_text) <> ''),
	normalized_text text generated always as (
		public.compatibility_normalize_text(source_text)
	) stored,
	language_code text,
	percent_exact numeric,
	percent_estimate numeric,
	percent_min numeric,
	percent_max numeric,
	processing_state text,
	vegan_status text,
	vegetarian_status text,
	source_payload jsonb not null default '{}'::jsonb
		check (jsonb_typeof(source_payload) = 'object'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint product_ingredient_components_statement_id_id_key
		unique (statement_id, id),
	constraint product_ingredient_components_parent_fkey
		foreign key (statement_id, parent_component_id)
		references public.product_ingredient_components(statement_id, id)
		on delete cascade deferrable initially deferred,
	constraint product_ingredient_components_path_depth_check
		check (depth = cardinality(source_path) - 1),
	constraint product_ingredient_components_percent_exact_check
		check (percent_exact is null or percent_exact between 0 and 100),
	constraint product_ingredient_components_percent_estimate_check
		check (percent_estimate is null or percent_estimate between 0 and 100),
	constraint product_ingredient_components_percent_min_check
		check (percent_min is null or percent_min between 0 and 100),
	constraint product_ingredient_components_percent_max_check
		check (percent_max is null or percent_max between 0 and 100),
	constraint product_ingredient_components_percent_range_check
		check (
			percent_min is null
			or percent_max is null
			or percent_min <= percent_max
		)
);

create unique index product_ingredient_components_path_idx
	on public.product_ingredient_components (statement_id, source_path);

create index product_ingredient_components_parent_idx
	on public.product_ingredient_components (statement_id, parent_component_id, source_order);

create index product_ingredient_components_term_idx
	on public.product_ingredient_components (ingredient_term_id)
	where ingredient_term_id is not null;

create trigger set_ingredient_terms_updated_at
	before update on public.ingredient_terms
	for each row execute function public.set_updated_at();

create trigger set_ingredient_term_aliases_updated_at
	before update on public.ingredient_term_aliases
	for each row execute function public.set_updated_at();

create trigger set_ingredient_term_relationships_updated_at
	before update on public.ingredient_term_relationships
	for each row execute function public.set_updated_at();

create trigger set_product_ingredient_statements_updated_at
	before update on public.product_ingredient_statements
	for each row execute function public.set_updated_at();

create trigger set_product_ingredient_components_updated_at
	before update on public.product_ingredient_components
	for each row execute function public.set_updated_at();

create or replace function public.sync_product_ingredient_evidence(
	p_shared_product_id uuid default null,
	p_shared_product_observation_id uuid default null,
	p_shared_product_submission_id uuid default null,
	p_food jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_source_field text;
	v_extraction_method text;
	v_source_value jsonb;
	v_raw_statement text;
	v_language_code text;
	v_source_key text;
	v_source_observation_id uuid;
	v_statement_id uuid;
begin
	if num_nonnulls(
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id
	) <> 1 then
		raise exception 'Ingredient evidence requires exactly one owner';
	end if;

	delete from public.product_ingredient_statements statement
	where statement.shared_product_id is not distinct from p_shared_product_id
		and statement.shared_product_observation_id is not distinct from
			p_shared_product_observation_id
		and statement.shared_product_submission_id is not distinct from
			p_shared_product_submission_id;

	if p_food is null or jsonb_typeof(p_food) <> 'object' then
		return;
	end if;

	v_raw_statement := nullif(btrim(p_food ->> 'ingredients'), '');

	if jsonb_typeof(p_food -> 'structuredIngredients') = 'array'
		and jsonb_array_length(p_food -> 'structuredIngredients') > 0 then
		v_source_field := 'structuredIngredients';
		v_extraction_method := 'reported-tree';
		v_source_value := p_food -> 'structuredIngredients';
	elsif jsonb_typeof(p_food -> 'ingredientList') = 'array'
		and jsonb_array_length(p_food -> 'ingredientList') > 0 then
		v_source_field := 'ingredientList';
		v_extraction_method := 'reported-list';
		v_source_value := p_food -> 'ingredientList';
	elsif v_raw_statement is not null then
		v_source_field := 'ingredients';
		v_extraction_method := 'raw-statement';
		v_source_value := to_jsonb(v_raw_statement);
	else
		return;
	end if;

	v_language_code := nullif(
		btrim(p_food #>> '{sourceMetadata,language}'),
		''
	);
	if v_language_code is null
		and jsonb_typeof(p_food #> '{sourceMetadata,languages}') = 'array' then
		select nullif(btrim(language.value), '')
		into v_language_code
		from jsonb_array_elements_text(
			p_food #> '{sourceMetadata,languages}'
		) with ordinality language(value, position)
		order by language.position
		limit 1;
	end if;

	v_source_key := nullif(btrim(p_food ->> 'sourceKey'), '');

	if p_shared_product_observation_id is not null then
		v_source_observation_id := p_shared_product_observation_id;
	elsif p_shared_product_id is not null then
		select provenance.observation_id
		into v_source_observation_id
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = p_shared_product_id
			and provenance.selected
			and (
				provenance.field_path = v_source_field
				or (
					v_source_field = 'ingredientList'
					and provenance.field_path = 'ingredients'
				)
			)
		order by
			case when provenance.field_path = v_source_field then 0 else 1 end,
			provenance.created_at desc,
			provenance.id
		limit 1;
	elsif p_shared_product_submission_id is not null then
		select observation.id
		into v_source_observation_id
		from public.shared_product_observations observation
		where observation.submission_id = p_shared_product_submission_id
			and observation.normalized_food is not null
		order by observation.observed_at desc, observation.id
		limit 1;
	end if;

	if v_source_key is null and v_source_observation_id is not null then
		select observation.source
		into v_source_key
		from public.shared_product_observations observation
		where observation.id = v_source_observation_id;
	end if;

	insert into public.product_ingredient_statements (
		shared_product_id,
		shared_product_observation_id,
		shared_product_submission_id,
		source_observation_id,
		source_field,
		extraction_method,
		language_code,
		source_key,
		raw_statement,
		source_value,
		content_hash
	)
	values (
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id,
		v_source_observation_id,
		v_source_field,
		v_extraction_method,
		v_language_code,
		v_source_key,
		v_raw_statement,
		v_source_value,
		encode(
			extensions.digest(
				coalesce(v_raw_statement, '') || E'\n' || v_source_value::text,
				'sha256'
			),
			'hex'
		)
	)
	returning id into v_statement_id;

	if v_extraction_method = 'reported-tree' then
		with recursive ingredient_nodes as (
			select
				gen_random_uuid() as node_id,
				null::uuid as parent_node_id,
				root.value as source_payload,
				array[(root.position - 1)::integer] as source_path,
				(root.position - 1)::integer as source_order,
				0 as depth
			from jsonb_array_elements(v_source_value)
				with ordinality root(value, position)

			union all

			select
				gen_random_uuid(),
				parent.node_id,
				child.value,
				parent.source_path || (child.position - 1)::integer,
				(child.position - 1)::integer,
				parent.depth + 1
			from ingredient_nodes parent
			cross join lateral jsonb_array_elements(
				case
					when jsonb_typeof(parent.source_payload -> 'ingredients') = 'array'
						then parent.source_payload -> 'ingredients'
					else '[]'::jsonb
				end
			) with ordinality child(value, position)
			where parent.depth < 20
		)
		insert into public.product_ingredient_components (
			id,
			statement_id,
			parent_component_id,
			source_path,
			source_order,
			depth,
			source_component_id,
			source_text,
			language_code,
			percent_exact,
			percent_estimate,
			percent_min,
			percent_max,
			processing_state,
			vegan_status,
			vegetarian_status,
			source_payload
		)
		select
			node.node_id,
			v_statement_id,
			node.parent_node_id,
			node.source_path,
			node.source_order,
			node.depth,
			nullif(btrim(node.source_payload ->> 'id'), ''),
			coalesce(
				nullif(btrim(node.source_payload ->> 'text'), ''),
				nullif(btrim(node.source_payload ->> 'id'), '')
			),
			v_language_code,
			case
				when jsonb_typeof(node.source_payload -> 'percent') = 'number'
					then (node.source_payload ->> 'percent')::numeric
			end,
			case
				when jsonb_typeof(node.source_payload -> 'percentEstimate') = 'number'
					then (node.source_payload ->> 'percentEstimate')::numeric
			end,
			case
				when jsonb_typeof(node.source_payload -> 'percentMin') = 'number'
					then (node.source_payload ->> 'percentMin')::numeric
			end,
			case
				when jsonb_typeof(node.source_payload -> 'percentMax') = 'number'
					then (node.source_payload ->> 'percentMax')::numeric
			end,
			nullif(btrim(node.source_payload ->> 'processingState'), ''),
			nullif(btrim(node.source_payload ->> 'vegan'), ''),
			nullif(btrim(node.source_payload ->> 'vegetarian'), ''),
			node.source_payload
		from ingredient_nodes node
		where coalesce(
			nullif(btrim(node.source_payload ->> 'text'), ''),
			nullif(btrim(node.source_payload ->> 'id'), '')
		) is not null;
	elsif v_extraction_method = 'reported-list' then
		insert into public.product_ingredient_components (
			statement_id,
			source_path,
			source_order,
			depth,
			source_text,
			language_code,
			source_payload
		)
		select
			v_statement_id,
			array[(item.position - 1)::integer],
			(item.position - 1)::integer,
			0,
			btrim(item.value),
			v_language_code,
			jsonb_build_object('text', btrim(item.value))
		from jsonb_array_elements_text(v_source_value)
			with ordinality item(value, position)
		where btrim(item.value) <> '';
	end if;

	update public.product_ingredient_components component
	set ingredient_term_id = (
		select alias.ingredient_term_id
		from public.ingredient_term_aliases alias
		join public.ingredient_terms term
			on term.id = alias.ingredient_term_id
			and term.review_status = 'reviewed'
		where alias.review_status = 'reviewed'
			and alias.normalized_alias = component.normalized_text
			and (
				alias.language_code is null
				or component.language_code is null
				or alias.language_code = component.language_code
			)
		order by
			case when alias.language_code = component.language_code then 0 else 1 end,
			alias.created_at,
			alias.id
		limit 1
	)
	where component.statement_id = v_statement_id;
end;
$$;

alter table public.product_compatibility_facts
	add column ingredient_component_id uuid
		references public.product_ingredient_components(id) on delete set null,
	add column match_rule_id uuid
		references public.food_compatibility_match_rules(id) on delete set null;

drop index if exists public.product_compatibility_facts_unique_evidence_idx;

create unique index product_compatibility_facts_unique_evidence_idx
	on public.product_compatibility_facts (
		shared_product_id,
		shared_product_observation_id,
		shared_product_submission_id,
		tag_id,
		fact_type,
		source_type,
		ingredient_component_id,
		match_rule_id
	) nulls not distinct;

create index product_compatibility_facts_ingredient_component_idx
	on public.product_compatibility_facts (ingredient_component_id)
	where ingredient_component_id is not null;

create index product_compatibility_facts_match_rule_idx
	on public.product_compatibility_facts (match_rule_id)
	where match_rule_id is not null;

create or replace function public.link_product_compatibility_fact_ingredient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_component_id uuid;
	v_rule_id uuid;
	v_source_text text;
begin
	new.ingredient_component_id := null;
	new.match_rule_id := null;

	if new.source_type <> 'label_ingredient_field'
		or new.source_text is null then
		return new;
	end if;

	select
		component.id,
		rule.id,
		component.source_text
	into
		v_component_id,
		v_rule_id,
		v_source_text
	from public.product_ingredient_statements statement
	join public.product_ingredient_components component
		on component.statement_id = statement.id
	join public.food_compatibility_match_rules rule
		on rule.tag_id = new.tag_id
		and rule.fact_type = new.fact_type
		and rule.source_type = new.source_type
		and rule.field_name = 'ingredients'
		and rule.enabled
	where statement.shared_product_id is not distinct from new.shared_product_id
		and statement.shared_product_observation_id is not distinct from
			new.shared_product_observation_id
		and statement.shared_product_submission_id is not distinct from
			new.shared_product_submission_id
		and public.compatibility_first_regex_match(
			component.source_text,
			rule.match_pattern
		) is not null
		and (
			rule.exclude_pattern is null
			or public.compatibility_first_regex_match(
				component.source_text,
				rule.exclude_pattern
			) is null
		)
		and (rule.source_key is null or rule.source_key = statement.source_key)
	order by rule.priority, component.source_path, rule.id
	limit 1;

	if v_component_id is not null then
		new.ingredient_component_id := v_component_id;
		new.match_rule_id := v_rule_id;
		new.source_text := v_source_text;
	end if;

	return new;
end;
$$;

create trigger link_product_compatibility_fact_ingredient
	before insert or update of
		tag_id,
		fact_type,
		source_type,
		source_text,
		shared_product_id,
		shared_product_observation_id,
		shared_product_submission_id
	on public.product_compatibility_facts
	for each row execute function public.link_product_compatibility_fact_ingredient();

alter function public.extract_product_compatibility_facts(uuid, uuid, uuid, jsonb, text)
	rename to extract_product_compatibility_facts_unlinked;

create function public.extract_product_compatibility_facts(
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
	perform public.sync_product_ingredient_evidence(
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id,
		p_food
	);
	perform public.extract_product_compatibility_facts_unlinked(
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id,
		p_food,
		p_parent_source
	);
end;
$$;

create or replace function public.refresh_shared_product_compatibility_match_facts(
	p_shared_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_product public.shared_products%rowtype;
begin
	select *
	into v_product
	from public.shared_products
	where id = p_shared_product_id;

	if v_product.id is null then
		return;
	end if;

	perform public.extract_product_compatibility_facts(
		v_product.id,
		null,
		null,
		v_product.food,
		'shared_product_metadata'
	);
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

alter table public.ingredient_terms enable row level security;
alter table public.ingredient_terms force row level security;
alter table public.ingredient_term_aliases enable row level security;
alter table public.ingredient_term_aliases force row level security;
alter table public.ingredient_term_relationships enable row level security;
alter table public.ingredient_term_relationships force row level security;
alter table public.product_ingredient_statements enable row level security;
alter table public.product_ingredient_statements force row level security;
alter table public.product_ingredient_components enable row level security;
alter table public.product_ingredient_components force row level security;

create policy "Authenticated users can read reviewed ingredient terms"
	on public.ingredient_terms
	for select
	to authenticated
	using (review_status = 'reviewed');

create policy "Authenticated users can read reviewed ingredient aliases"
	on public.ingredient_term_aliases
	for select
	to authenticated
	using (review_status = 'reviewed');

create policy "Authenticated users can read reviewed ingredient relationships"
	on public.ingredient_term_relationships
	for select
	to authenticated
	using (review_status = 'reviewed');

revoke all on table public.ingredient_terms
	from public, anon, authenticated;
revoke all on table public.ingredient_term_aliases
	from public, anon, authenticated;
revoke all on table public.ingredient_term_relationships
	from public, anon, authenticated;
revoke all on table public.product_ingredient_statements
	from public, anon, authenticated;
revoke all on table public.product_ingredient_components
	from public, anon, authenticated;

grant select on table public.ingredient_terms to authenticated;
grant select on table public.ingredient_term_aliases to authenticated;
grant select on table public.ingredient_term_relationships to authenticated;
grant all on table public.ingredient_terms to service_role;
grant all on table public.ingredient_term_aliases to service_role;
grant all on table public.ingredient_term_relationships to service_role;
grant all on table public.product_ingredient_statements to service_role;
grant all on table public.product_ingredient_components to service_role;

revoke all on function public.sync_product_ingredient_evidence(uuid, uuid, uuid, jsonb)
	from public, anon, authenticated;
revoke all on function public.link_product_compatibility_fact_ingredient()
	from public, anon, authenticated;
revoke all on function public.extract_product_compatibility_facts_unlinked(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) from public, anon, authenticated, service_role;
revoke all on function public.extract_product_compatibility_facts(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) from public, anon, authenticated;

grant execute on function public.sync_product_ingredient_evidence(
	uuid,
	uuid,
	uuid,
	jsonb
) to service_role;
grant execute on function public.extract_product_compatibility_facts(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) to service_role;

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
from public.shared_product_observations observation;

select public.extract_product_compatibility_facts(
	null,
	null,
	submission.id,
	submission.food,
	'shared_submission_metadata'
)
from public.shared_product_submissions submission;

comment on table public.ingredient_terms is
	'Review-gated canonical ingredient vocabulary. Source text never creates or approves a term automatically.';

comment on table public.ingredient_term_aliases is
	'Review-gated multilingual and source-specific names used to link reported ingredient components to canonical terms.';

comment on table public.ingredient_term_relationships is
	'Reviewed semantic parent, derivative, and processing relationships. Relationships do not inherit compatibility conflicts unless a reviewed policy explicitly permits it.';

comment on table public.product_ingredient_statements is
	'Normalized projection of an exact reported ingredient field. The original source value and raw statement remain intact, and canonical products link to selected source observations when provenance exists.';

comment on table public.product_ingredient_components is
	'Ordered relational ingredient tree preserving source paths, nesting, reported percentages, source wording, language, and optional reviewed taxonomy identity.';

comment on column public.product_compatibility_facts.ingredient_component_id is
	'The exact normalized ingredient component whose source wording matched this ingredient-derived fact.';

comment on column public.product_compatibility_facts.match_rule_id is
	'The database match rule used to extract this fact. policy_version_id records the policy version evaluated.';
