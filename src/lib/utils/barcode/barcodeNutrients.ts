import type { FoodNutrient } from "$lib/utils/food/types";
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
	servingWeightGrams: number,
	useServingValues: boolean,
) => {
	for (const key of keys) {
		const servingValue = toOptionalNumber(nutriments[`${key}_serving`]);
		if (useServingValues && servingValue !== null) {
			return { key, value: servingValue };
		}

		const per100GramValue = toOptionalNumber(nutriments[`${key}_100g`]);
		if (per100GramValue !== null) {
			return {
				key,
				value: (per100GramValue * servingWeightGrams) / 100,
			};
		}
	}

	return null;
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
	servingWeightGrams: number,
	useServingValues: boolean,
	productReferenceCatalog: ProductReferenceCatalog,
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

		const reportedSourceUnit = String(
			nutriments[`${source.key}_unit`] ?? "",
		);
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
