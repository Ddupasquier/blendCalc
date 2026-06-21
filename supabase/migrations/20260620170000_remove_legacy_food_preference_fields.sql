delete from public.user_compatibility_rules
where rule_type in ('ingredient_avoid', 'dislike');

alter table public.user_compatibility_rules
	drop constraint if exists user_compatibility_rules_rule_type_check;

alter table public.user_compatibility_rules
	add constraint user_compatibility_rules_rule_type_check
	check (rule_type in ('allergen', 'dietary_restriction'));

revoke all on function public.sync_user_compatibility_rules(
	uuid,
	text[],
	text[],
	text[],
	text[]
) from public, anon, authenticated;

drop trigger if exists sync_user_food_preferences_compatibility_rules
	on public.user_food_preferences;

alter table public.user_food_preferences
	drop column if exists food_preferences,
	drop column if exists ingredients_to_avoid;

drop function if exists public.handle_user_food_preferences_compatibility_sync();
drop function if exists public.sync_user_compatibility_rules(
	uuid,
	text[],
	text[],
	text[],
	text[]
);

create or replace function public.sync_user_compatibility_rules(
	p_user_id uuid,
	p_allergens text[] default '{}'::text[],
	p_dietary_restrictions text[] default '{}'::text[]
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
			'allergen'::text as rule_type,
			'warn'::text as severity,
			raw_value,
			public.compatibility_normalize_text(raw_value) as normalized_value
		from unnest(coalesce(p_allergens, '{}'::text[])) as raw_value
		union all
		select
			'dietary_restriction'::text,
			'warn'::text,
			raw_value,
			public.compatibility_normalize_text(raw_value)
		from unnest(coalesce(p_dietary_restrictions, '{}'::text[])) as raw_value
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

create or replace function public.handle_user_food_preferences_compatibility_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if tg_op = 'DELETE' then
		perform public.sync_user_compatibility_rules(
			old.user_id,
			'{}'::text[],
			'{}'::text[]
		);
		return old;
	end if;

	perform public.sync_user_compatibility_rules(
		new.user_id,
		coalesce(new.allergens, '{}'::text[]),
		coalesce(new.dietary_restrictions, '{}'::text[])
	);
	return new;
end;
$$;

create trigger sync_user_food_preferences_compatibility_rules
	after insert or update of allergens, dietary_restrictions
	or delete on public.user_food_preferences
	for each row execute function public.handle_user_food_preferences_compatibility_sync();

revoke all on function public.sync_user_compatibility_rules(
	uuid,
	text[],
	text[]
) from public, anon, authenticated;

grant execute on function public.sync_user_compatibility_rules(
	uuid,
	text[],
	text[]
) to authenticated;

revoke all on function public.handle_user_food_preferences_compatibility_sync()
	from public, anon, authenticated;

select public.sync_user_compatibility_rules(
	preferences.user_id,
	preferences.allergens,
	preferences.dietary_restrictions
)
from public.user_food_preferences preferences;
