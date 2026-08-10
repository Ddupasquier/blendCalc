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
		where match_rule.enabled
			and (
				match_rule.tag_id = tag.id
				or exists (
					select 1
					from public.compatibility_rule_conflicts conflict
					where conflict.preference_tag_id = tag.id
						and conflict.fact_tag_id = match_rule.tag_id
				)
			)
	) as evidence_rule_count
from public.compatibility_tags tag
where tag.category in ('allergen', 'dietary');

revoke all on public.food_compatibility_policy_coverage
	from public, anon, authenticated;
grant select on public.food_compatibility_policy_coverage
	to service_role;

comment on view public.food_compatibility_policy_coverage is
	'Service-only coverage audit for selectable allergen and dietary preferences. Evidence counts include rules attached directly to a preference tag and rules reachable through its conflict facts.';
