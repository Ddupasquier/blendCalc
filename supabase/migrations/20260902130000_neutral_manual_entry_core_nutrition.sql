update public.nutrient_manual_entry_groups
set title = 'Core nutrition',
	updated_at = timezone('utc'::text, now())
where id = 'required-basics';

do $$
begin
	if not exists (
		select 1
		from public.nutrient_manual_entry_groups
		where id = 'required-basics'
			and title = 'Core nutrition'
	) then
		raise exception 'required-basics manual-entry group was not updated';
	end if;
end;
$$;
