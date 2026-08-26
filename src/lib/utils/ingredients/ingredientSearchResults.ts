import type { FoodItem } from "$lib/utils/food/types";
import { compareNutritionCompleteness } from "$lib/utils/food/quality/nutritionCompletenessAssessment";
import { createIngredientSearchRelevanceComparator } from "$lib/utils/ingredients/ingredientSearchRelevance";
import { getFoodDownrankScore } from "$lib/utils/profile/foodPreferenceWarnings";
import type { NutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import { resolveExactIdentityFoodFields } from "$lib/utils/food/records/exactIdentityFoodResolution";
import { cleanBarcode, normalizeBarcode } from "$lib/utils/barcode/barcode";
import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";

const isCanonicalCatalogFood = (food: FoodItem) =>
	Boolean(food.sharedProductId) || food.dataType === "Shared Product";

const normalizeUsdaFdcId = (value: string) => {
	const digits = value.trim();
	if (!/^\d+$/.test(digits)) return digits;
	return String(BigInt(digits));
};

const normalizeLegacyUsdaNdbNumber = (value: string) => {
	const digits = value.replace(/\D/g, "");
	return digits ? digits.padStart(5, "0") : value.trim();
};

const getFoodSearchIdentityKeys = (food: FoodItem) => {
	if (isPrivateCustomFood(food)) return [`private-food:${food.fdcId}`];
	const keys = [`food:${food.fdcId}`];
	const barcode = food.barcode ?? food.gtinUpc;
	if (barcode) {
		keys.push(`barcode:${normalizeBarcode(barcode) ?? cleanBarcode(barcode)}`);
	}
	const usdaFdcId = food.sourceIdentifiers?.usdaFdcId;
	if (usdaFdcId) keys.push(`usda-fdc:${normalizeUsdaFdcId(usdaFdcId)}`);
	const legacyUsdaNdbNumber = food.sourceIdentifiers?.usdaNdbNumber;
	if (legacyUsdaNdbNumber) {
		keys.push(`usda-ndb:${normalizeLegacyUsdaNdbNumber(legacyUsdaNdbNumber)}`);
	}
	return keys;
};

export const isUsableIngredientSearchResult = (food: FoodItem) =>
	food.description.trim().length > 0 &&
	(food.foodNutrients.length > 0 || (food.safetyAlerts?.length ?? 0) > 0);

export const mergeIngredientSearchResults = (...resultGroups: FoodItem[][]) => {
	const foods = resultGroups.flat();
	const parentIndexes = foods.map((_, index) => index);
	const findRootIndex = (index: number): number => {
		const parentIndex = parentIndexes[index];
		if (parentIndex === index) return index;
		const rootIndex = findRootIndex(parentIndex);
		parentIndexes[index] = rootIndex;
		return rootIndex;
	};
	const connectIndexes = (leftIndex: number, rightIndex: number) => {
		const leftRootIndex = findRootIndex(leftIndex);
		const rightRootIndex = findRootIndex(rightIndex);
		if (leftRootIndex === rightRootIndex) return;
		parentIndexes[Math.max(leftRootIndex, rightRootIndex)] = Math.min(
			leftRootIndex,
			rightRootIndex,
		);
	};
	const firstIndexByIdentity = new Map<string, number>();

	foods.forEach((food, index) => {
		for (const identityKey of getFoodSearchIdentityKeys(food)) {
			const linkedIndex = firstIndexByIdentity.get(identityKey);
			if (linkedIndex === undefined) {
				firstIndexByIdentity.set(identityKey, index);
			} else {
				connectIndexes(index, linkedIndex);
			}
		}
	});

	const clustersByRootIndex = new Map<number, FoodItem[]>();
	foods.forEach((food, index) => {
		const rootIndex = findRootIndex(index);
		const cluster = clustersByRootIndex.get(rootIndex) ?? [];
		cluster.push(food);
		clustersByRootIndex.set(rootIndex, cluster);
	});

	return [...clustersByRootIndex.entries()]
		.sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
		.map(([, cluster]) => {
			const canonicalFood = cluster.find(isCanonicalCatalogFood);
			return canonicalFood ?? resolveExactIdentityFoodFields(cluster);
		});
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
			getFoodDownrankScore(left) - getFoodDownrankScore(right);
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
