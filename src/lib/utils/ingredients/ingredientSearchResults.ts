import type { FoodItem } from "$lib/utils/food/types";
import { compareNutritionCompleteness } from "$lib/utils/food/quality/nutritionCompletenessAssessment";
import { createIngredientSearchRelevanceComparator } from "$lib/utils/ingredients/ingredientSearchRelevance";
import { getFoodDownrankScore } from "$lib/utils/profile/foodPreferenceWarnings";
import type { NutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessCatalog";

const compareFoodSearchRichness = (left: FoodItem, right: FoodItem) =>
	new Set(left.foodNutrients.map(({ nutrientId }) => nutrientId)).size -
		new Set(right.foodNutrients.map(({ nutrientId }) => nutrientId)).size ||
	(left.foodServings?.length ?? 0) - (right.foodServings?.length ?? 0) ||
	Number(Boolean(left.scientificName)) - Number(Boolean(right.scientificName)) ||
	Number(Boolean(left.alternateDescription)) -
		Number(Boolean(right.alternateDescription)) ||
	Number(Boolean(left.preparation)) - Number(Boolean(right.preparation));

const isCanonicalCatalogFood = (food: FoodItem) =>
	Boolean(food.sharedProductId) || food.dataType === "Shared Product";

const getFoodSearchIdentityKeys = (food: FoodItem) => {
	const keys = [`food:${food.fdcId}`];
	const barcode = food.barcode ?? food.gtinUpc;
	if (barcode) keys.push(`barcode:${barcode}`);
	const legacyUsdaNdbNumber = food.sourceIdentifiers?.usdaNdbNumber;
	if (legacyUsdaNdbNumber) {
		keys.push(`usda-ndb:${legacyUsdaNdbNumber}`);
	}
	return keys;
};

export const isUsableIngredientSearchResult = (food: FoodItem) =>
	food.description.trim().length > 0 && food.foodNutrients.length > 0;

export const mergeIngredientSearchResults = (...resultGroups: FoodItem[][]) => {
	const merged: FoodItem[] = [];
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

		const existingFood = merged[existingIndex];
		const existingIsCanonical = isCanonicalCatalogFood(existingFood);
		const candidateIsCanonical = isCanonicalCatalogFood(food);
		if (existingIsCanonical !== candidateIsCanonical) {
			if (!candidateIsCanonical) continue;
			merged[existingIndex] = food;
			for (const key of identityKeys) indexesByIdentity.set(key, existingIndex);
			continue;
		}

		if (compareFoodSearchRichness(food, existingFood) <= 0) {
			continue;
		}
		merged[existingIndex] = food;
		for (const key of identityKeys) indexesByIdentity.set(key, existingIndex);
	}

	return merged;
};

export const sortIngredientSearchResults = (
	results: FoodItem[],
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

		const completenessSort = compareNutritionCompleteness(
			left,
			right,
			nutritionCompletenessCatalog,
		);
		if (completenessSort !== 0) return completenessSort;
		return (
			left.description.localeCompare(right.description) ||
			left.fdcId - right.fdcId
		);
	});
};
