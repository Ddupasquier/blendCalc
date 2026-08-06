import type { FdcFood, FdcNutrient } from "$lib/utils/food/types";
import { getConfiguredAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";

export type FdcNutrientSource = "exact" | "fallback" | "derived" | "missing";

export type ResolvedFdcNutrient = {
	nutrient: FdcNutrient | null;
	value: number | null;
	source: FdcNutrientSource;
};

export const findFdcNutrient = (food: FdcFood, nutrientId: number) => {
	return food.foodNutrients.find((nutrient) =>
		isFdcNutrientMatch(nutrient, nutrientId, food.sourceKey),
	);
};

export const getFdcNutrientValue = (food: FdcFood, nutrientId: number) => {
	return resolveFdcNutrient(food, nutrientId).value;
};

export const resolveFdcNutrient = (
	food: FdcFood,
	nutrientId: number,
): ResolvedFdcNutrient => {
	const exact = food.foodNutrients.find(
		(nutrient) => Number(nutrient.nutrientId) === nutrientId,
	);

	if (exact) {
		return { nutrient: exact, value: exact.value, source: "exact" };
	}

	const fallback = food.foodNutrients.find((nutrient) =>
		matchesEquivalentNutrient(nutrient, nutrientId, food.sourceKey),
	);

	if (fallback) {
		return {
			nutrient: fallback,
			value: fallback.value,
			source: "fallback",
		};
	}

	return { nutrient: null, value: null, source: "missing" };
};

export const isFdcNutrientMatch = (
	nutrient: FdcNutrient,
	nutrientId: number,
	foodSourceKey?: string,
) => {
	if (Number(nutrient.nutrientId) === nutrientId) return true;

	return matchesEquivalentNutrient(nutrient, nutrientId, foodSourceKey);
};

const matchesEquivalentNutrient = (
	nutrient: FdcNutrient,
	nutrientId: number,
	foodSourceKey?: string,
) => {
	const sourceKey = nutrient.source ?? foodSourceKey ?? "unknown";
	return getConfiguredAppReferenceCatalog().nutrientEquivalences.some(
		(equivalence) =>
			equivalence.canonicalNutrientId === nutrientId &&
			equivalence.sourceKey === sourceKey &&
			((equivalence.sourceNutrientId !== null &&
				Number(nutrient.nutrientId) === equivalence.sourceNutrientId) ||
				(equivalence.sourceNutrientNumber !== null &&
					String(nutrient.nutrientNumber) ===
						equivalence.sourceNutrientNumber)),
	);
};
