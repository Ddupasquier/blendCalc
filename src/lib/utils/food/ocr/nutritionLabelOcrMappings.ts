import { getSupabaseBrowserClient } from "$lib/supabase/client";
import type { Database } from "$lib/types/database.types";
import type { NutritionLabelOcrMapping } from "$lib/utils/food/ocr/nutritionLabelOcr";
export type { NutritionLabelOcrMapping } from "$lib/utils/food/ocr/nutritionLabelOcr";
import type { SupabaseClient } from "@supabase/supabase-js";

type SourceMappingRow = Pick<
	Database["public"]["Tables"]["nutrient_source_mappings"]["Row"],
	"source_nutrient_key" | "source_unit_name" | "nutrient_id" | "priority"
>;

type NutrientDefinitionRow = Pick<
	Database["public"]["Tables"]["nutrient_definitions"]["Row"],
	"nutrient_id" | "nutrient_name" | "default_unit_name"
>;

type UnitConversionRow = Pick<
	Database["public"]["Tables"]["nutrient_unit_conversions"]["Row"],
	"nutrient_id" | "from_unit_name" | "to_unit_name" | "multiplier"
>;

const OCR_SOURCE_KEY = "nutrition-label-ocr";

export const readNutritionLabelOcrMappings = async (
	supabase: SupabaseClient<Database> | null = getSupabaseBrowserClient(),
): Promise<NutritionLabelOcrMapping[] | null> => {
	if (!supabase) return null;

	const { data: mappings, error: mappingError } = await supabase
		.from("nutrient_source_mappings")
		.select("source_nutrient_key, source_unit_name, nutrient_id, priority")
		.eq("source_key", OCR_SOURCE_KEY)
		.eq("enabled", true)
		.eq("review_status", "approved")
		.order("priority", { ascending: true });
	if (mappingError || !mappings?.length) return null;

	const nutrientIds = [
		...new Set((mappings as SourceMappingRow[]).map((mapping) => mapping.nutrient_id)),
	];
	const [definitionsResult, conversionsResult] = await Promise.all([
		supabase
			.from("nutrient_definitions")
			.select("nutrient_id, nutrient_name, default_unit_name")
			.in("nutrient_id", nutrientIds),
		supabase
			.from("nutrient_unit_conversions")
			.select("nutrient_id, from_unit_name, to_unit_name, multiplier")
			.eq("source_key", OCR_SOURCE_KEY)
			.in("nutrient_id", nutrientIds),
	]);
	if (definitionsResult.error || conversionsResult.error) return null;

	const definitionsById = new Map(
		((definitionsResult.data ?? []) as NutrientDefinitionRow[]).map((definition) => [
			definition.nutrient_id,
			definition,
		]),
	);
	const conversions = (conversionsResult.data ?? []) as UnitConversionRow[];

	return (mappings as SourceMappingRow[]).flatMap<NutritionLabelOcrMapping>(
		(mapping) => {
			const definition = definitionsById.get(mapping.nutrient_id);
			if (!definition) return [];
			const conversion = conversions.find(
				(item) =>
					item.nutrient_id === mapping.nutrient_id &&
					item.from_unit_name.toUpperCase() === mapping.source_unit_name.toUpperCase() &&
					item.to_unit_name.toUpperCase() === definition.default_unit_name.toUpperCase(),
			);
			return [
				{
					alias: mapping.source_nutrient_key,
					sourceUnitName: mapping.source_unit_name,
					nutrientId: mapping.nutrient_id,
					nutrientName: definition.nutrient_name,
					targetUnitName: definition.default_unit_name,
					priority: mapping.priority,
					conversionMultiplier: conversion ? Number(conversion.multiplier) : null,
				},
			];
		},
	);
};
