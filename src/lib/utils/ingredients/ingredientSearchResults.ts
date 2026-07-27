import type { FdcFood } from "$lib/utils/food/types";
import { compareFoodQuality } from "$lib/utils/food/quality/foodQuality";
import { createIngredientSearchRelevanceComparator } from "$lib/utils/ingredients/ingredientSearchRelevance";
import { getFoodDownrankScore } from "$lib/utils/profile/foodPreferenceWarnings";
import type { NutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessCatalog";

const compareFoodSearchRichness = (left: FdcFood, right: FdcFood) =>
	new Set(left.foodNutrients.map(({ nutrientId }) => nutrientId)).size -
		new Set(right.foodNutrients.map(({ nutrientId }) => nutrientId)).size ||
	(left.foodServings?.length ?? 0) - (right.foodServings?.length ?? 0) ||
	Number(Boolean(left.scientificName)) - Number(Boolean(right.scientificName)) ||
	Number(Boolean(left.alternateDescription)) -
		Number(Boolean(right.alternateDescription)) ||
	Number(Boolean(left.preparation)) - Number(Boolean(right.preparation));

const getFoodSearchIdentityKeys = (food: FdcFood) => {
	const keys = [`food:${food.fdcId}`];
	const barcode = food.barcode ?? food.gtinUpc;
	if (barcode) keys.push(`barcode:${barcode}`);
	const legacyUsdaNdbNumber = food.sourceIdentifiers?.usdaNdbNumber;
	if (legacyUsdaNdbNumber) {
		keys.push(`usda-ndb:${legacyUsdaNdbNumber}`);
	}
	return keys;
};

export const isUsableIngredientSearchResult = (food: FdcFood) =>
	food.description.trim().length > 0 && food.foodNutrients.length > 0;

export const mergeIngredientSearchResults = (...resultGroups: FdcFood[][]) => {
	const merged: FdcFood[] = [];
	const indexesByIdentity = new Map<string, number>();

	for (const food of resultGroups.flat()) {
		const identityKeys = getFoodSearchIdentityKeys(food);
		const existingIndex = identityKeys
			.map((key) => indexesByIdentity.get(key))
			.find((index): index is number => index !== undefined);
		if (existingIndex === undefined) {
			const nextIndex = merged.push(food) - 1;
			for (const key of identityKeys) indexesByIdentity.set(key, nextIndex);
			continue;
		}

		if (compareFoodSearchRichness(food, merged[existingIndex]) <= 0) {
			continue;
		}
		merged[existingIndex] = food;
		for (const key of identityKeys) indexesByIdentity.set(key, existingIndex);
	}

	return merged;
};

export const sortIngredientSearchResults = (
	results: FdcFood[],
	query: string,
	nutritionCompletenessCatalog?: NutritionCompletenessCatalog,
) => {
	const compareRelevance = createIngredientSearchRelevanceComparator(query);
	return [...results].sort((left, right) => {
		const relevanceSort = compareRelevance(left, right);
		if (relevanceSort !== 0) return relevanceSort;

		const preferencePenalty =
			getFoodDownrankScore(left) -
			getFoodDownrankScore(right);
		if (preferencePenalty !== 0) return preferencePenalty;

		const qualitySort = compareFoodQuality(
			left,
			right,
			nutritionCompletenessCatalog,
		);
		if (qualitySort !== 0) return qualitySort;
		return (
			left.description.localeCompare(right.description) ||
			left.fdcId - right.fdcId
		);
	});
};
