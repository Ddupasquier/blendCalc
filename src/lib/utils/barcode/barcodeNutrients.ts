import type {
	FoodNutrient,
	FoodNutrientMeasurementBasis,
	FoodNutrientQualitativeFact,
	FoodNutrientSourceReview,
} from "$lib/utils/food/types";
import type {
	NutrientSourceMapping,
	ProductReferenceCatalog,
} from "$lib/utils/food/reference/productReferenceCatalog";
import { canonicalizeProductNutrients } from "$lib/utils/food/reference/productReferenceCatalog";
import { normalizeNutrientUnitName } from "$lib/utils/food/nutrients/nutrientUnitNames";
import { toFiniteNonnegativeNumber } from "$lib/utils/numbers/finiteNumbers";

export type OpenFoodFactsNutriments = Record<
	string,
	number | string | undefined
>;

export const normalizeNutrientUnit = normalizeNutrientUnitName;

const toOptionalNumber = (value: unknown) => {
	if (value === undefined || value === null || value === "") return null;
	return toFiniteNonnegativeNumber(value);
};

export const getOpenFoodFactsValue = (
	nutriments: OpenFoodFactsNutriments,
	keys: string[],
	servingWeightGrams: number | null,
	useServingValues: boolean,
) => {
	for (const key of keys) {
		if (String(nutriments[`${key}_modifier`] ?? "").trim()) continue;
		const servingValue = toOptionalNumber(nutriments[`${key}_serving`]);
		if (useServingValues && servingValue !== null) {
			return { key, value: servingValue, basis: "serving" as const };
		}

		const per100GramValue = toOptionalNumber(nutriments[`${key}_100g`]);
		if (per100GramValue !== null) {
			return {
				key,
				value:
					useServingValues && servingWeightGrams !== null
						? (per100GramValue * servingWeightGrams) / 100
						: per100GramValue,
				basis:
					useServingValues && servingWeightGrams !== null
						? ("serving" as const)
						: ("mass-100g" as const),
			};
		}
	}

	return null;
};

const OPEN_FOOD_FACTS_BELOW_LIMIT_MODIFIERS = new Set(["<", "≤"]);

export const mapOpenFoodFactsQualitativeNutrients = (
	nutriments: OpenFoodFactsNutriments,
	nutritionDataPer: string | undefined,
	productReferenceCatalog: ProductReferenceCatalog,
	servingMeasurementBasis: FoodNutrientMeasurementBasis,
): FoodNutrientQualitativeFact[] => {
	const normalizedBasis = nutritionDataPer?.trim().toLocaleLowerCase();
	if (normalizedBasis !== "serving" && normalizedBasis !== "100g") return [];

	const mappedNutrientIds = new Set<number>();
	const facts: FoodNutrientQualitativeFact[] = [];
	for (const mapping of productReferenceCatalog.nutrientMappings
		.filter((item) => item.sourceKey === "open-food-facts")
		.sort((left, right) => left.priority - right.priority)) {
		if (mappedNutrientIds.has(mapping.nutrientId)) continue;
		const modifier = String(
			nutriments[`${mapping.sourceNutrientKey}_modifier`] ?? "",
		).trim();
		if (!OPEN_FOOD_FACTS_BELOW_LIMIT_MODIFIERS.has(modifier)) continue;
		const sourceValue = toOptionalNumber(
			nutriments[`${mapping.sourceNutrientKey}_value`] ??
				nutriments[mapping.sourceNutrientKey],
		);
		if (sourceValue === null) continue;
		const sourceUnit = String(
			nutriments[`${mapping.sourceNutrientKey}_unit`] ?? mapping.sourceUnitName,
		);
		const maximumAmount = convertMappedValue({
			value: sourceValue,
			sourceUnit,
			mapping,
			productReferenceCatalog,
		});
		if (maximumAmount === null) continue;

		mappedNutrientIds.add(mapping.nutrientId);
		facts.push({
			nutrientId: mapping.nutrientId,
			nutrientName: mapping.nutrientName,
			nutrientNumber: mapping.nutrientNumber,
			unitName: mapping.unitName,
			status: "below-reporting-threshold",
			statement: `${modifier}${sourceValue} ${sourceUnit}`,
			maximumAmount,
			measurementBasis:
				normalizedBasis === "serving"
					? servingMeasurementBasis
					: { kind: "mass", quantity: 100, unitKey: "g" },
			source: "open-food-facts",
			confidence: "unknown",
			sourceNutrientKey: mapping.sourceNutrientKey,
			sourceNutrientCode: mapping.sourceNutrientKey,
			mappingStatus: "canonical",
			mappingMethod: mapping.mappingMethod,
			mappingReviewReference: mapping.mappingReviewReference,
		});
	}

	return facts;
};

const convertMappedValue = ({
	value,
	sourceUnit,
	mapping,
	productReferenceCatalog,
}: {
	value: number;
	sourceUnit: string;
	mapping: NutrientSourceMapping;
	productReferenceCatalog: ProductReferenceCatalog;
}) => {
	const fromUnit = normalizeNutrientUnit(sourceUnit || mapping.sourceUnitName);
	const toUnit = normalizeNutrientUnit(mapping.unitName);
	if (!fromUnit || fromUnit === toUnit) return value;

	const conversion = productReferenceCatalog.nutrientConversions.find(
		(candidate) =>
			candidate.sourceKey === mapping.sourceKey &&
			candidate.nutrientId === mapping.nutrientId &&
			normalizeNutrientUnit(candidate.fromUnitName) === fromUnit &&
			normalizeNutrientUnit(candidate.toUnitName) === toUnit,
	);
	return conversion ? value * conversion.multiplier : null;
};

export const mapOpenFoodFactsNutrients = (
	nutriments: OpenFoodFactsNutriments,
	servingWeightGrams: number | null,
	useServingValues: boolean,
	productReferenceCatalog: ProductReferenceCatalog,
	measurementBasis: FoodNutrientMeasurementBasis = {
		kind: "mass",
		quantity: 100,
		unitKey: "g",
	},
): FoodNutrient[] => {
	const mappings = productReferenceCatalog.nutrientMappings
		.filter((mapping) => mapping.sourceKey === "open-food-facts")
		.sort((left, right) => left.priority - right.priority);
	const mappedNutrientIds = new Set<number>();
	const nutrients: FoodNutrient[] = [];

	for (const mapping of mappings) {
		if (mappedNutrientIds.has(mapping.nutrientId)) continue;
		const source = getOpenFoodFactsValue(
			nutriments,
			[mapping.sourceNutrientKey],
			servingWeightGrams,
			useServingValues,
		);
		if (!source) continue;

		const reportedSourceUnit = String(nutriments[`${source.key}_unit`] ?? "");
		if (
			reportedSourceUnit.trim() &&
			normalizeNutrientUnit(reportedSourceUnit) !==
				normalizeNutrientUnit(mapping.sourceUnitName)
		) {
			continue;
		}
		const sourceUnit = reportedSourceUnit || mapping.sourceUnitName;
		const value = convertMappedValue({
			value: source.value,
			sourceUnit,
			mapping,
			productReferenceCatalog,
		});
		if (value === null) continue;

		mappedNutrientIds.add(mapping.nutrientId);
		nutrients.push({
			nutrientId: mapping.nutrientId,
			nutrientName: mapping.nutrientName,
			nutrientNumber: mapping.nutrientNumber,
			unitName: mapping.unitName,
			value,
			measurementBasis:
				source.basis === "serving"
					? measurementBasis
					: { kind: "mass", quantity: 100, unitKey: "g" },
			valueOrigin: "reported",
			valueStatus: value === 0 ? "reported-zero" : "reported",
			source: "open-food-facts",
			confidence: "unknown",
			sourceNutrientKey: source.key,
			sourceNutrientCode: source.key,
			mappingStatus: "canonical",
			mappingMethod: mapping.mappingMethod,
			mappingReviewReference: mapping.mappingReviewReference,
		});
	}

	return canonicalizeProductNutrients(nutrients, productReferenceCatalog);
};

const OPEN_FOOD_FACTS_NON_NUTRIENT_KEYS = [
	// Alcohol by volume has a separate reviewed product field and is not nutrient math.
	/^alcohol$/i,
	/^carbon-footprint/i,
	/^ecoscore/i,
	/^environmental-score/i,
	/^fruits-vegetables-/i,
	/^nova-group$/i,
	/^nutrition-score/i,
];

const getOpenFoodFactsSourceKeys = (nutriments: OpenFoodFactsNutriments) =>
	new Set(
		Object.keys(nutriments).flatMap((key) => {
			const match = key.match(/^(.+)_(?:100g|serving)$/);
			return match?.[1] ? [match[1]] : [];
		}),
	);

const formatOpenFoodFactsNutrientName = (sourceKey: string) =>
	sourceKey
		.replaceAll("-", " ")
		.replace(/\b\w/g, (character) => character.toUpperCase());

/**
 * Retains usable Open Food Facts values that could not safely enter canonical
 * nutrition math. The result is private review evidence, never a calculation input.
 */
export const mapOpenFoodFactsNutrientSourceReview = (
	nutriments: OpenFoodFactsNutriments,
	useServingValues: boolean,
	productReferenceCatalog: ProductReferenceCatalog,
	servingMeasurementBasis: FoodNutrientMeasurementBasis,
): FoodNutrientSourceReview[] => {
	const mappings = productReferenceCatalog.nutrientMappings
		.filter((mapping) => mapping.sourceKey === "open-food-facts")
		.sort((left, right) => left.priority - right.priority);
	const acceptedSourceKeys = new Set<string>();

	for (const mapping of mappings) {
		const source = getOpenFoodFactsValue(
			nutriments,
			[mapping.sourceNutrientKey],
			null,
			useServingValues,
		);
		if (!source) continue;
		const reportedUnit = String(nutriments[`${source.key}_unit`] ?? "");
		if (
			reportedUnit.trim() &&
			normalizeNutrientUnit(reportedUnit) !==
				normalizeNutrientUnit(mapping.sourceUnitName)
		) {
			continue;
		}
		const converted = convertMappedValue({
			value: source.value,
			sourceUnit: reportedUnit || mapping.sourceUnitName,
			mapping,
			productReferenceCatalog,
		});
		if (converted !== null) acceptedSourceKeys.add(source.key);
	}

	return [...getOpenFoodFactsSourceKeys(nutriments)].flatMap((sourceKey) => {
		if (
			acceptedSourceKeys.has(sourceKey) ||
			OPEN_FOOD_FACTS_NON_NUTRIENT_KEYS.some((pattern) =>
				pattern.test(sourceKey),
			) ||
			String(nutriments[`${sourceKey}_modifier`] ?? "").trim()
		) {
			return [];
		}

		const servingAmount = toOptionalNumber(nutriments[`${sourceKey}_serving`]);
		const amountPer100g = toOptionalNumber(nutriments[`${sourceKey}_100g`]);
		const useServing = useServingValues && servingAmount !== null;
		const amount = useServing ? servingAmount : amountPer100g;
		if (amount === null) return [];

		const relatedMapping = mappings.find(
			(mapping) => mapping.sourceNutrientKey === sourceKey,
		);
		const unitName = String(
			nutriments[`${sourceKey}_unit`] ?? relatedMapping?.sourceUnitName ?? "",
		).trim();
		// Unitless provider scores and computed metadata are not nutrient amounts.
		if (!unitName && !relatedMapping) return [];

		return [
			{
				...(relatedMapping ? { nutrientId: relatedMapping.nutrientId } : {}),
				nutrientName:
					relatedMapping?.sourceNutrientName?.trim() ||
					formatOpenFoodFactsNutrientName(sourceKey),
				...(unitName ? { unitName } : {}),
				amount,
				measurementBasis: useServing
					? servingMeasurementBasis
					: { kind: "mass" as const, quantity: 100, unitKey: "g" },
				...(!useServing && amountPer100g !== null ? { amountPer100g } : {}),
				valueStatus:
					amount === 0 ? ("reported-zero" as const) : ("reported" as const),
				mappingStatus: "unmapped" as const,
				mappingMethod: relatedMapping
					? "reported-unit-or-conversion-not-approved"
					: "source-key-awaiting-review",
				sourceNutrientKey: sourceKey,
				sourceNutrientCode: sourceKey,
				source: "open-food-facts" as const,
			},
		];
	});
};
