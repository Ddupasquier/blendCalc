import type {
	FoodNutrient,
	FoodNutrientMeasurementBasis,
	FoodNutrientQualitativeFact,
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
