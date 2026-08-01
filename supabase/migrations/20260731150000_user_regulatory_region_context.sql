alter table public.user_food_preferences
	add column regulatory_region_code text,
	add column regulatory_region_source text,
	add constraint user_food_preferences_regulatory_region_code_check
		check (
			regulatory_region_code is null
			or regulatory_region_code ~ '^[A-Z]{2}(?:-[A-Z]{2})?$'
		),
	add constraint user_food_preferences_regulatory_region_source_check
		check (
			regulatory_region_source is null
			or regulatory_region_source in ('account', 'device')
		),
	add constraint user_food_preferences_regulatory_region_pair_check
		check (
			(regulatory_region_code is null and regulatory_region_source is null)
			or
			(regulatory_region_code is not null and regulatory_region_source is not null)
		);

create or replace function public.validate_user_food_preference_regulatory_region()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if new.regulatory_region_code is null then
		return new;
	end if;

	if not exists (
		select 1
		from public.food_allergen_regulatory_profiles profile
		where profile.policy_version_id =
			public.active_food_compatibility_policy_version_id()
			and profile.active
			and profile.region_code = new.regulatory_region_code
	) then
		raise exception using
			errCode = '23514',
			message = 'The selected regulatory region is not supported by the active food compatibility policy.';
	end if;

	return new;
end;
$$;

create trigger validate_user_food_preference_regulatory_region
	before insert or update of regulatory_region_code, regulatory_region_source
	on public.user_food_preferences
	for each row execute function
		public.validate_user_food_preference_regulatory_region();

comment on column public.user_food_preferences.regulatory_region_code is
	'Optional stable region code resolved against the active version-bound allergen regulatory profile. It provides labeling context and never suppresses personal warnings.';

comment on column public.user_food_preferences.regulatory_region_source is
	'How the saved account region was selected: an accepted device-locale suggestion or an explicit account choice.';

revoke all on function public.validate_user_food_preference_regulatory_region()
	from public, anon, authenticated;

