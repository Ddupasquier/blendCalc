create temporary table legacy_unit_only_mix_goals on commit drop as
select
	definition.nutrient_id,
	case upper(definition.default_unit_name)
		when 'G' then 20::numeric
		when 'KCAL' then 350::numeric
		else 100::numeric
	end as legacy_target
from public.nutrient_definitions definition
where not exists (
	select 1
	from public.mix_goal_templates template
	join public.mix_goal_template_targets target
		on target.template_version_id = template.current_version_id
	where template.enabled
		and template.is_default
		and target.nutrient_id = definition.nutrient_id
);

delete from public.user_mix_nutrient_goals goal
using legacy_unit_only_mix_goals legacy
where goal.nutrient_id = legacy.nutrient_id
	and goal.goal_type = 'exact'
	and goal.target_amount = legacy.legacy_target
	and goal.tolerance_ratio = 0.1
	and goal.source_template_version_id is null
	and goal.source_user_template_id is null;

delete from public.user_mix_goal_template_targets target
using legacy_unit_only_mix_goals legacy
where target.nutrient_id = legacy.nutrient_id
	and target.goal_type = 'exact'
	and target.target_amount = legacy.legacy_target
	and target.tolerance_ratio = 0.1;

with cleaned_saved_goals as (
	select
		drink.id,
		coalesce(
			jsonb_object_agg(goal.key, goal.value) filter (
				where legacy.nutrient_id is null
					or case jsonb_typeof(goal.value)
						when 'number' then case
							when (goal.value #>> '{}') ~ '^[0-9]+([.][0-9]+)?$'
								then (goal.value #>> '{}')::numeric
							else null
						end
						when 'object' then case
							when coalesce(goal.value ->> 'targetAmount', '') ~ '^[0-9]+([.][0-9]+)?$'
								then (goal.value ->> 'targetAmount')::numeric
							else null
						end
						else null
					end is distinct from legacy.legacy_target
					or case jsonb_typeof(goal.value)
						when 'object' then coalesce(goal.value ->> 'goalType', 'exact')
						else 'exact'
					end <> 'exact'
			),
			'{}'::jsonb
		) as nutrient_goals
	from public.saved_drinks drink
	cross join lateral jsonb_each(
		case
			when jsonb_typeof(drink.drink -> 'nutrientGoals') = 'object'
				then drink.drink -> 'nutrientGoals'
			else '{}'::jsonb
		end
	) goal
	left join legacy_unit_only_mix_goals legacy
		on goal.key ~ '^[0-9]+$'
		and legacy.nutrient_id = goal.key::bigint
	group by drink.id
)
update public.saved_drinks drink
set drink = jsonb_set(
	drink.drink,
	'{nutrientGoals}',
	cleaned.nutrient_goals,
	true
)
from cleaned_saved_goals cleaned
where drink.id = cleaned.id
	and drink.drink -> 'nutrientGoals' is distinct from cleaned.nutrient_goals;

delete from public.mix_runtime_configuration
where key = 'default-goal-by-unit';
