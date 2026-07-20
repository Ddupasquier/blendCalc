import type { FdcNutrient } from "$lib/utils/food/types";
import type {
	NutrientSourceMapping,
	ProductReferenceData,
} from "$lib/utils/food/reference/productReferenceData";
import { toFiniteNonnegativeNumber } from "$lib/utils/numbers/finiteNumbers";

export type OpenFoodFactsNutriments = Record<
	string,
	number | string | undefined
>;

export const normalizeNutrientUnit = (unit: unknown) =>
	String(unit ?? "")
		.trim()
		.toUpperCase()
		.replaceAll("Μ", "U")
		.replaceAll("µ", "U")
		.replace("MCG", "UG");

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
	referenceData,
}: {
	value: number;
	sourceUnit: string;
	mapping: NutrientSourceMapping;
	referenceData: ProductReferenceData;
}) => {
	const fromUnit = normalizeNutrientUnit(sourceUnit || mapping.sourceUnitName);
	const toUnit = normalizeNutrientUnit(mapping.unitName);
	if (!fromUnit || fromUnit === toUnit) return value;

	const conversion = referenceData.nutrientConversions.find(
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
	referenceData: ProductReferenceData,
): FdcNutrient[] => {
	const mappings = referenceData.nutrientMappings
		.filter((mapping) => mapping.sourceKey === "open-food-facts")
		.sort((left, right) => left.priority - right.priority);
	const mappedNutrientIds = new Set<number>();
	const nutrients: FdcNutrient[] = [];

	for (const mapping of mappings) {
		if (mappedNutrientIds.has(mapping.nutrientId)) continue;
		const source = getOpenFoodFactsValue(
			nutriments,
			[mapping.sourceNutrientKey],
			servingWeightGrams,
			useServingValues,
		);
		if (!source) continue;

		const sourceUnit = String(
			nutriments[`${source.key}_unit`] ?? mapping.sourceUnitName,
		);
		const value = convertMappedValue({
			value: source.value,
			sourceUnit,
			mapping,
			referenceData,
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
			source: "open-food-facts",
			confidence: "unknown",
		});
	}

	return nutrients;
};
