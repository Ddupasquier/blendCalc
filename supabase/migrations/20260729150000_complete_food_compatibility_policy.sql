insert into public.compatibility_tags (slug, label, category)
values
	('mustard', 'Mustard', 'allergen'),
	('celery', 'Celery', 'allergen'),
	('lupin', 'Lupin', 'allergen'),
	('mollusc', 'Mollusc', 'allergen'),
	('sulfite', 'Sulphites / Sulfites', 'allergen'),
	('meat', 'Meat', 'avoidance'),
	('pork', 'Pork', 'avoidance'),
	('animal-fat', 'Animal fat', 'avoidance'),
	('animal-stock', 'Animal stock or broth', 'avoidance'),
	('gelatin', 'Gelatin', 'avoidance'),
	('collagen', 'Collagen', 'avoidance'),
	('bee-product', 'Bee-derived ingredient', 'avoidance'),
	('insect-derived', 'Insect-derived ingredient', 'avoidance'),
	('animal-rennet', 'Animal-derived rennet', 'avoidance'),
	('alcohol', 'Alcohol', 'avoidance'),
	('non-vegan', 'Not vegan', 'avoidance'),
	('non-vegetarian', 'Not vegetarian', 'avoidance')
on conflict (slug) do update
set
	label = excluded.label,
	category = excluded.category,
	updated_at = now();

alter table public.compatibility_rule_conflicts
	add column if not exists priority integer not null default 100;

alter table public.food_preference_option_catalog
	drop constraint if exists food_preference_option_catalog_source_type_check;

alter table public.food_preference_option_catalog
	add constraint food_preference_option_catalog_source_type_check
		check (
			source_type in (
				'compatibility_tag',
				'compatibility_fact',
				'ingredient_list',
				'api_observation'
			)
		);

alter table public.food_compatibility_match_rules
	drop constraint if exists food_compatibility_match_rules_field_name_check,
	drop constraint if exists food_compatibility_match_rules_fact_type_check,
	drop constraint if exists food_compatibility_match_rules_source_type_check;

alter table public.food_compatibility_match_rules
	add constraint food_compatibility_match_rules_field_name_check
		check (
			field_name in (
				'ingredients',
				'generic_food_identity',
				'allergens',
				'traces',
				'ingredient_analysis'
			)
		),
	add constraint food_compatibility_match_rules_fact_type_check
		check (
			fact_type in (
				'ingredient_present',
				'contains',
				'may_contain',
				'dietary_conflict'
			)
		),
	add constraint food_compatibility_match_rules_source_type_check
		check (
			source_type in (
				'label_ingredient_field',
				'food_identity_taxonomy',
				'label_allergen_field',
				'label_trace_field',
				'source_dietary_analysis'
			)
		);

alter table public.product_compatibility_facts
	drop constraint if exists product_compatibility_facts_fact_type_check,
	drop constraint if exists product_compatibility_facts_source_type_check;

alter table public.product_compatibility_facts
	add constraint product_compatibility_facts_fact_type_check
		check (
			fact_type in (
				'contains',
				'may_contain',
				'free_from',
				'dietary_claim',
				'ingredient_present',
				'dietary_conflict'
			)
		),
	add constraint product_compatibility_facts_source_type_check
		check (
			source_type in (
				'shared_product_metadata',
				'shared_observation_metadata',
				'shared_submission_metadata',
				'label_allergen_field',
				'label_trace_field',
				'label_dietary_field',
				'label_ingredient_field',
				'food_identity_taxonomy',
				'source_dietary_analysis'
			)
		);

delete from public.food_compatibility_match_rules;

with allergen_rules (
	tag_slug,
	match_pattern,
	exclude_pattern,
	priority
) as (
	values
		('milk', '\b(?:milk|dairy)\b', null, 10),
		('peanut', '\bpeanuts?\b', null, 20),
		(
			'tree-nut',
			'\b(?:tree nuts?|almonds?|brazil nuts?|cashews?|chestnuts?|filberts?|hazelnuts?|hickory nuts?|macadamias?|pecans?|pine nuts?|pignoli|pistachios?|walnuts?)\b',
			null,
			30
		),
		('soy', '\b(?:soy|soya|soybeans?)\b', null, 40),
		('egg', '\beggs?\b', null, 50),
		(
			'wheat',
			'\b(?:wheat|durum|einkorn|emmer|farro|kamut|semolina|spelt)\b',
			null,
			60
		),
		(
			'gluten',
			'\b(?:gluten|barley|malt|rye|triticale)\b',
			null,
			70
		),
		(
			'fish',
			'\b(?:fish|anchov(?:y|ies)|bass|bonito|catfish|cod|flounder|grouper|haddock|hake|halibut|herring|mahi mahi|mackerel|monkfish|perch|pike|pollock|salmon|sardines?|snapper|sole|swordfish|tilapia|trout|tuna)\b',
			null,
			80
		),
		(
			'shellfish',
			'\b(?:crustaceans?|shellfish|shrimp|prawns?|crabs?|lobsters?|crayfish|crawfish|langoustines?|krill)\b',
			null,
			90
		),
		('sesame', '\b(?:sesame|tahini)\b', null, 100),
		('mustard', '\bmustard\b', null, 110),
		('celery', '\b(?:celery|celeriac)\b', null, 120),
		('lupin', '\b(?:lupin|lupine)\b', null, 130),
		(
			'mollusc',
			'\b(?:molluscs?|mollusks?|abalone|clams?|cockles?|cuttlefish|escargot|mussels?|octopus|oysters?|scallops?|snails?|squid|calamari)\b',
			null,
			140
		),
		(
			'sulfite',
			'\b(?:sulfites?|sulphites?|sulfur dioxide|sulphur dioxide)\b',
			null,
			150
		)
),
source_fields (
	field_name,
	fact_type,
	source_type,
	priority_offset
) as (
	values
		('allergens', 'contains', 'label_allergen_field', 0),
		('traces', 'may_contain', 'label_trace_field', 1)
)
insert into public.food_compatibility_match_rules (
	tag_id,
	source_key,
	field_name,
	match_pattern,
	exclude_pattern,
	fact_type,
	source_type,
	confidence,
	priority
)
select
	tag.id,
	null,
	source_fields.field_name,
	allergen_rules.match_pattern,
	allergen_rules.exclude_pattern,
	source_fields.fact_type,
	source_fields.source_type,
	'confirmed',
	allergen_rules.priority + source_fields.priority_offset
from allergen_rules
cross join source_fields
join public.compatibility_tags tag
	on tag.slug = allergen_rules.tag_slug;

with ingredient_allergen_rules (
	tag_slug,
	match_pattern,
	exclude_pattern,
	priority
) as (
	values
		(
			'milk',
			'\b(?:milk|buttermilk|milkfat|whey|casein|caseinate|lactose|cheese|yogurt|yoghurt|ghee)\b',
			null,
			210
		),
		('peanut', '\bpeanuts?\b', null, 220),
		(
			'tree-nut',
			'\b(?:tree nuts?|almonds?|brazil nuts?|cashews?|chestnuts?|filberts?|hazelnuts?|hickory nuts?|macadamias?|pecans?|pine nuts?|pignoli|pistachios?|walnuts?)\b',
			null,
			230
		),
		(
			'soy',
			'\b(?:soy|soya|soybeans?|tofu|tempeh|edamame)\b',
			null,
			240
		),
		('egg', '\b(?:eggs?|albumen|ovalbumin)\b', '\beggplants?\b', 250),
		(
			'wheat',
			'\b(?:wheat|durum|einkorn|emmer|farro|kamut|semolina|spelt)\b',
			null,
			260
		),
		(
			'gluten',
			'\b(?:gluten|barley|malt|rye|triticale)\b',
			null,
			270
		),
		(
			'fish',
			'\b(?:fish|anchov(?:y|ies)|bass|bonito|catfish|cod|flounder|grouper|haddock|hake|halibut|herring|mahi mahi|mackerel|monkfish|perch|pike|pollock|salmon|sardines?|snapper|sole|swordfish|tilapia|trout|tuna)\b',
			null,
			280
		),
		(
			'shellfish',
			'\b(?:crustaceans?|shellfish|shrimp|prawns?|crabs?|lobsters?|crayfish|crawfish|langoustines?|krill)\b',
			null,
			290
		),
		('sesame', '\b(?:sesame|tahini)\b', null, 300),
		('mustard', '\bmustard\b', null, 310),
		('celery', '\b(?:celery|celeriac)\b', null, 320),
		('lupin', '\b(?:lupin|lupine)\b', null, 330),
		(
			'mollusc',
			'\b(?:molluscs?|mollusks?|abalone|clams?|cockles?|cuttlefish|escargot|mussels?|octopus|oysters?|scallops?|snails?|squid|calamari)\b',
			null,
			340
		),
		(
			'sulfite',
			'\b(?:sulfites?|sulphites?|sulfur dioxide|sulphur dioxide|e220|e221|e222|e223|e224|e225|e226|e227|e228)\b',
			null,
			350
		)
),
source_fields (
	field_name,
	fact_type,
	source_type,
	confidence,
	priority_offset
) as (
	values
		(
			'ingredients',
			'ingredient_present',
			'label_ingredient_field',
			'confirmed',
			0
		),
		(
			'generic_food_identity',
			'contains',
			'food_identity_taxonomy',
			'confirmed',
			200
		)
)
insert into public.food_compatibility_match_rules (
	tag_id,
	source_key,
	field_name,
	match_pattern,
	exclude_pattern,
	fact_type,
	source_type,
	confidence,
	priority
)
select
	tag.id,
	null,
	source_fields.field_name,
	ingredient_allergen_rules.match_pattern,
	ingredient_allergen_rules.exclude_pattern,
	source_fields.fact_type,
	source_fields.source_type,
	source_fields.confidence,
	ingredient_allergen_rules.priority + source_fields.priority_offset
from ingredient_allergen_rules
cross join source_fields
join public.compatibility_tags tag
	on tag.slug = ingredient_allergen_rules.tag_slug;

with dietary_evidence_rules (
	tag_slug,
	match_pattern,
	exclude_pattern,
	confidence,
	priority
) as (
	values
		(
			'meat',
			'\b(?:meat|beef|veal|pork|ham|bacon|prosciutto|salami|pepperoni|lamb|mutton|goat|chevon|chicken|turkey|duck|goose|quail|venison|deer|elk|bison|buffalo|rabbit|hare|horse|kangaroo|ostrich|poultry)\b',
			null,
			'confirmed',
			610
		),
		(
			'pork',
			'\b(?:pork|pig|swine|ham|bacon|prosciutto|lard|pepperoni)\b',
			null,
			'confirmed',
			620
		),
		(
			'animal-fat',
			'\b(?:animal fat|beef fat|chicken fat|duck fat|pork fat|lard|schmaltz|suet|tallow)\b',
			null,
			'confirmed',
			630
		),
		(
			'animal-stock',
			'\b(?:animal|beef|bone|chicken|duck|meat|pork|turkey)\s+(?:broth|stock)\b',
			null,
			'confirmed',
			640
		),
		('gelatin', '\b(?:gelatin|gelatine)\b', null, 'confirmed', 650),
		('collagen', '\bcollagen\b', null, 'confirmed', 660),
		(
			'bee-product',
			'\b(?:honey|beeswax|bee pollen|propolis|royal jelly)\b',
			null,
			'confirmed',
			670
		),
		(
			'insect-derived',
			'\b(?:carmine|cochineal|carminic acid|shellac|confectioners glaze|confectioner''s glaze|lac resin|e120|e904)\b',
			null,
			'confirmed',
			680
		),
		(
			'animal-rennet',
			'\banimal\s+rennet\b',
			null,
			'confirmed',
			690
		),
		(
			'animal-rennet',
			'\brennet\b',
			'\b(?:microbial|non animal|plant based|vegetable|vegetarian)\s+rennet\b',
			'inferred',
			700
		),
		(
			'alcohol',
			'\b(?:alcohol|ethanol|brandy|bourbon|liqueur|mirin|rum|sake|vodka|whisk(?:e)?y)\b',
			'\b(?:alcohol free|non alcoholic)\b',
			'confirmed',
			710
		),
		(
			'alcohol',
			'\b(?:beer|wine)\b',
			'\b(?:beer yeast|wine vinegar)\b',
			'inferred',
			720
		)
),
source_fields (
	field_name,
	source_type,
	priority_offset
) as (
	values
		('ingredients', 'label_ingredient_field', 0),
		('generic_food_identity', 'food_identity_taxonomy', 200)
)
insert into public.food_compatibility_match_rules (
	tag_id,
	source_key,
	field_name,
	match_pattern,
	exclude_pattern,
	fact_type,
	source_type,
	confidence,
	priority
)
select
	tag.id,
	null,
	source_fields.field_name,
	dietary_evidence_rules.match_pattern,
	dietary_evidence_rules.exclude_pattern,
	'dietary_conflict',
	source_fields.source_type,
	dietary_evidence_rules.confidence,
	dietary_evidence_rules.priority + source_fields.priority_offset
from dietary_evidence_rules
cross join source_fields
join public.compatibility_tags tag
	on tag.slug = dietary_evidence_rules.tag_slug;

with analysis_rules (
	tag_slug,
	match_pattern,
	priority
) as (
	values
		(
			'non-vegan',
			'(?:non[- ]vegan|"vegan"\s*:\s*"no")',
			1010
		),
		(
			'non-vegetarian',
			'(?:non[- ]vegetarian|"vegetarian"\s*:\s*"no")',
			1020
		)
)
insert into public.food_compatibility_match_rules (
	tag_id,
	source_key,
	field_name,
	match_pattern,
	exclude_pattern,
	fact_type,
	source_type,
	confidence,
	priority
)
select
	tag.id,
	null,
	'ingredient_analysis',
	analysis_rules.match_pattern,
	null,
	'dietary_conflict',
	'source_dietary_analysis',
	'inferred',
	analysis_rules.priority
from analysis_rules
join public.compatibility_tags tag
	on tag.slug = analysis_rules.tag_slug;

delete from public.compatibility_rule_conflicts;

with conflict_values (
	preference_slug,
	fact_slug,
	severity,
	priority
) as (
	values
		('dairy', 'dairy', 'warning', 10),
		('dairy', 'milk', 'warning', 20),
		('milk', 'milk', 'warning', 10),
		('peanut', 'peanut', 'warning', 10),
		('tree-nut', 'tree-nut', 'warning', 10),
		('soy', 'soy', 'warning', 10),
		('egg', 'egg', 'warning', 10),
		('wheat', 'wheat', 'warning', 10),
		('gluten', 'gluten', 'warning', 10),
		('fish', 'fish', 'warning', 10),
		('shellfish', 'shellfish', 'warning', 10),
		('sesame', 'sesame', 'warning', 10),
		('mustard', 'mustard', 'warning', 10),
		('celery', 'celery', 'warning', 10),
		('lupin', 'lupin', 'warning', 10),
		('mollusc', 'mollusc', 'warning', 10),
		('sulfite', 'sulfite', 'warning', 10),
		('dairy-free', 'dairy', 'warning', 10),
		('dairy-free', 'milk', 'warning', 20),
		('egg-free', 'egg', 'warning', 10),
		('gluten-free', 'gluten', 'warning', 10),
		('gluten-free', 'wheat', 'warning', 20),
		('nut-free', 'peanut', 'warning', 10),
		('nut-free', 'tree-nut', 'warning', 20),
		('soy-free', 'soy', 'warning', 10),
		('vegan', 'non-vegan', 'warning', 1),
		('vegan', 'pork', 'warning', 5),
		('vegan', 'meat', 'warning', 10),
		('vegan', 'dairy', 'warning', 20),
		('vegan', 'milk', 'warning', 21),
		('vegan', 'egg', 'warning', 22),
		('vegan', 'fish', 'warning', 23),
		('vegan', 'shellfish', 'warning', 24),
		('vegan', 'mollusc', 'warning', 25),
		('vegan', 'animal-fat', 'warning', 30),
		('vegan', 'animal-stock', 'warning', 31),
		('vegan', 'gelatin', 'warning', 32),
		('vegan', 'collagen', 'warning', 33),
		('vegan', 'bee-product', 'warning', 34),
		('vegan', 'insect-derived', 'warning', 35),
		('vegan', 'animal-rennet', 'warning', 36),
		('vegan', 'non-vegetarian', 'warning', 40),
		('vegetarian', 'non-vegetarian', 'warning', 1),
		('vegetarian', 'pork', 'warning', 5),
		('vegetarian', 'meat', 'warning', 10),
		('vegetarian', 'fish', 'warning', 20),
		('vegetarian', 'shellfish', 'warning', 21),
		('vegetarian', 'mollusc', 'warning', 22),
		('vegetarian', 'animal-fat', 'warning', 30),
		('vegetarian', 'animal-stock', 'warning', 31),
		('vegetarian', 'gelatin', 'warning', 32),
		('vegetarian', 'collagen', 'warning', 33),
		('vegetarian', 'insect-derived', 'warning', 34),
		('vegetarian', 'animal-rennet', 'potential', 40),
		('halal', 'pork', 'warning', 1),
		('halal', 'alcohol', 'warning', 2),
		('halal', 'gelatin', 'potential', 20),
		('halal', 'animal-fat', 'potential', 21),
		('halal', 'animal-stock', 'potential', 22),
		('halal', 'animal-rennet', 'potential', 23),
		('kosher', 'pork', 'warning', 1),
		('kosher', 'shellfish', 'warning', 2),
		('kosher', 'mollusc', 'warning', 3),
		('kosher', 'insect-derived', 'potential', 4),
		('kosher', 'gelatin', 'potential', 20),
		('kosher', 'animal-fat', 'potential', 21),
		('kosher', 'animal-stock', 'potential', 22),
		('kosher', 'animal-rennet', 'potential', 23)
)
insert into public.compatibility_rule_conflicts (
	preference_tag_id,
	fact_tag_id,
	severity,
	warning_code,
	priority
)
select
	preference_tag.id,
	fact_tag.id,
	conflict_values.severity,
	'FOOD_RESTRICTION_CONFLICT',
	conflict_values.priority
from conflict_values
join public.compatibility_tags preference_tag
	on preference_tag.slug = conflict_values.preference_slug
join public.compatibility_tags fact_tag
	on fact_tag.slug = conflict_values.fact_slug;

with ranked_facts as (
	select
		id,
		row_number() over (
			partition by
				shared_product_id,
				shared_product_observation_id,
				shared_product_submission_id,
				tag_id,
				fact_type,
				source_type
			order by updated_at desc, created_at desc, id
		) as duplicate_rank
	from public.product_compatibility_facts
)
delete from public.product_compatibility_facts fact
using ranked_facts
where fact.id = ranked_facts.id
	and ranked_facts.duplicate_rank > 1;

create unique index if not exists product_compatibility_facts_unique_evidence_idx
	on public.product_compatibility_facts (
		shared_product_id,
		shared_product_observation_id,
		shared_product_submission_id,
		tag_id,
		fact_type,
		source_type
	) nulls not distinct;

create or replace function public.sync_shared_product_compatibility_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if current_setting('blendcalc.compatibility_bulk_refresh', true) = 'on' then
		return case when tg_op = 'DELETE' then old else new end;
	end if;

	if tg_op = 'DELETE' then
		if old.shared_product_id is not null then
			perform public.rebuild_shared_product_compatibility_summary(
				old.shared_product_id
			);
		end if;
		return old;
	end if;

	if new.shared_product_id is not null then
		perform public.rebuild_shared_product_compatibility_summary(
			new.shared_product_id
		);
	end if;
	return new;
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

	if p_shared_product_id is not null then
		perform set_config(
			'blendcalc.compatibility_bulk_refresh',
			'on',
			true
		);
	end if;

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

	if p_food is not null and jsonb_typeof(p_food) = 'object' then
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
				when jsonb_typeof(p_food -> 'allergens') = 'array'
					then p_food -> 'allergens'
				else '[]'::jsonb
			end
		) as raw_values(value)
		cross join lateral (
			select public.compatibility_normalize_text(
				regexp_replace(raw_values.value, '^[a-z]{2}:', '', 'i')
			) as normalized_value
		) normalized
		join public.compatibility_tags tag
			on public.compatibility_normalize_text(tag.slug) =
				normalized.normalized_value
			or public.compatibility_normalize_text(tag.label) =
				normalized.normalized_value
		where tag.category = 'allergen'
		on conflict do nothing;

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
				when jsonb_typeof(p_food -> 'traces') = 'array'
					then p_food -> 'traces'
				else '[]'::jsonb
			end
		) as raw_values(value)
		cross join lateral (
			select public.compatibility_normalize_text(
				regexp_replace(raw_values.value, '^[a-z]{2}:', '', 'i')
			) as normalized_value
		) normalized
		join public.compatibility_tags tag
			on public.compatibility_normalize_text(tag.slug) =
				normalized.normalized_value
			or public.compatibility_normalize_text(tag.label) =
				normalized.normalized_value
		where tag.category = 'allergen'
		on conflict do nothing;

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
					when jsonb_typeof(p_food -> 'dietaryTags') = 'array'
						then p_food -> 'dietaryTags'
					else '[]'::jsonb
				end
			)
			union all
			select value
			from jsonb_array_elements_text(
				case
					when jsonb_typeof(p_food -> 'labels') = 'array'
						then p_food -> 'labels'
					else '[]'::jsonb
				end
			)
		) as raw_values
		cross join lateral (
			select public.compatibility_normalize_text(
				regexp_replace(raw_values.value, '^[a-z]{2}:', '', 'i')
			) as normalized_value
		) normalized
		join public.compatibility_tags tag
			on public.compatibility_normalize_text(tag.slug) =
				normalized.normalized_value
			or public.compatibility_normalize_text(tag.label) =
				normalized.normalized_value
		where tag.category = 'dietary'
		on conflict do nothing;

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
		select distinct on (
			rule.tag_id,
			rule.fact_type,
			rule.source_type
		)
			p_shared_product_id,
			p_shared_product_observation_id,
			p_shared_product_submission_id,
			rule.tag_id,
			rule.fact_type,
			rule.source_type,
			match.source_text,
			rule.confidence
		from public.food_compatibility_match_rules rule
		cross join lateral (
			select case
				when rule.field_name = 'ingredients'
					and rule.source_type = 'label_ingredient_field'
					then p_food ->> 'ingredients'
				when rule.field_name = 'generic_food_identity'
					and rule.source_type = 'food_identity_taxonomy'
					and p_food ->> 'foodIdentityType' = 'generic'
					then concat_ws(
						' | ',
						nullif(p_food ->> 'description', ''),
						nullif(p_food ->> 'scientificName', ''),
						nullif(p_food ->> 'alternateDescription', ''),
						nullif(p_food ->> 'foodCategory', ''),
						nullif(p_food ->> 'preparation', '')
					)
				when rule.field_name = 'allergens'
					and rule.source_type = 'label_allergen_field'
					then (
						select string_agg(value, ' | ')
						from jsonb_array_elements_text(
							case
								when jsonb_typeof(p_food -> 'allergens') = 'array'
									then p_food -> 'allergens'
								else '[]'::jsonb
							end
						) values(value)
					)
				when rule.field_name = 'traces'
					and rule.source_type = 'label_trace_field'
					then (
						select string_agg(value, ' | ')
						from jsonb_array_elements_text(
							case
								when jsonb_typeof(p_food -> 'traces') = 'array'
									then p_food -> 'traces'
								else '[]'::jsonb
							end
						) values(value)
					)
				when rule.field_name = 'ingredient_analysis'
					and rule.source_type = 'source_dietary_analysis'
					then concat_ws(
						' | ',
						nullif(p_food ->> 'ingredientAnalysis', ''),
						nullif(p_food ->> 'structuredIngredients', '')
					)
				else null
			end as field_value
		) source
		cross join lateral (
			select public.compatibility_first_regex_match(
				source.field_value,
				rule.match_pattern
			) as source_text
		) match
		where rule.enabled
			and source.field_value is not null
			and match.source_text is not null
			and (
				rule.exclude_pattern is null
				or public.compatibility_first_regex_match(
					source.field_value,
					rule.exclude_pattern
				) is null
			)
			and (
				rule.source_key is null
				or rule.source_key = nullif(p_food ->> 'sourceKey', '')
			)
		order by
			rule.tag_id,
			rule.fact_type,
			rule.source_type,
			rule.priority
		on conflict do nothing;
	end if;

	if p_shared_product_id is not null then
		perform set_config(
			'blendcalc.compatibility_bulk_refresh',
			'off',
			true
		);
		perform public.rebuild_shared_product_compatibility_summary(
			p_shared_product_id
		);
	end if;
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

create or replace function public.rebuild_food_preference_option_catalog()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	delete from public.food_preference_option_catalog
	where true;

	insert into public.food_preference_option_catalog (
		category,
		label,
		normalized_value,
		source_type,
		tag_id,
		source_values,
		usage_count
	)
	with raw_options as (
		select
			tag.category,
			tag.label,
			tag.slug as normalized_value,
			'compatibility_tag'::text as source_type,
			tag.id as tag_id,
			tag.label as source_value,
			1 as usage_weight,
			0 as source_rank
		from public.compatibility_tags tag
		where tag.category = 'allergen'
			or (
				tag.category = 'dietary'
				and exists (
					select 1
					from public.compatibility_rule_conflicts conflict
					where conflict.preference_tag_id = tag.id
				)
			)

		union all

		select
			tag.category,
			tag.label,
			tag.slug,
			'compatibility_fact',
			tag.id,
			coalesce(fact.source_text, tag.label),
			2,
			1
		from public.product_compatibility_facts fact
		join public.shared_products product
			on product.id = fact.shared_product_id
			and product.status = 'active'
		join public.compatibility_tags tag
			on tag.id = fact.tag_id
		where (
				tag.category = 'allergen'
				and fact.fact_type in ('contains', 'may_contain')
			)
			or (
				tag.category = 'dietary'
				and fact.fact_type = 'dietary_claim'
				and exists (
					select 1
					from public.compatibility_rule_conflicts conflict
					where conflict.preference_tag_id = tag.id
				)
			)

		union all

		select
			tag.category,
			tag.label,
			tag.slug,
			'api_observation',
			tag.id,
			observation.source_value,
			observation.observation_count,
			2
		from public.food_preference_api_observations observation
		join public.compatibility_tags tag
			on tag.category = observation.category
			and (
				public.compatibility_normalize_text(tag.slug) =
					observation.normalized_value
				or public.compatibility_normalize_text(tag.label) =
					observation.normalized_value
			)
		where observation.category in ('allergen', 'dietary')
			and (
				tag.category <> 'dietary'
				or exists (
					select 1
					from public.compatibility_rule_conflicts conflict
					where conflict.preference_tag_id = tag.id
				)
			)

		union all

		select
			'ingredient',
			raw_values.value,
			normalized.normalized_value,
			'ingredient_list',
			null::uuid,
			raw_values.value,
			1,
			3
		from public.shared_products product
		cross join lateral jsonb_array_elements_text(
			case
				when jsonb_typeof(product.food -> 'ingredientList') = 'array'
					then product.food -> 'ingredientList'
				else '[]'::jsonb
			end
		) as raw_values(value)
		cross join lateral (
			select public.compatibility_normalize_text(
				raw_values.value
			) as normalized_value
		) normalized
		where product.status = 'active'
			and normalized.normalized_value <> ''
			and char_length(normalized.normalized_value) <= 60

		union all

		select
			'ingredient',
			observation.label,
			observation.normalized_value,
			'api_observation',
			null::uuid,
			observation.source_value,
			observation.observation_count,
			4
		from public.food_preference_api_observations observation
		where observation.category = 'ingredient'
			and char_length(observation.normalized_value) <= 60
	),
	grouped_options as (
		select
			category,
			normalized_value,
			(array_agg(
				label
				order by source_rank, usage_weight desc, label
			))[1] as label,
			(array_agg(
				source_type
				order by source_rank, usage_weight desc, label
			))[1] as source_type,
			(array_remove(array_agg(
				tag_id
				order by source_rank, usage_weight desc, label
			), null))[1] as tag_id,
			array_agg(distinct source_value order by source_value) as source_values,
			sum(usage_weight)::integer as usage_count
		from raw_options
		where normalized_value <> ''
		group by category, normalized_value
	)
	select
		category,
		label,
		normalized_value,
		source_type,
		tag_id,
		source_values,
		usage_count
	from grouped_options;
end;
$$;

drop view if exists public.food_compatibility_policy_coverage;
create view public.food_compatibility_policy_coverage
with (security_invoker = true)
as
select
	tag.id as tag_id,
	tag.slug,
	tag.label,
	tag.category,
	exists (
		select 1
		from public.food_preference_option_catalog option
		where option.tag_id = tag.id
			and option.category = tag.category
	) as selectable,
	(
		select count(*)::integer
		from public.compatibility_rule_conflicts conflict
		where conflict.preference_tag_id = tag.id
	) as conflict_count,
	(
		select count(*)::integer
		from public.food_compatibility_match_rules match_rule
		where match_rule.tag_id = tag.id
			and match_rule.enabled
	) as evidence_rule_count
from public.compatibility_tags tag
where tag.category in ('allergen', 'dietary');

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

select public.rebuild_food_preference_option_catalog();

revoke all on public.food_compatibility_policy_coverage
	from public, anon, authenticated;
grant select on public.food_compatibility_policy_coverage
	to service_role;

revoke all on function public.refresh_shared_product_compatibility_match_facts(uuid)
	from public, anon, authenticated;
grant execute on function public.refresh_shared_product_compatibility_match_facts(uuid)
	to service_role;

comment on table public.food_compatibility_match_rules is
	'Reviewed source-field rules for explicit allergen declarations, traces, ingredient statements, source dietary analysis, and authoritative generic-food identity. Packaged names, brands, and categories are never warning evidence.';

comment on view public.food_compatibility_policy_coverage is
	'Service-only coverage audit for selectable allergen and dietary preferences. Enabled dietary options must have DB-owned conflict policy.';
