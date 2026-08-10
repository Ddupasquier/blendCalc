create function public.apply_food_serving_label_measure()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_match text[];
	v_amount numeric;
	v_alias text;
	v_unit_key text;
	v_current_dimension text;
	v_denominator numeric;
begin
	if new.label is null or btrim(new.label) = '' then
		return new;
	end if;

	if new.unit_key is not null then
		select unit.dimension
		into v_current_dimension
		from public.serving_measure_units unit
		where unit.key = new.unit_key;
	end if;
	if v_current_dimension = 'volume' then
		return new;
	end if;

	v_match := regexp_match(
		lower(btrim(new.label)),
		'^([0-9]+)[[:space:]]+([0-9]+)[[:space:]]*/[[:space:]]*([0-9]+)[[:space:]]+(.+)$'
	);
	if v_match is not null then
		v_denominator := v_match[3]::numeric;
		if v_denominator > 0 then
			v_amount := v_match[1]::numeric + (v_match[2]::numeric / v_denominator);
			v_alias := v_match[4];
		end if;
	end if;

	if v_amount is null then
		v_match := regexp_match(
			lower(btrim(new.label)),
			'^([0-9]+)[[:space:]]*/[[:space:]]*([0-9]+)[[:space:]]+(.+)$'
		);
		if v_match is not null then
			v_denominator := v_match[2]::numeric;
			if v_denominator > 0 then
				v_amount := v_match[1]::numeric / v_denominator;
				v_alias := v_match[3];
			end if;
		end if;
	end if;

	if v_amount is null then
		v_match := regexp_match(
			lower(btrim(new.label)),
			'^([0-9]+(\.[0-9]+)?)[[:space:]]+(.+)$'
		);
		if v_match is not null then
			v_amount := v_match[1]::numeric;
			v_alias := v_match[3];
		end if;
	end if;

	if v_amount is null or v_amount <= 0 or v_alias is null then
		return new;
	end if;

	select alias.unit_key
	into v_unit_key
	from public.serving_measure_aliases alias
	join public.serving_measure_units unit
		on unit.key = alias.unit_key
	where alias.normalized_alias = lower(regexp_replace(
		replace(btrim(v_alias), '.', ''),
		'[[:space:]]+',
		'',
		'g'
	))
		and unit.enabled
		and unit.dimension = 'volume'
	limit 1;

	if v_unit_key is not null then
		new.amount := v_amount;
		new.unit_key := v_unit_key;
	end if;

	return new;
end;
$$;

revoke all on function public.apply_food_serving_label_measure()
	from public, anon, authenticated;
grant execute on function public.apply_food_serving_label_measure()
	to service_role;

create trigger apply_food_serving_label_measure
	before insert or update of label, gram_weight, amount, unit_key
	on public.food_servings
	for each row execute function public.apply_food_serving_label_measure();

update public.food_servings
set label = label
where btrim(label) <> '';
