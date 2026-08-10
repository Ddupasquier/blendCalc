do $migration$
declare
	v_definition text;
begin
	select pg_get_functiondef(
		'public.prepare_custom_food_record()'::regprocedure
	)
	into v_definition;

	if position('select rule.message' in v_definition) = 0 then
		raise exception
			'prepare_custom_food_record does not contain the expected legacy relationship message lookup';
	end if;

	execute replace(
		v_definition,
		'select rule.message',
		'select rule.issue_code'
	);
end;
$migration$;

comment on function public.prepare_custom_food_record() is
	'Validates authoritative personal-food writes and raises stable nutrient relationship issue codes rather than removed database-owned UI messages.';
