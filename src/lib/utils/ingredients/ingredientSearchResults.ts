import type { FdcFood } from "$lib/utils/food/types";
import { compareFoodQuality } from "$lib/utils/food/quality/foodQuality";
import { createIngredientSearchRelevanceComparator } from "$lib/utils/ingredients/ingredientSearchRelevance";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
import { getFoodDownrankScore } from "$lib/utils/profile/foodPreferenceWarnings";

export const mergeIngredientSearchResults = (...resultGroups: FdcFood[][]) => {
	const seen = new Set<number>();
	const seenBarcodes = new Set<string>();

	return resultGroups.flat().filter((food) => {
		if (seen.has(food.fdcId)) return false;
		const barcode = food.barcode ?? food.gtinUpc;
		if (barcode && seenBarcodes.has(barcode)) return false;
		seen.add(food.fdcId);
		if (barcode) seenBarcodes.add(barcode);
		return true;
	});
};

export const sortIngredientSearchResults = (
	results: FdcFood[],
	query: string,
	preferenceProfile: FoodPreferenceProfile | null,
) => {
	const compareRelevance = createIngredientSearchRelevanceComparator(query);
	return [...results].sort((left, right) => {
		const relevanceSort = compareRelevance(left, right);
		if (relevanceSort !== 0) return relevanceSort;

		const preferencePenalty =
			getFoodDownrankScore(left, preferenceProfile) -
			getFoodDownrankScore(right, preferenceProfile);
		if (preferencePenalty !== 0) return preferencePenalty;

		const qualitySort = compareFoodQuality(left, right);
		if (qualitySort !== 0) return qualitySort;
		return (
			left.description.localeCompare(right.description) ||
			left.fdcId - right.fdcId
		);
	});
};
