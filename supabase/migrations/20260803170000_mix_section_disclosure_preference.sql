alter table public.mix_preferences
	add column section_disclosure_state jsonb not null default jsonb_build_object(
		'nutrient-shape', true,
		'goals', true,
		'selected-ingredients', true,
		'add-ingredients', true,
		'warnings', true,
		'suggested-adjustments', false,
		'nutrient-contributions', true
	);

alter table public.mix_preferences
	add constraint mix_preferences_section_disclosure_state_check
	check (
		jsonb_typeof(section_disclosure_state) = 'object'
		and section_disclosure_state ?& array[
			'nutrient-shape',
			'goals',
			'selected-ingredients',
			'add-ingredients',
			'warnings',
			'suggested-adjustments',
			'nutrient-contributions'
		]::text[]
		and section_disclosure_state - array[
			'nutrient-shape',
			'goals',
			'selected-ingredients',
			'add-ingredients',
			'warnings',
			'suggested-adjustments',
			'nutrient-contributions'
		]::text[] = '{}'::jsonb
		and jsonb_typeof(section_disclosure_state -> 'nutrient-shape') = 'boolean'
		and jsonb_typeof(section_disclosure_state -> 'goals') = 'boolean'
		and jsonb_typeof(section_disclosure_state -> 'selected-ingredients') = 'boolean'
		and jsonb_typeof(section_disclosure_state -> 'add-ingredients') = 'boolean'
		and jsonb_typeof(section_disclosure_state -> 'warnings') = 'boolean'
		and jsonb_typeof(section_disclosure_state -> 'suggested-adjustments') = 'boolean'
		and jsonb_typeof(section_disclosure_state -> 'nutrient-contributions') = 'boolean'
	);

create or replace function public.save_mix_section_disclosure_state(
	p_section_disclosure_state jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_allowed_sections constant text[] := array[
		'nutrient-shape',
		'goals',
		'selected-ingredients',
		'add-ingredients',
		'warnings',
		'suggested-adjustments',
		'nutrient-contributions'
	]::text[];
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	if p_section_disclosure_state is null
		or jsonb_typeof(p_section_disclosure_state) <> 'object'
		or not (p_section_disclosure_state ?& v_allowed_sections)
		or p_section_disclosure_state - v_allowed_sections <> '{}'::jsonb
		or jsonb_typeof(p_section_disclosure_state -> 'nutrient-shape') <> 'boolean'
		or jsonb_typeof(p_section_disclosure_state -> 'goals') <> 'boolean'
		or jsonb_typeof(p_section_disclosure_state -> 'selected-ingredients') <> 'boolean'
		or jsonb_typeof(p_section_disclosure_state -> 'add-ingredients') <> 'boolean'
		or jsonb_typeof(p_section_disclosure_state -> 'warnings') <> 'boolean'
		or jsonb_typeof(p_section_disclosure_state -> 'suggested-adjustments') <> 'boolean'
		or jsonb_typeof(p_section_disclosure_state -> 'nutrient-contributions') <> 'boolean'
	then
		raise exception 'Mix section disclosure state must contain one boolean for every supported section.'
			using errcode = '22023';
	end if;

	insert into public.mix_preferences (user_id, section_disclosure_state)
	values (v_user_id, p_section_disclosure_state)
	on conflict (user_id) do update
	set section_disclosure_state = excluded.section_disclosure_state;

	return true;
end;
$$;

revoke all on function public.save_mix_section_disclosure_state(jsonb)
	from public, anon, authenticated;
grant execute on function public.save_mix_section_disclosure_state(jsonb)
	to authenticated, service_role;
