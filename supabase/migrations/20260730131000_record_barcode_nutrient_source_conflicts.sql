create temporary table nutrition_audit_source_conflicts (
	barcode text not null,
	usda_fdc_id bigint not null,
	nutrient_id bigint not null,
	unit_name text not null,
	usda_value numeric not null,
	open_food_facts_value numeric not null,
	relative_difference numeric not null,
	primary key (barcode, nutrient_id)
) on commit drop;

insert into nutrition_audit_source_conflicts (
	barcode,
	usda_fdc_id,
	nutrient_id,
	unit_name,
	usda_value,
	open_food_facts_value,
	relative_difference
)
values
	('00000000772914', 373595, 1093, 'MG', 59, 40, 0.3220338983050847),
	('00000000772914', 373595, 1258, 'G', 3.52, 4.66666666666667, 0.2457142857142862),
	('00000000772914', 373595, 1003, 'G', 4.85, 3.33333333333333, 0.31271477663230307),
	('00011110863065', 2029618, 1008, 'KCAL', 857, 6428.57142857143, 0.866688888888889),
	('00011110863065', 2029618, 1258, 'G', 92.86, 663.285714285714, 0.86),
	('00011110863065', 2029618, 1004, 'G', 100, 714.285714285714, 0.86),
	('00011110863065', 2029618, 1292, 'G', 7.14, 51, 0.86),
	('00032792008827', 2038222, 1005, 'G', 46.43, 163.777138926612, 0.7165049999999992),
	('00032792008827', 2038222, 1258, 'G', 7.14, 25.1856293761795, 0.7165050000000003),
	('00032792008827', 2038222, 2000, 'G', 3.57, 12.5928146880897, 0.7165049999999992),
	('00032792008827', 2038222, 1008, 'KCAL', 536, 1839.15060230339, 0.708561115479775),
	('00032792008827', 2038222, 1004, 'G', 35.71, 125.96342087162, 0.7165049999999993),
	('00032792008827', 2038222, 1257, 'G', 7.14, 25.1856293761795, 0.7165050000000003),
	('00032792008827', 2038222, 1093, 'MG', 786, 2.77253567082312, 0.996472600927706),
	('00032792008827', 2038222, 1003, 'G', 3.57, 12.5928146880897, 0.7165049999999992),
	('00032792008827', 2038222, 1079, 'G', 3.6, 12.6986366602586, 0.716505000000001),
	('00084114902047', 2696787, 1258, 'G', 3.57, 1, 0.7198879551820728),
	('00084114902047', 2696787, 1003, 'G', 7.14, 2, 0.7198879551820728),
	('00084114902047', 2696787, 1005, 'G', 53.57, 15, 0.719992533134217),
	('00084114902047', 2696787, 2000, 'G', 3.57, 1, 0.7198879551820728),
	('00084114902047', 2696787, 1004, 'G', 32.14, 9, 0.7199751088985687),
	('00084114902047', 2696787, 1079, 'G', 7.1, 2, 0.7183098591549295),
	('00084114902047', 2696787, 1093, 'MG', 607, 170, 0.7199341021416804),
	('08801005523455', 2040099, 1258, 'G', 1.67, 0, 1),
	('08801005523455', 2040099, 1004, 'G', 3.33, 0, 1),
	('08801005523455', 2040099, 1005, 'G', 10, 44.4444444444444, 0.775),
	('08801005523455', 2040099, 1079, 'G', 3.3, 5.55555555555556, 0.40600000000000047),
	('08801005523455', 2040099, 2000, 'G', 6.67, 27.7777777777778, 0.7598800000000001),
	('08801005523455', 2040099, 1008, 'KCAL', 100, 222.222222222222, 0.55);

insert into public.shared_product_conflicts (
	shared_product_id,
	barcode,
	field_path,
	observed_values,
	severity,
	status
)
select
	product.id,
	conflict.barcode,
	'nutrient:' || conflict.nutrient_id::text,
	jsonb_build_array(
		jsonb_build_object(
			'source', 'usda',
			'sourceReference', conflict.usda_fdc_id::text,
			'value', conflict.usda_value,
			'unitName', conflict.unit_name,
			'basis', 'per 100 g',
			'relativeDifference', conflict.relative_difference,
			'audit', 'barcode-nutrition-accuracy'
		),
		jsonb_build_object(
			'source', 'open-food-facts',
			'sourceReference', conflict.barcode,
			'value', conflict.open_food_facts_value,
			'unitName', conflict.unit_name,
			'basis', 'per 100 g',
			'relativeDifference', conflict.relative_difference,
			'audit', 'barcode-nutrition-accuracy'
		)
	),
	case
		when conflict.relative_difference >= 0.5 then 'high'
		else 'medium'
	end,
	'open'
from nutrition_audit_source_conflicts conflict
join public.shared_products product
	on product.barcode = conflict.barcode
where product.status = 'active'
	and not exists (
		select 1
		from public.shared_product_conflicts existing
		where existing.shared_product_id = product.id
			and existing.field_path =
				'nutrient:' || conflict.nutrient_id::text
			and existing.status = 'open'
	);

do $$
declare
	v_expected_conflicts integer;
	v_recorded_conflicts integer;
begin
	select count(*)
	into v_expected_conflicts
	from nutrition_audit_source_conflicts conflict
	join public.shared_products product
		on product.barcode = conflict.barcode
	where product.status = 'active';

	select count(*)
	into v_recorded_conflicts
	from nutrition_audit_source_conflicts conflict
	join public.shared_products product
		on product.barcode = conflict.barcode
	join public.shared_product_conflicts recorded
		on recorded.shared_product_id = product.id
		and recorded.field_path =
			'nutrient:' || conflict.nutrient_id::text
		and recorded.status = 'open';

	if v_recorded_conflicts <> v_expected_conflicts then
		raise exception
			'Expected % tracked nutrient conflicts but found %',
			v_expected_conflicts,
			v_recorded_conflicts;
	end if;
end;
$$;
