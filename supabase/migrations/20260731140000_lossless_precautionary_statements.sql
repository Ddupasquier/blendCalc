create table public.product_precautionary_statements (
	id uuid primary key default gen_random_uuid(),
	shared_product_id uuid references public.shared_products(id) on delete cascade,
	shared_product_observation_id uuid
		references public.shared_product_observations(id) on delete cascade,
	shared_product_submission_id uuid
		references public.shared_product_submissions(id) on delete cascade,
	source_observation_id uuid
		references public.shared_product_observations(id) on delete restrict,
	shared_product_revision_id uuid
		references public.shared_product_revisions(id) on delete set null,
	statement_type text not null
		check (
			statement_type in (
				'may_contain',
				'shared_equipment',
				'shared_facility',
				'other_precautionary'
			)
		),
	statement_text text not null check (btrim(statement_text) <> ''),
	normalized_allergens text[] not null default '{}'::text[],
	language_code text,
	source_field text not null check (btrim(source_field) <> ''),
	source_key text,
	source_reference text,
	label_observed_at timestamptz,
	source_payload jsonb not null default '{}'::jsonb
		check (jsonb_typeof(source_payload) = 'object'),
	content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint product_precautionary_statements_exactly_one_owner check (
		num_nonnulls(
			shared_product_id,
			shared_product_observation_id,
			shared_product_submission_id
		) = 1
	),
	constraint product_precautionary_statements_observation_identity check (
		shared_product_observation_id is null
		or source_observation_id = shared_product_observation_id
	)
);

create unique index product_precautionary_statements_owner_content_idx
	on public.product_precautionary_statements (
		shared_product_id,
		shared_product_observation_id,
		shared_product_submission_id,
		content_hash
	) nulls not distinct;

create index product_precautionary_statements_product_idx
	on public.product_precautionary_statements (
		shared_product_id,
		statement_type,
		label_observed_at
	)
	where shared_product_id is not null;

create index product_precautionary_statements_observation_idx
	on public.product_precautionary_statements (source_observation_id)
	where source_observation_id is not null;

create trigger set_product_precautionary_statements_updated_at
	before update on public.product_precautionary_statements
	for each row execute function public.set_updated_at();

create or replace function public.sync_product_precautionary_statements(
	p_shared_product_id uuid default null,
	p_shared_product_observation_id uuid default null,
	p_shared_product_submission_id uuid default null,
	p_food jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
	v_statement jsonb;
	v_statement_type text;
	v_statement_text text;
	v_source_observation_id uuid;
	v_revision_id uuid;
	v_label_observed_at timestamptz;
	v_normalized_allergens text[];
begin
	if num_nonnulls(
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id
	) <> 1 then
		raise exception 'Exactly one precautionary statement owner is required.';
	end if;

	delete from public.product_precautionary_statements
	where shared_product_id is not distinct from p_shared_product_id
		and shared_product_observation_id is not distinct from
			p_shared_product_observation_id
		and shared_product_submission_id is not distinct from
			p_shared_product_submission_id;

	if p_food is null
		or jsonb_typeof(p_food) <> 'object'
		or jsonb_typeof(p_food -> 'precautionaryStatements') <> 'array' then
		return;
	end if;

	if p_shared_product_observation_id is not null then
		v_source_observation_id := p_shared_product_observation_id;
		select observation.observed_at
		into v_label_observed_at
		from public.shared_product_observations observation
		where observation.id = p_shared_product_observation_id;
	elsif p_shared_product_id is not null then
		select provenance.observation_id
		into v_source_observation_id
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = p_shared_product_id
			and provenance.selected
			and provenance.field_path in ('precautionaryStatements', 'traces')
		order by
			case when provenance.field_path = 'precautionaryStatements' then 0 else 1 end,
			provenance.created_at desc
		limit 1;

		select revision.id, revision.label_observed_at
		into v_revision_id, v_label_observed_at
		from public.shared_product_revisions revision
		where revision.shared_product_id = p_shared_product_id
		order by revision.revision_number desc
		limit 1;
	end if;

	for v_statement in
		select statement.value
		from jsonb_array_elements(p_food -> 'precautionaryStatements') statement(value)
		where jsonb_typeof(statement.value) = 'object'
	loop
		v_statement_type := nullif(btrim(v_statement ->> 'type'), '');
		v_statement_text := nullif(btrim(v_statement ->> 'text'), '');
		if v_statement_type not in (
			'may_contain',
			'shared_equipment',
			'shared_facility',
			'other_precautionary'
		) or v_statement_text is null then
			continue;
		end if;

		select coalesce(array_agg(allergen.normalized order by allergen.normalized), '{}')
		into v_normalized_allergens
		from (
			select distinct public.compatibility_normalize_text(value) as normalized
			from jsonb_array_elements_text(
				case
					when jsonb_typeof(v_statement -> 'allergens') = 'array'
						then v_statement -> 'allergens'
					else '[]'::jsonb
				end
			) values(value)
			where btrim(value) <> ''
		) allergen
		where allergen.normalized <> '';

		insert into public.product_precautionary_statements (
			shared_product_id,
			shared_product_observation_id,
			shared_product_submission_id,
			source_observation_id,
			shared_product_revision_id,
			statement_type,
			statement_text,
			normalized_allergens,
			language_code,
			source_field,
			source_key,
			source_reference,
			label_observed_at,
			source_payload,
			content_hash
		)
		values (
			p_shared_product_id,
			p_shared_product_observation_id,
			p_shared_product_submission_id,
			v_source_observation_id,
			v_revision_id,
			v_statement_type,
			v_statement_text,
			v_normalized_allergens,
			nullif(btrim(v_statement ->> 'languageCode'), ''),
			coalesce(nullif(btrim(v_statement ->> 'sourceField'), ''), 'precautionaryStatements'),
			coalesce(
				nullif(btrim(v_statement ->> 'sourceKey'), ''),
				nullif(btrim(p_food ->> 'sourceKey'), '')
			),
			nullif(btrim(v_statement ->> 'sourceReference'), ''),
			v_label_observed_at,
			v_statement,
			encode(
				extensions.digest(
					convert_to(
						concat_ws(
							'|',
							v_statement_type,
							v_statement_text,
							coalesce(nullif(btrim(v_statement ->> 'languageCode'), ''), ''),
							coalesce(nullif(btrim(v_statement ->> 'sourceField'), ''), ''),
							array_to_string(v_normalized_allergens, ',')
						),
						'UTF8'
					),
					'sha256'
				),
				'hex'
			)
		)
		on conflict do nothing;
	end loop;
end;
$$;

alter table public.product_compatibility_facts
	add column precautionary_statement_id uuid
		references public.product_precautionary_statements(id) on delete cascade;

drop index public.product_compatibility_facts_unique_evidence_idx;

create unique index product_compatibility_facts_unique_evidence_idx
	on public.product_compatibility_facts (
		shared_product_id,
		shared_product_observation_id,
		shared_product_submission_id,
		tag_id,
		fact_type,
		source_type,
		ingredient_component_id,
		precautionary_statement_id,
		match_rule_id
	) nulls not distinct;

create index product_compatibility_facts_precautionary_statement_idx
	on public.product_compatibility_facts (precautionary_statement_id)
	where precautionary_statement_id is not null;

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
	if new.source_type <> 'label_ingredient_field'
		or new.source_text is null then
		new.ingredient_component_id := null;
		return new;
	end if;

	new.ingredient_component_id := null;
	new.precautionary_statement_id := null;
	new.match_rule_id := null;

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
	join public.food_compatibility_policy_match_rules rule
		on rule.tag_id = new.tag_id
		and rule.fact_type = new.fact_type
		and rule.source_type = new.source_type
		and rule.field_name = 'ingredients'
		and rule.enabled
		and rule.policy_version_id = new.policy_version_id
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

alter function public.extract_product_compatibility_facts(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
)
	rename to extract_product_compatibility_facts_base;

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
declare
	v_active_policy_id uuid;
begin
	perform public.extract_product_compatibility_facts_base(
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id,
		p_food,
		p_parent_source
	);

	perform public.sync_product_precautionary_statements(
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id,
		p_food
	);

	if exists (
		select 1
		from public.product_precautionary_statements statement
		where statement.shared_product_id is not distinct from p_shared_product_id
			and statement.shared_product_observation_id is not distinct from
				p_shared_product_observation_id
			and statement.shared_product_submission_id is not distinct from
				p_shared_product_submission_id
	) then
		delete from public.product_compatibility_facts fact
		where fact.source_type = 'label_trace_field'
			and fact.shared_product_id is not distinct from p_shared_product_id
			and fact.shared_product_observation_id is not distinct from
				p_shared_product_observation_id
			and fact.shared_product_submission_id is not distinct from
				p_shared_product_submission_id;

		v_active_policy_id := public.active_food_compatibility_policy_version_id();

		insert into public.product_compatibility_facts (
			shared_product_id,
			shared_product_observation_id,
			shared_product_submission_id,
			tag_id,
			fact_type,
			source_type,
			source_text,
			confidence,
			precautionary_statement_id,
			match_rule_id,
			policy_version_id
		)
		select distinct on (statement.id, rule.tag_id)
			p_shared_product_id,
			p_shared_product_observation_id,
			p_shared_product_submission_id,
			rule.tag_id,
			'may_contain',
			'label_trace_field',
			statement.statement_text,
			'confirmed',
			statement.id,
			rule.id,
			v_active_policy_id
		from public.product_precautionary_statements statement
		cross join lateral unnest(statement.normalized_allergens) allergen(value)
		join public.food_compatibility_policy_match_rules rule
			on rule.policy_version_id = v_active_policy_id
			and rule.enabled
			and rule.field_name = 'traces'
			and rule.source_type = 'label_trace_field'
			and rule.fact_type = 'may_contain'
			and public.compatibility_first_regex_match(
				allergen.value,
				rule.match_pattern
			) is not null
			and (
				rule.exclude_pattern is null
				or public.compatibility_first_regex_match(
					allergen.value,
					rule.exclude_pattern
				) is null
			)
			and (rule.source_key is null or rule.source_key = statement.source_key)
		where statement.shared_product_id is not distinct from p_shared_product_id
			and statement.shared_product_observation_id is not distinct from
				p_shared_product_observation_id
			and statement.shared_product_submission_id is not distinct from
				p_shared_product_submission_id
		order by statement.id, rule.tag_id, rule.priority, rule.id
		on conflict do nothing;
	end if;

	if p_shared_product_id is not null then
		perform public.rebuild_shared_product_compatibility_summary(p_shared_product_id);
	end if;
end;
$$;

create or replace function public.attach_precautionary_statements_to_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	update public.product_precautionary_statements
	set
		shared_product_revision_id = new.id,
		label_observed_at = new.label_observed_at
	where shared_product_id = new.shared_product_id;
	return new;
end;
$$;

create trigger attach_precautionary_statements_to_revision
	after insert on public.shared_product_revisions
	for each row execute function public.attach_precautionary_statements_to_revision();

alter table public.product_precautionary_statements enable row level security;
alter table public.product_precautionary_statements force row level security;

create policy "Users can read active catalog precautionary statements"
	on public.product_precautionary_statements
	for select
	to anon, authenticated
	using (
		shared_product_id is not null
		and exists (
			select 1
			from public.shared_products product
			where product.id = shared_product_id
				and product.status = 'active'
		)
	);

create policy "Service role manages product precautionary statements"
	on public.product_precautionary_statements
	for all
	to service_role
	using (true)
	with check (true);

revoke all on table public.product_precautionary_statements from public;
grant select on table public.product_precautionary_statements to anon, authenticated;
grant all on table public.product_precautionary_statements to service_role;

revoke all on function public.sync_product_precautionary_statements(
	uuid,
	uuid,
	uuid,
	jsonb
) from public;
revoke all on function public.extract_product_compatibility_facts_base(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) from public;
revoke all on function public.extract_product_compatibility_facts(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) from public;

grant execute on function public.sync_product_precautionary_statements(
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
