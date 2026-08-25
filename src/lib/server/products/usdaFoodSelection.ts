import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { FoodItem } from "$lib/utils/food/types";
import { createIngredientSearchRelevanceComparator } from "$lib/utils/ingredients/ingredientSearchRelevance";
import type { ProductResolutionPolicy } from "$lib/utils/products/productResolutionPolicy";

const normalizeDataType = (value?: string) =>
	value?.trim().toLocaleLowerCase() ?? "";

const getDataTypePriority = (food: FoodItem, policy: ProductResolutionPolicy) =>
	policy.rankValues
		.get("usda-generic-data-type")
		?.get(normalizeDataType(food.dataType)) ?? Number.MAX_SAFE_INTEGER;

const parseSourceDate = (value?: string) => {
	const milliseconds = value ? Date.parse(value) : Number.NaN;
	return Number.isFinite(milliseconds) ? milliseconds : 0;
};

const getNewestSourceDate = (food: FoodItem) =>
	Math.max(
		parseSourceDate(food.publishedDate),
		parseSourceDate(food.publicationDate),
		parseSourceDate(food.modifiedDate),
		parseSourceDate(food.availableDate),
	);

const compareNewestUsdaRecord = (left: FoodItem, right: FoodItem) =>
	Number(Boolean(left.discontinuedDate)) -
		Number(Boolean(right.discontinuedDate)) ||
	getNewestSourceDate(right) - getNewestSourceDate(left) ||
	parseSourceDate(right.modifiedDate) - parseSourceDate(left.modifiedDate) ||
	(right.foodNutrients?.length ?? 0) - (left.foodNutrients?.length ?? 0) ||
	right.fdcId - left.fdcId;

export const selectPreferredUsdaBarcodeFood = (
	foods: readonly FoodItem[],
	barcode: string,
) => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return null;

	return (
		[...foods]
			.filter(
				(food) =>
					normalizeDataType(food.dataType) === "branded" &&
					food.gtinUpc &&
					normalizeBarcode(food.gtinUpc) === canonicalBarcode,
			)
			.sort(compareNewestUsdaRecord)[0] ?? null
	);
};

export const rankUsdaGenericFoods = (
	foods: readonly FoodItem[],
	query: string,
	policy: ProductResolutionPolicy,
) => {
	const compareRelevance = createIngredientSearchRelevanceComparator(query);
	return foods
		.map((food, originalIndex) => ({ food, originalIndex }))
		.sort(
			(left, right) =>
				compareRelevance(left.food, right.food) ||
				getDataTypePriority(left.food, policy) -
					getDataTypePriority(right.food, policy) ||
				left.food.description.localeCompare(right.food.description) ||
				left.food.fdcId - right.food.fdcId ||
				left.originalIndex - right.originalIndex,
		)
		.map(({ food }) => food);
};
