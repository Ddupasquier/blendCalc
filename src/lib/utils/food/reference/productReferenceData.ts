import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import type { NutrientDefinitionReferenceRecord } from "$lib/utils/food/nutrients/nutrientDefinitionRecord";
import type { FdcNutrient } from "$lib/utils/food/types";

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
	mappingMethod?: string;
	mappingReviewReference?: string;
};

export type NutrientUnitConversion = {
	sourceKey: string;
	nutrientId: number;
	fromUnitName: string;
	toUnitName: string;
	multiplier: number;
};

export type ProductNutrientEquivalence = CanonicalNutrientDefinition & {
	sourceKey: string;
	sourceNutrientId: number | null;
	sourceNutrientNumber: string | null;
};

export type ProductReferenceData = {
	sources: Record<string, ProductDataSource>;
	nutrientMappings: NutrientSourceMapping[];
	nutrientConversions: NutrientUnitConversion[];
	nutrientEquivalences: ProductNutrientEquivalence[];
};

const CANONICAL_NUTRIENT_NAMESPACE = "usda";

const normalizeUnit = (value: string) =>
	value
		.trim()
		.toUpperCase()
		.replaceAll("Μ", "U")
		.replaceAll("µ", "U")
		.replace("MCG", "UG");

const findCanonicalNutrientDefinition = (
	equivalences: ProductNutrientEquivalence[],
	nutrientId: number,
	nutrientNumber?: string | null,
) =>
	equivalences.find(
		(equivalence) =>
			equivalence.sourceKey === CANONICAL_NUTRIENT_NAMESPACE &&
			((equivalence.sourceNutrientId !== null &&
				equivalence.sourceNutrientId === nutrientId) ||
				(equivalence.sourceNutrientNumber !== null &&
					equivalence.sourceNutrientNumber === nutrientNumber)),
	);

export const getCanonicalProductNutrientId = (
	referenceData: ProductReferenceData,
	nutrientId: number,
	nutrientNumber?: string | null,
) =>
	findCanonicalNutrientDefinition(
		referenceData.nutrientEquivalences,
		nutrientId,
		nutrientNumber,
	)?.nutrientId ?? nutrientId;

export const canonicalizeProductNutrients = (
	nutrients: FdcNutrient[],
	referenceData: ProductReferenceData,
) => {
	const canonicalTargetIds = new Set(
		referenceData.nutrientEquivalences
			.filter(
				(equivalence) =>
					equivalence.sourceKey === CANONICAL_NUTRIENT_NAMESPACE,
			)
			.map((equivalence) => equivalence.nutrientId),
	);
	const exactCanonicalIds = new Set(
		nutrients
			.map((nutrient) => Number(nutrient.nutrientId))
			.filter((nutrientId) => canonicalTargetIds.has(nutrientId)),
	);
	const emittedIds = new Set<number>();

	return nutrients.flatMap((nutrient) => {
		const nutrientId = Number(nutrient.nutrientId);
		const equivalence = findCanonicalNutrientDefinition(
			referenceData.nutrientEquivalences,
			nutrientId,
			nutrient.nutrientNumber,
		);
		const canonicalId = equivalence?.nutrientId ?? nutrientId;
		const isAlias = canonicalId !== nutrientId;

		if (
			(isAlias && exactCanonicalIds.has(canonicalId)) ||
			emittedIds.has(canonicalId)
		) {
			return [];
		}

		if (
			equivalence &&
			normalizeUnit(equivalence.unitName) !== normalizeUnit(nutrient.unitName)
		) {
			return [nutrient];
		}

		emittedIds.add(canonicalId);
		return [{
			...nutrient,
			...(equivalence
				? {
						nutrientId: equivalence.nutrientId,
						nutrientName: equivalence.nutrientName,
						nutrientNumber: equivalence.nutrientNumber,
						unitName: equivalence.unitName,
					}
				: {}),
		}];
	});
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
	const [
		sourcesResult,
		mappingsResult,
		conversionsResult,
		definitionsResult,
		equivalencesResult,
	] =
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
						"source_key, source_nutrient_key, source_nutrient_name, source_unit_name, nutrient_id, priority, mapping_method, review_reference",
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
			supabase
				.from("nutrient_equivalences")
				.select(
					"canonical_nutrient_id, source_nutrient_id, source_nutrient_number, source_key",
				)
				.eq("enabled", true),
		]);

	if (sourcesResult.error) throw sourcesResult.error;
	if (mappingsResult.error) throw mappingsResult.error;
	if (conversionsResult.error) throw conversionsResult.error;
	if (definitionsResult.error) throw definitionsResult.error;
	if (equivalencesResult.error) throw equivalencesResult.error;

	const definitions = new Map(
		(definitionsResult.data ?? []).map((definition) => [
			definition.nutrient_id,
			{
				nutrientId: definition.nutrient_id,
				nutrientName: definition.nutrient_name,
				nutrientNumber: definition.nutrient_number ?? "",
				unitName: definition.default_unit_name,
			},
		]),
	);
	const nutrientEquivalences = (equivalencesResult.data ?? []).flatMap(
		(equivalence) => {
			const definition = definitions.get(equivalence.canonical_nutrient_id);
			if (!definition) return [];
			return [{
				sourceKey: equivalence.source_key,
				sourceNutrientId: equivalence.source_nutrient_id,
				sourceNutrientNumber: equivalence.source_nutrient_number,
				...definition,
			}];
		},
	);
	const resolveDefinition = (
		nutrientId: number,
		nutrientNumber?: string | null,
	) => {
		const canonical = findCanonicalNutrientDefinition(
			nutrientEquivalences,
			nutrientId,
			nutrientNumber,
		);
		return canonical ?? definitions.get(nutrientId) ?? null;
	};

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
			const definition = resolveDefinition(mapping.nutrient_id);
			if (!definition) return [];
			return [{
				sourceKey: mapping.source_key,
				sourceNutrientKey: mapping.source_nutrient_key,
				sourceNutrientName: mapping.source_nutrient_name,
					sourceUnitName: mapping.source_unit_name,
					priority: mapping.priority,
					mappingMethod: mapping.mapping_method,
					mappingReviewReference: mapping.review_reference ?? undefined,
					...definition,
			}];
		}),
		nutrientConversions: (conversionsResult.data ?? []).map((conversion) => {
			const definition = resolveDefinition(conversion.nutrient_id);
			return {
				sourceKey: conversion.source_key,
				nutrientId: definition?.nutrientId ?? conversion.nutrient_id,
				fromUnitName: conversion.from_unit_name,
				toUnitName: conversion.to_unit_name,
				multiplier: Number(conversion.multiplier),
			};
		}),
		nutrientEquivalences,
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
