import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import type { NutrientDefinitionReferenceRecord } from "$lib/utils/food/nutrients/nutrientDefinitionRecord";

export type ProductDataSource = {
	key: string;
	displayName: string;
	attributionText: string | null;
	canonicalStorageAllowed?: boolean;
	canonicalLicenseName?: string | null;
};

export type CanonicalNutrientDefinition = {
	nutrientId: number;
	nutrientName: string;
	nutrientNumber: string;
	unitName: string;
};

export type NutrientSourceMapping = CanonicalNutrientDefinition & {
	sourceKey: string;
	sourceNutrientKey: string;
	sourceNutrientName: string | null;
	sourceUnitName: string;
	priority: number;
};

export type NutrientUnitConversion = {
	sourceKey: string;
	nutrientId: number;
	fromUnitName: string;
	toUnitName: string;
	multiplier: number;
};

export type ProductReferenceData = {
	sources: Record<string, ProductDataSource>;
	nutrientMappings: NutrientSourceMapping[];
	nutrientConversions: NutrientUnitConversion[];
};

export const readProductReferenceData = async (
	supabase: SupabaseClient<Database>,
	nutrientDefinitions?: NutrientDefinitionReferenceRecord[],
): Promise<ProductReferenceData> => {
	const definitionsPromise = nutrientDefinitions
		? Promise.resolve({ data: nutrientDefinitions, error: null })
		: supabase
				.from("nutrient_definitions")
				.select(
					"nutrient_id, nutrient_name, nutrient_number, default_unit_name",
				);
	const [sourcesResult, mappingsResult, conversionsResult, definitionsResult] =
		await Promise.all([
			supabase
				.from("product_data_sources")
				.select(
					"key, display_name, attribution_text, canonical_storage_allowed, canonical_license_name",
				)
				.eq("enabled", true),
			supabase
				.from("nutrient_source_mappings")
				.select(
					"source_key, source_nutrient_key, source_nutrient_name, source_unit_name, nutrient_id, priority",
				)
				.eq("enabled", true)
				.eq("review_status", "approved")
				.order("priority", { ascending: true }),
			supabase
				.from("nutrient_unit_conversions")
				.select(
					"source_key, nutrient_id, from_unit_name, to_unit_name, multiplier",
				),
			definitionsPromise,
		]);

	if (sourcesResult.error) throw sourcesResult.error;
	if (mappingsResult.error) throw mappingsResult.error;
	if (conversionsResult.error) throw conversionsResult.error;
	if (definitionsResult.error) throw definitionsResult.error;

	const definitions = new Map(
		(definitionsResult.data ?? []).map((definition) => [
			definition.nutrient_id,
			definition,
		]),
	);

	return {
		sources: Object.fromEntries(
			(sourcesResult.data ?? []).map((source) => [
				source.key,
				{
					key: source.key,
					displayName: source.display_name,
					attributionText: source.attribution_text,
					canonicalStorageAllowed: source.canonical_storage_allowed,
					canonicalLicenseName: source.canonical_license_name,
				},
			]),
		),
		nutrientMappings: (mappingsResult.data ?? []).flatMap((mapping) => {
			const definition = definitions.get(mapping.nutrient_id);
			if (!definition) return [];
			return [{
				sourceKey: mapping.source_key,
				sourceNutrientKey: mapping.source_nutrient_key,
				sourceNutrientName: mapping.source_nutrient_name,
				sourceUnitName: mapping.source_unit_name,
				priority: mapping.priority,
				nutrientId: definition.nutrient_id,
				nutrientName: definition.nutrient_name,
				nutrientNumber: definition.nutrient_number ?? "",
				unitName: definition.default_unit_name,
			}];
		}),
		nutrientConversions: (conversionsResult.data ?? []).map((conversion) => ({
			sourceKey: conversion.source_key,
			nutrientId: conversion.nutrient_id,
			fromUnitName: conversion.from_unit_name,
			toUnitName: conversion.to_unit_name,
			multiplier: Number(conversion.multiplier),
		})),
	};
};

export const getProductDataSource = (
	referenceData: ProductReferenceData,
	key: string,
) => {
	const source = referenceData.sources[key];
	if (!source) throw new Error(`Product data source “${key}” is not configured.`);
	return source;
};
