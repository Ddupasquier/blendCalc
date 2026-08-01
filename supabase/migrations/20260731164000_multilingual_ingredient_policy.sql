create extension if not exists unaccent with schema extensions;

create or replace function public.compatibility_normalize_text(p_value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
	select trim(
		regexp_replace(
			extensions.unaccent(
				replace(
					replace(lower(coalesce(p_value, '')), 'œ', 'oe'),
					'æ',
					'ae'
				)
			),
			'[^a-z0-9]+',
			' ',
			'g'
		)
	);
$$;

alter table public.food_compatibility_policy_exemptions
	add column threshold_value numeric,
	add column threshold_unit text,
	add column product_context jsonb not null default '{}'::jsonb,
	add constraint food_compatibility_policy_exemptions_threshold_check check (
		(threshold_value is null and threshold_unit is null)
		or (
			threshold_value is not null
			and threshold_value >= 0
			and nullif(btrim(threshold_unit), '') is not null
		)
	),
	add constraint food_compatibility_policy_exemptions_product_context_check
		check (jsonb_typeof(product_context) = 'object');

create or replace function public.inherit_food_compatibility_exemption_conditions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_source record;
begin
	if new.threshold_value is not null
		or new.threshold_unit is not null
		or new.product_context <> '{}'::jsonb then
		return new;
	end if;

	select
		exemption.threshold_value,
		exemption.threshold_unit,
		exemption.product_context
	into v_source
	from public.food_compatibility_policy_exemptions exemption
	join public.food_compatibility_policy_versions version
		on version.id = exemption.policy_version_id
		and version.status = 'active'
	where exemption.jurisdiction_code = new.jurisdiction_code
		and exemption.ingredient_term_id is not distinct from new.ingredient_term_id
		and exemption.parent_term_id is not distinct from new.parent_term_id
		and exemption.fact_tag_id is not distinct from new.fact_tag_id
		and exemption.processing_state is not distinct from new.processing_state
		and exemption.exemption_type = new.exemption_type
	order by version.version_number desc
	limit 1;

	if found then
		new.threshold_value := v_source.threshold_value;
		new.threshold_unit := v_source.threshold_unit;
		new.product_context := v_source.product_context;
	end if;
	return new;
end;
$$;

create trigger inherit_food_compatibility_exemption_conditions
	before insert on public.food_compatibility_policy_exemptions
	for each row execute function
		public.inherit_food_compatibility_exemption_conditions();

create or replace function public.refresh_food_compatibility_preference_mapping_bundle(
	p_policy_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_mapping_snapshot jsonb;
	v_exemption_snapshot jsonb;
	v_bundle_content_hash text;
	v_prior_bundle_write text;
begin
	select coalesce(jsonb_agg(
		jsonb_build_object(
			'id', mapping.id,
			'ingredientTermId', mapping.ingredient_term_id,
			'preferenceTagId', mapping.preference_tag_id,
			'preferenceRuleType', mapping.preference_rule_type,
			'sourceReference', mapping.source_reference,
			'reviewedAt', mapping.reviewed_at
		)
		order by mapping.preference_rule_type, mapping.ingredient_term_id, mapping.id
	), '[]'::jsonb)
	into v_mapping_snapshot
	from public.food_compatibility_policy_preference_term_mappings mapping
	where mapping.policy_version_id = p_policy_version_id;

	select coalesce(jsonb_agg(
		jsonb_build_object(
			'jurisdictionCode', exemption.jurisdiction_code,
			'ingredientTermId', exemption.ingredient_term_id,
			'parentTermId', exemption.parent_term_id,
			'factTagId', exemption.fact_tag_id,
			'processingState', exemption.processing_state,
			'exemptionType', exemption.exemption_type,
			'thresholdValue', exemption.threshold_value,
			'thresholdUnit', exemption.threshold_unit,
			'productContext', exemption.product_context,
			'warningBehavior', exemption.warning_behavior,
			'sourceReference', exemption.source_reference,
			'reviewedAt', exemption.reviewed_at
		)
		order by exemption.jurisdiction_code, exemption.id
	), '[]'::jsonb)
	into v_exemption_snapshot
	from public.food_compatibility_policy_exemptions exemption
	where exemption.policy_version_id = p_policy_version_id;

	select encode(
		extensions.digest(
			convert_to(
				concat_ws(
					'|',
					version.match_rule_snapshot::text,
					version.conflict_rule_snapshot::text,
					version.alias_snapshot::text,
					version.relationship_snapshot::text,
					v_exemption_snapshot::text,
					version.regional_profile_snapshot::text,
					v_mapping_snapshot::text
				),
				'UTF8'
			),
			'sha256'
		),
		'hex'
	)
	into v_bundle_content_hash
	from public.food_compatibility_policy_versions version
	where version.id = p_policy_version_id;

	if v_bundle_content_hash is null then
		raise exception 'Unknown compatibility policy version.';
	end if;

	v_prior_bundle_write := current_setting('blendcalc.policy_bundle_write', true);
	perform set_config('blendcalc.policy_bundle_write', 'on', true);
	update public.food_compatibility_policy_versions
	set
		preference_mapping_snapshot = v_mapping_snapshot,
		exemption_snapshot = v_exemption_snapshot,
		bundle_content_hash = v_bundle_content_hash,
		updated_at = now()
	where id = p_policy_version_id;
	perform set_config(
		'blendcalc.policy_bundle_write',
		coalesce(v_prior_bundle_write, ''),
		true
	);
end;
$$;

create or replace function public.compatibility_normalize_label_value(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
	select public.compatibility_normalize_text(
		regexp_replace(
			coalesce(p_value, ''),
			'^[a-z]{2,3}(?:-[A-Z]{2})?:',
			'',
			'i'
		)
	);
$$;

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

	if new.ingredient_component_id is not null and new.match_rule_id is null then
		if exists (
			select 1
			from public.product_ingredient_components component
			join public.food_compatibility_policy_preference_term_mappings mapping
				on mapping.ingredient_term_id = component.ingredient_term_id
				and mapping.preference_tag_id = new.tag_id
				and mapping.preference_rule_type = 'allergen'
				and mapping.policy_version_id = new.policy_version_id
			where component.id = new.ingredient_component_id
		) then
			new.precautionary_statement_id := null;
			return new;
		end if;
		raise exception 'Ingredient compatibility fact requires a reviewed policy mapping.';
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
	rename to extract_product_compatibility_facts_pre_multilingual;

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
	v_language_code text;
begin
	delete from public.product_compatibility_facts fact
	where fact.shared_product_id is not distinct from p_shared_product_id
		and fact.shared_product_observation_id is not distinct from
			p_shared_product_observation_id
		and fact.shared_product_submission_id is not distinct from
			p_shared_product_submission_id
		and fact.source_type = 'label_ingredient_field'
		and fact.ingredient_component_id is not null
		and fact.match_rule_id is null;

	perform public.extract_product_compatibility_facts_pre_multilingual(
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id,
		p_food,
		p_parent_source
	);

	v_active_policy_id := public.active_food_compatibility_policy_version_id();
	v_language_code := lower(nullif(btrim(p_food #>> '{sourceMetadata,language}'), ''));
	if v_language_code is not null then
		v_language_code := split_part(v_language_code, '-', 1);
	end if;

	update public.product_ingredient_components component
	set ingredient_term_id = (
		select alias.ingredient_term_id
		from public.food_compatibility_policy_ingredient_aliases alias
		join public.ingredient_terms term
			on term.id = alias.ingredient_term_id
			and term.review_status = 'reviewed'
		where alias.policy_version_id = v_active_policy_id
			and alias.review_status = 'reviewed'
			and concat(' ', component.normalized_text, ' ') like
				concat('% ', alias.normalized_alias, ' %')
			and (
				alias.language_code is null
				or component.language_code is null
				or split_part(lower(component.language_code), '-', 1) =
					split_part(lower(alias.language_code), '-', 1)
			)
		order by length(alias.normalized_alias) desc, alias.id
		limit 1
	)
	from public.product_ingredient_statements statement
	where component.statement_id = statement.id
		and statement.shared_product_id is not distinct from p_shared_product_id
		and statement.shared_product_observation_id is not distinct from
			p_shared_product_observation_id
		and statement.shared_product_submission_id is not distinct from
			p_shared_product_submission_id
		and component.ingredient_term_id is null;

	insert into public.product_compatibility_facts (
		shared_product_id,
		shared_product_observation_id,
		shared_product_submission_id,
		tag_id,
		fact_type,
		source_type,
		source_text,
		confidence,
		ingredient_component_id,
		match_rule_id,
		policy_version_id
	)
	select distinct
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id,
		mapping.preference_tag_id,
		'ingredient_present',
		'label_ingredient_field',
		component.source_text,
		'confirmed',
		component.id,
		null::uuid,
		v_active_policy_id
	from public.product_ingredient_statements statement
	join public.product_ingredient_components component
		on component.statement_id = statement.id
	join public.food_compatibility_policy_preference_term_mappings mapping
		on mapping.ingredient_term_id = component.ingredient_term_id
		and mapping.policy_version_id = v_active_policy_id
		and mapping.preference_rule_type = 'allergen'
	where statement.shared_product_id is not distinct from p_shared_product_id
		and statement.shared_product_observation_id is not distinct from
			p_shared_product_observation_id
		and statement.shared_product_submission_id is not distinct from
			p_shared_product_submission_id
	on conflict do nothing;

	with disclosure_values as (
		select
			value,
			'contains'::text as fact_type,
			'label_allergen_field'::text as source_type
		from jsonb_array_elements_text(
			case when jsonb_typeof(p_food -> 'allergens') = 'array'
				then p_food -> 'allergens'
				else '[]'::jsonb
			end
		) item(value)
		union all
		select
			value,
			'may_contain',
			'label_trace_field'
		from jsonb_array_elements_text(
			case when jsonb_typeof(p_food -> 'traces') = 'array'
				then p_food -> 'traces'
				else '[]'::jsonb
			end
		) item(value)
	), resolved_values as (
		select distinct
			disclosure.value,
			disclosure.fact_type,
			disclosure.source_type,
			mapping.preference_tag_id
		from disclosure_values disclosure
		join public.food_compatibility_policy_ingredient_aliases alias
			on alias.policy_version_id = v_active_policy_id
			and alias.review_status = 'reviewed'
			and alias.normalized_alias =
				public.compatibility_normalize_label_value(disclosure.value)
			and (
				alias.language_code is null
				or v_language_code is null
				or split_part(lower(alias.language_code), '-', 1) = v_language_code
			)
		join public.food_compatibility_policy_preference_term_mappings mapping
			on mapping.policy_version_id = v_active_policy_id
			and mapping.ingredient_term_id = alias.ingredient_term_id
			and mapping.preference_rule_type = 'allergen'
	)
	insert into public.product_compatibility_facts (
		shared_product_id,
		shared_product_observation_id,
		shared_product_submission_id,
		tag_id,
		fact_type,
		source_type,
		source_text,
		confidence,
		policy_version_id
	)
	select
		p_shared_product_id,
		p_shared_product_observation_id,
		p_shared_product_submission_id,
		resolved.preference_tag_id,
		resolved.fact_type,
		resolved.source_type,
		resolved.value,
		'confirmed',
		v_active_policy_id
	from resolved_values resolved
	on conflict do nothing;

	if p_shared_product_id is not null then
		perform public.rebuild_shared_product_compatibility_summary(p_shared_product_id);
	end if;
end;
$$;

revoke all on function public.extract_product_compatibility_facts_pre_multilingual(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) from public, anon, authenticated;
revoke all on function public.extract_product_compatibility_facts(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) from public, anon, authenticated;
grant execute on function public.extract_product_compatibility_facts(
	uuid,
	uuid,
	uuid,
	jsonb,
	text
) to service_role;

do $$
declare
	v_draft_policy_id uuid;
	v_reviewed_at timestamptz := '2026-07-31T16:40:00Z';
	v_eu_source text :=
		'https://eur-lex.europa.eu/legal-content/en/ALL/?uri=CELEX:02011R1169-20250401';
	v_eu_es_source text :=
		'https://eur-lex.europa.eu/legal-content/es/ALL/?uri=CELEX:02011R1169-20250401';
	v_ca_fr_source text :=
		'https://inspection.canada.ca/fr/etiquetage-aliment/etiquetage/consommateurs/allergenes';
	v_au_source text :=
		'https://www.foodstandards.gov.au/consumer/foodallergies/Allergen-labelling-exemptions';
begin
	select public.create_food_compatibility_policy_draft(
		2,
		'Reviewed English, French, and Spanish ingredient terminology with versioned EU and Australia/New Zealand exemption context.',
		jsonb_build_array(v_eu_source, v_eu_es_source, v_ca_fr_source, v_au_source),
		v_reviewed_at,
		v_reviewed_at
	)
	into v_draft_policy_id;

	insert into public.ingredient_terms (
		canonical_key,
		display_name,
		default_language_code,
		review_status,
		source_reference,
		reviewed_at
	)
	select
		term.canonical_key,
		term.display_name,
		'en',
		'reviewed',
		v_eu_source,
		v_reviewed_at
	from (values
		('milk', 'Milk'),
		('egg', 'Egg'),
		('peanut', 'Peanut'),
		('soy', 'Soy'),
		('wheat', 'Wheat'),
		('gluten-cereal', 'Gluten-containing cereal'),
		('fish', 'Fish'),
		('crustacean', 'Crustacean'),
		('mollusc', 'Mollusc'),
		('sesame', 'Sesame'),
		('mustard', 'Mustard'),
		('celery', 'Celery'),
		('lupin', 'Lupin'),
		('sulfite', 'Sulfite'),
		('tree-nut', 'Tree nut'),
		('barley', 'Barley'),
		('rye', 'Rye'),
		('oat', 'Oat'),
		('spelt', 'Spelt'),
		('almond', 'Almond'),
		('hazelnut', 'Hazelnut'),
		('walnut', 'Walnut'),
		('cashew', 'Cashew'),
		('pecan', 'Pecan'),
		('brazil-nut', 'Brazil nut'),
		('pistachio', 'Pistachio'),
		('macadamia', 'Macadamia'),
		('fully-refined-soybean-oil', 'Fully refined soybean oil'),
		('wheat-glucose-syrup', 'Wheat-based glucose syrup'),
		('soy-tocopherol', 'Soy-derived tocopherol'),
		('soy-phytosterol', 'Soy-derived phytosterol'),
		('wheat-distillate', 'Distillate derived from wheat'),
		('whey-distillate', 'Distillate derived from whey'),
		('fish-gelatin', 'Fish gelatin')
	) as term(canonical_key, display_name)
	on conflict (canonical_key) do update
	set
		display_name = excluded.display_name,
		default_language_code = excluded.default_language_code,
		review_status = excluded.review_status,
		source_reference = excluded.source_reference,
		reviewed_at = excluded.reviewed_at;

	insert into public.food_compatibility_policy_ingredient_aliases (
		policy_version_id,
		ingredient_term_id,
		alias,
		language_code,
		alias_type,
		review_status,
		source_reference,
		reviewed_at
	)
	select
		v_draft_policy_id,
		term.id,
		alias.alias,
		alias.language_code,
		case when alias.language_code = 'en' then 'common' else 'regional' end,
		'reviewed',
		case alias.language_code
			when 'fr' then v_ca_fr_source
			when 'es' then v_eu_es_source
			else v_eu_source
		end,
		v_reviewed_at
	from (values
		('milk', 'milk', 'en'), ('milk', 'lait', 'fr'), ('milk', 'leche', 'es'),
		('egg', 'egg', 'en'), ('egg', 'eggs', 'en'), ('egg', 'œuf', 'fr'), ('egg', 'œufs', 'fr'), ('egg', 'huevo', 'es'), ('egg', 'huevos', 'es'),
		('peanut', 'peanut', 'en'), ('peanut', 'peanuts', 'en'), ('peanut', 'arachide', 'fr'), ('peanut', 'arachides', 'fr'), ('peanut', 'cacahuete', 'es'), ('peanut', 'cacahuetes', 'es'),
		('soy', 'soy', 'en'), ('soy', 'soybean', 'en'), ('soy', 'soybeans', 'en'), ('soy', 'soja', 'fr'), ('soy', 'soja', 'es'),
		('wheat', 'wheat', 'en'), ('wheat', 'blé', 'fr'), ('wheat', 'trigo', 'es'),
		('gluten-cereal', 'gluten', 'en'), ('gluten-cereal', 'gluten', 'fr'), ('gluten-cereal', 'gluten', 'es'),
		('fish', 'fish', 'en'), ('fish', 'poisson', 'fr'), ('fish', 'poissons', 'fr'), ('fish', 'pescado', 'es'), ('fish', 'pescados', 'es'),
		('crustacean', 'crustacean', 'en'), ('crustacean', 'crustaceans', 'en'), ('crustacean', 'crustacé', 'fr'), ('crustacean', 'crustacés', 'fr'), ('crustacean', 'crustáceo', 'es'), ('crustacean', 'crustáceos', 'es'),
		('mollusc', 'mollusc', 'en'), ('mollusc', 'molluscs', 'en'), ('mollusc', 'mollusque', 'fr'), ('mollusc', 'mollusques', 'fr'), ('mollusc', 'molusco', 'es'), ('mollusc', 'moluscos', 'es'),
		('sesame', 'sesame', 'en'), ('sesame', 'sesame seeds', 'en'), ('sesame', 'sésame', 'fr'), ('sesame', 'graines de sésame', 'fr'), ('sesame', 'sésamo', 'es'), ('sesame', 'semillas de sésamo', 'es'),
		('mustard', 'mustard', 'en'), ('mustard', 'moutarde', 'fr'), ('mustard', 'mostaza', 'es'),
		('celery', 'celery', 'en'), ('celery', 'céleri', 'fr'), ('celery', 'apio', 'es'),
		('lupin', 'lupin', 'en'), ('lupin', 'lupin', 'fr'), ('lupin', 'altramuz', 'es'),
		('sulfite', 'sulfite', 'en'), ('sulfite', 'sulfites', 'en'), ('sulfite', 'sulphite', 'en'), ('sulfite', 'sulphites', 'en'), ('sulfite', 'sulfites', 'fr'), ('sulfite', 'sulfitos', 'es'), ('sulfite', 'dióxido de azufre', 'es'),
		('tree-nut', 'tree nut', 'en'), ('tree-nut', 'tree nuts', 'en'), ('tree-nut', 'noix', 'fr'), ('tree-nut', 'frutos de cáscara', 'es'),
		('barley', 'barley', 'en'), ('barley', 'orge', 'fr'), ('barley', 'cebada', 'es'),
		('rye', 'rye', 'en'), ('rye', 'seigle', 'fr'), ('rye', 'centeno', 'es'),
		('oat', 'oat', 'en'), ('oat', 'oats', 'en'), ('oat', 'avoine', 'fr'), ('oat', 'avena', 'es'),
		('spelt', 'spelt', 'en'), ('spelt', 'épeautre', 'fr'), ('spelt', 'espelta', 'es'),
		('almond', 'almond', 'en'), ('almond', 'almonds', 'en'), ('almond', 'amande', 'fr'), ('almond', 'amandes', 'fr'), ('almond', 'almendra', 'es'), ('almond', 'almendras', 'es'),
		('hazelnut', 'hazelnut', 'en'), ('hazelnut', 'hazelnuts', 'en'), ('hazelnut', 'noisette', 'fr'), ('hazelnut', 'noisettes', 'fr'), ('hazelnut', 'avellana', 'es'), ('hazelnut', 'avellanas', 'es'),
		('walnut', 'walnut', 'en'), ('walnut', 'walnuts', 'en'), ('walnut', 'noix', 'fr'), ('walnut', 'nuez', 'es'), ('walnut', 'nueces', 'es'),
		('cashew', 'cashew', 'en'), ('cashew', 'cashews', 'en'), ('cashew', 'noix de cajou', 'fr'), ('cashew', 'anacardo', 'es'), ('cashew', 'anacardos', 'es'),
		('pecan', 'pecan', 'en'), ('pecan', 'pecans', 'en'), ('pecan', 'noix de pécan', 'fr'), ('pecan', 'pacana', 'es'), ('pecan', 'pacanas', 'es'),
		('brazil-nut', 'brazil nut', 'en'), ('brazil-nut', 'brazil nuts', 'en'), ('brazil-nut', 'noix du Brésil', 'fr'), ('brazil-nut', 'nuez de Brasil', 'es'), ('brazil-nut', 'nueces de Brasil', 'es'),
		('pistachio', 'pistachio', 'en'), ('pistachio', 'pistachios', 'en'), ('pistachio', 'pistache', 'fr'), ('pistachio', 'pistaches', 'fr'), ('pistachio', 'pistacho', 'es'), ('pistachio', 'pistachos', 'es'),
		('macadamia', 'macadamia', 'en'), ('macadamia', 'macadamia nuts', 'en'), ('macadamia', 'noix de macadamia', 'fr'), ('macadamia', 'nueces de macadamia', 'es'),
		('fully-refined-soybean-oil', 'fully refined soybean oil', 'en'), ('wheat-glucose-syrup', 'wheat based glucose syrup', 'en'), ('wheat-glucose-syrup', 'wheat glucose syrup', 'en'),
		('soy-tocopherol', 'soy tocopherol', 'en'), ('soy-tocopherol', 'soy derived tocopherol', 'en'), ('soy-phytosterol', 'soy phytosterol', 'en'), ('soy-phytosterol', 'soy derived phytosterol', 'en'),
		('wheat-distillate', 'distillate derived from wheat', 'en'), ('whey-distillate', 'distillate derived from whey', 'en'), ('fish-gelatin', 'fish gelatin', 'en'), ('fish-gelatin', 'fish gelatine', 'en'), ('fish-gelatin', 'isinglass', 'en')
	) as alias(canonical_key, alias, language_code)
	join public.ingredient_terms term
		on term.canonical_key = alias.canonical_key
	on conflict do nothing;

	insert into public.food_compatibility_policy_preference_term_mappings (
		policy_version_id,
		ingredient_term_id,
		preference_tag_id,
		preference_rule_type,
		source_reference,
		reviewed_at
	)
	select
		v_draft_policy_id,
		term.id,
		tag.id,
		'allergen',
		v_eu_source,
		v_reviewed_at
	from (values
		('milk', 'milk'), ('egg', 'egg'), ('peanut', 'peanut'),
		('soy', 'soy'), ('wheat', 'wheat'), ('gluten-cereal', 'gluten'),
		('fish', 'fish'), ('crustacean', 'shellfish'), ('mollusc', 'mollusc'),
		('sesame', 'sesame'), ('mustard', 'mustard'), ('celery', 'celery'),
		('lupin', 'lupin'), ('sulfite', 'sulfite'), ('tree-nut', 'tree-nut'),
		('barley', 'gluten'), ('rye', 'gluten'), ('oat', 'gluten'),
		('spelt', 'wheat'), ('almond', 'tree-nut'), ('hazelnut', 'tree-nut'),
		('walnut', 'tree-nut'), ('cashew', 'tree-nut'), ('pecan', 'tree-nut'),
		('brazil-nut', 'tree-nut'), ('pistachio', 'tree-nut'),
		('macadamia', 'tree-nut'), ('fully-refined-soybean-oil', 'soy'),
		('wheat-glucose-syrup', 'wheat'), ('soy-tocopherol', 'soy'),
		('soy-phytosterol', 'soy'), ('wheat-distillate', 'wheat'),
		('whey-distillate', 'milk'), ('fish-gelatin', 'fish')
	) as mapping(canonical_key, tag_slug)
	join public.ingredient_terms term
		on term.canonical_key = mapping.canonical_key
	join public.compatibility_tags tag
		on tag.slug = mapping.tag_slug
	on conflict do nothing;

	insert into public.food_compatibility_policy_ingredient_relationships (
		policy_version_id,
		child_term_id,
		parent_term_id,
		relationship_type,
		processing_state,
		jurisdiction_code,
		conflict_inheritance,
		review_status,
		source_reference,
		reviewed_at
	)
	select
		v_draft_policy_id,
		child.id,
		parent.id,
		relationship.relationship_type,
		relationship.processing_state,
		relationship.jurisdiction_code,
		case when relationship.processing_state is null then 'reviewed' else 'none' end,
		'reviewed',
		case when relationship.jurisdiction_code = 'AU-NZ' then v_au_source else v_eu_source end,
		v_reviewed_at
	from (values
		('barley', 'gluten-cereal', 'is-a', null::text, null::text),
		('rye', 'gluten-cereal', 'is-a', null, null),
		('oat', 'gluten-cereal', 'is-a', null, null),
		('spelt', 'wheat', 'is-a', null, null),
		('almond', 'tree-nut', 'is-a', null, null),
		('hazelnut', 'tree-nut', 'is-a', null, null),
		('walnut', 'tree-nut', 'is-a', null, null),
		('cashew', 'tree-nut', 'is-a', null, null),
		('pecan', 'tree-nut', 'is-a', null, null),
		('brazil-nut', 'tree-nut', 'is-a', null, null),
		('pistachio', 'tree-nut', 'is-a', null, null),
		('macadamia', 'tree-nut', 'is-a', null, null),
		('fully-refined-soybean-oil', 'soy', 'processed-from', 'fully-refined', 'EU'),
		('wheat-glucose-syrup', 'wheat', 'processed-from', 'glucose-syrup', 'EU'),
		('soy-tocopherol', 'soy', 'derived-from', 'tocopherol', 'EU'),
		('soy-phytosterol', 'soy', 'derived-from', 'phytosterol', 'EU'),
		('wheat-distillate', 'wheat', 'processed-from', 'distillate', 'EU'),
		('whey-distillate', 'milk', 'processed-from', 'distillate', 'EU'),
		('fish-gelatin', 'fish', 'processed-from', 'gelatin', 'EU')
	) as relationship(
		child_key,
		parent_key,
		relationship_type,
		processing_state,
		jurisdiction_code
	)
	join public.ingredient_terms child on child.canonical_key = relationship.child_key
	join public.ingredient_terms parent on parent.canonical_key = relationship.parent_key
	on conflict do nothing;

	insert into public.food_compatibility_policy_exemptions (
		policy_version_id,
		jurisdiction_code,
		ingredient_term_id,
		parent_term_id,
		fact_tag_id,
		processing_state,
		exemption_type,
		threshold_value,
		threshold_unit,
		product_context,
		warning_behavior,
		source_reference,
		reviewed_at
	)
	select
		v_draft_policy_id,
		exemption.jurisdiction_code,
		term.id,
		parent.id,
		tag.id,
		exemption.processing_state,
		exemption.exemption_type,
		exemption.threshold_value,
		exemption.threshold_unit,
		exemption.product_context,
		'context-only',
		case when exemption.jurisdiction_code = 'AU-NZ' then v_au_source else v_eu_source end,
		v_reviewed_at
	from (values
		('EU', 'fully-refined-soybean-oil', 'soy', 'soy', 'fully-refined', 'processing', null::numeric, null::text, '{}'::jsonb),
		('EU', 'wheat-glucose-syrup', 'wheat', 'wheat', 'glucose-syrup', 'labeling', null, null, '{}'::jsonb),
		('EU', 'soy-tocopherol', 'soy', 'soy', 'tocopherol', 'processing', null, null, '{}'::jsonb),
		('EU', 'soy-phytosterol', 'soy', 'soy', 'phytosterol', 'processing', null, null, '{}'::jsonb),
		('EU', 'wheat-distillate', 'wheat', 'wheat', 'distillate', 'processing', null, null, '{"productType":"alcoholic-distillate"}'::jsonb),
		('EU', 'whey-distillate', 'milk', 'milk', 'distillate', 'processing', null, null, '{"productType":"alcoholic-distillate"}'::jsonb),
		('EU', 'fish-gelatin', 'fish', 'fish', 'carrier', 'processing', null, null, '{"use":"vitamin-or-carotenoid-carrier"}'::jsonb),
		('EU', 'fish-gelatin', 'fish', 'fish', 'fining-agent', 'processing', null, null, '{"productType":["beer","wine"]}'::jsonb),
		('EU', null, null, 'sulfite', null, 'threshold', 10, 'mg/kg-or-l', '{"metric":"total-sulfur-dioxide","operator":">"}'::jsonb),
		('AU-NZ', 'fully-refined-soybean-oil', 'soy', 'soy', 'fully-refined', 'processing', null, null, '{}'::jsonb),
		('AU-NZ', 'wheat-glucose-syrup', 'wheat', 'wheat', 'glucose-syrup', 'threshold', 20, 'mg/kg', '{"metric":"detectable-gluten","operator":"<="}'::jsonb),
		('AU-NZ', 'soy-tocopherol', 'soy', 'soy', 'tocopherol', 'processing', null, null, '{}'::jsonb),
		('AU-NZ', 'soy-phytosterol', 'soy', 'soy', 'phytosterol', 'processing', null, null, '{}'::jsonb),
		('AU-NZ', 'wheat-distillate', 'wheat', 'wheat', 'distillate', 'processing', null, null, '{"productType":"alcoholic-distillate"}'::jsonb),
		('AU-NZ', 'whey-distillate', 'milk', 'milk', 'distillate', 'processing', null, null, '{"productType":"alcoholic-distillate"}'::jsonb),
		('AU-NZ', 'fish-gelatin', 'fish', 'fish', 'fining-agent', 'processing', null, null, '{"productType":["beer","wine"]}'::jsonb)
	) as exemption(
		jurisdiction_code,
		ingredient_key,
		parent_key,
		tag_slug,
		processing_state,
		exemption_type,
		threshold_value,
		threshold_unit,
		product_context
	)
	left join public.ingredient_terms term
		on term.canonical_key = exemption.ingredient_key
	left join public.ingredient_terms parent
		on parent.canonical_key = exemption.parent_key
	join public.compatibility_tags tag on tag.slug = exemption.tag_slug;

	perform public.activate_food_compatibility_policy_version(v_draft_policy_id);
end;
$$;

revoke all on function public.inherit_food_compatibility_exemption_conditions()
	from public, anon, authenticated;

comment on column public.food_compatibility_policy_exemptions.threshold_value is
	'Reviewed jurisdictional threshold value. It is context only and never suppresses a personal compatibility warning.';
comment on column public.food_compatibility_policy_exemptions.product_context is
	'Reviewed structured conditions such as product type, use, metric, and comparison operator. Context never implies safety.';
comment on function public.compatibility_normalize_text(text) is
	'Accent-insensitive normalization used only for exact reviewed compatibility terminology and never for fuzzy inference.';
