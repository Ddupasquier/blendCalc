alter table public.mix_preferences
	add column section_order text[] not null default array[
		'nutrient-shape',
		'goals',
		'selected-ingredients',
		'add-ingredients',
		'warnings',
		'suggested-adjustments',
		'nutrient-contributions'
	]::text[];

alter table public.mix_preferences
	add constraint mix_preferences_section_order_check
	check (
		cardinality(section_order) = 7
		and section_order <@ array[
			'nutrient-shape',
			'goals',
			'selected-ingredients',
			'add-ingredients',
			'warnings',
			'suggested-adjustments',
			'nutrient-contributions'
		]::text[]
		and array[
			'nutrient-shape',
			'goals',
			'selected-ingredients',
			'add-ingredients',
			'warnings',
			'suggested-adjustments',
			'nutrient-contributions'
		]::text[] <@ section_order
	);

create or replace function public.save_mix_section_order(p_section_order text[])
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
	if p_section_order is null
		or cardinality(p_section_order) <> cardinality(v_allowed_sections)
		or not (p_section_order <@ v_allowed_sections)
		or not (v_allowed_sections <@ p_section_order)
	then
		raise exception 'Mix section order must contain every supported section exactly once.'
			using errcode = '22023';
	end if;

	insert into public.mix_preferences (user_id, section_order)
	values (v_user_id, p_section_order)
	on conflict (user_id) do update
	set section_order = excluded.section_order;
	return true;
end;
$$;

revoke all on function public.save_mix_section_order(text[]) from public, anon, authenticated;
grant execute on function public.save_mix_section_order(text[]) to authenticated, service_role;
