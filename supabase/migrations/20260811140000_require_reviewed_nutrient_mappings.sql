with unreviewed_semantic_candidates as (
	select
		source_key,
		source_nutrient_key,
		source_unit_name,
		review_reference,
		reviewed_at
	from public.nutrient_source_mappings
	where mapping_method in ('api_taxonomy_match', 'api_observation_match')
		and review_status <> 'rejected'
)
update public.nutrient_source_mappings mapping
set
	enabled = false,
	review_status = 'pending_review',
	review_reference = null,
	reviewed_at = null,
	provenance = mapping.provenance || jsonb_build_object(
		'semanticCandidateNormalizedIn',
		'20260811140000_require_reviewed_nutrient_mappings',
		'supersededReviewReference',
		unreviewed_semantic_candidates.review_reference,
		'supersededReviewedAt',
		unreviewed_semantic_candidates.reviewed_at,
		'reviewReason',
		'Semantic name similarity is candidate discovery, not canonical nutrient identity.'
	),
	updated_at = now()
from unreviewed_semantic_candidates
where mapping.source_key = unreviewed_semantic_candidates.source_key
	and mapping.source_nutrient_key = unreviewed_semantic_candidates.source_nutrient_key
	and mapping.source_unit_name = unreviewed_semantic_candidates.source_unit_name;

create or replace function private.enforce_reviewed_food_nutrient_lineage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.mapping_method in ('api_taxonomy_match', 'api_observation_match') then
		new.mapping_status := 'unmapped';
		new.mapping_review_reference := null;
	end if;
	return new;
end;
$$;

drop trigger if exists enforce_reviewed_food_nutrient_lineage
	on public.food_nutrients;
create trigger enforce_reviewed_food_nutrient_lineage
	before insert or update on public.food_nutrients
	for each row execute function private.enforce_reviewed_food_nutrient_lineage();

revoke all on function private.enforce_reviewed_food_nutrient_lineage()
	from public, anon, authenticated;

update public.food_nutrients
set
	mapping_status = 'unmapped',
	mapping_review_reference = null,
	updated_at = now()
where mapping_method in ('api_taxonomy_match', 'api_observation_match')
	and mapping_status = 'canonical';

alter table public.nutrient_source_mappings
	drop constraint if exists nutrient_source_mappings_enabled_review_check,
	drop constraint if exists nutrient_source_mappings_approved_evidence_check,
	drop constraint if exists nutrient_source_mappings_semantic_candidate_check;

alter table public.nutrient_source_mappings
	add constraint nutrient_source_mappings_enabled_review_check check (
		not enabled or review_status = 'approved'
	),
	add constraint nutrient_source_mappings_approved_evidence_check check (
		review_status <> 'approved'
		or (
			nullif(btrim(review_reference), '') is not null
			and reviewed_at is not null
		)
	),
	add constraint nutrient_source_mappings_semantic_candidate_check check (
		mapping_method not in ('api_taxonomy_match', 'api_observation_match')
		or (
			not enabled
			and (
				(
					review_status = 'pending_review'
					and review_reference is null
					and reviewed_at is null
				)
				or (
					review_status = 'rejected'
					and nullif(btrim(review_reference), '') is not null
					and reviewed_at is not null
				)
			)
		)
	);

comment on column public.nutrient_source_mappings.mapping_method is
	'How nutrient identity was established. Taxonomy and observation matches are disabled review candidates; approved mappings require source identity or an explicit reviewed decision.';

comment on column public.nutrient_source_mappings.review_status is
	'Only approved mappings with review evidence may be enabled. Semantic candidates remain pending and disabled until reviewed into an identity-bearing mapping method.';

comment on function private.enforce_reviewed_food_nutrient_lineage() is
	'Prevents semantic nutrient candidates from being represented as canonical normalized lineage, including when a legacy parent snapshot is synchronized again.';
