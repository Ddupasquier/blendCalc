import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import {
	normalizeServingMeasureAlias,
	type ServingMeasureCatalog,
	type ServingMeasureDimension,
} from "$lib/utils/serving/servingMeasureCatalog";

export const readServingMeasureCatalog = async (
	supabase: SupabaseClient<Database>,
): Promise<ServingMeasureCatalog> => {
	const [unitsResult, aliasesResult] = await Promise.all([
		supabase
			.from("serving_measure_units")
			.select(
				"key, display_label, short_label, dimension, conversion_to_base, is_default, display_order",
			)
			.eq("enabled", true)
			.order("display_order", { ascending: true }),
		supabase
			.from("serving_measure_aliases")
			.select("unit_key, alias, normalized_alias"),
	]);

	if (unitsResult.error) throw unitsResult.error;
	if (aliasesResult.error) throw aliasesResult.error;

	const options = (unitsResult.data ?? []).flatMap((row) => {
		if (row.dimension !== "weight" && row.dimension !== "volume") return [];
		return [{
			value: row.key,
			label: row.display_label,
			shortLabel: row.short_label,
			dimension: row.dimension as ServingMeasureDimension,
			conversionToBase: Number(row.conversion_to_base),
			isDefault: row.is_default,
		}];
	});

	const enabledUnits = new Set(options.map((option) => option.value));
	const aliases = Object.fromEntries(
		(aliasesResult.data ?? []).flatMap((row) =>
			enabledUnits.has(row.unit_key)
				? [[normalizeServingMeasureAlias(row.normalized_alias), row.unit_key]]
				: [],
		),
	);
	const aliasEntries = (aliasesResult.data ?? []).flatMap((row) =>
		enabledUnits.has(row.unit_key)
			? [{ alias: row.alias, unit: row.unit_key }]
			: [],
	);
	for (const option of options) {
		aliases[normalizeServingMeasureAlias(option.value)] = option.value;
		aliases[normalizeServingMeasureAlias(option.shortLabel)] = option.value;
		aliasEntries.push(
			{ alias: option.value, unit: option.value },
			{ alias: option.shortLabel, unit: option.value },
		);
	}

	return { options, aliases, aliasEntries };
};
