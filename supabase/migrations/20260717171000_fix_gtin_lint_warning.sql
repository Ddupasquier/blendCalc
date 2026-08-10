create or replace function public.is_valid_gtin(p_value text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
	v_length integer := length(p_value);
	v_sum integer := 0;
	v_expected_check_digit integer;
begin
	if p_value !~ '^[0-9]+$' or v_length not in (8, 12, 13, 14) then
		return false;
	end if;

	for v_position in 1..(v_length - 1) loop
		v_sum := v_sum
			+ substring(p_value from v_position for 1)::integer
				* case
					when mod(v_length - 1 - v_position, 2) = 0 then 3
					else 1
				end;
	end loop;

	v_expected_check_digit := mod(10 - mod(v_sum, 10), 10);
	return substring(p_value from v_length for 1)::integer = v_expected_check_digit;
end;
$$;

revoke all on function public.is_valid_gtin(text) from public, anon, authenticated;
