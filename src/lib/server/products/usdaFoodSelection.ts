import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { FdcFood } from "$lib/utils/food/types";
import { createIngredientSearchRelevanceComparator } from "$lib/utils/ingredients/ingredientSearchRelevance";

const USDA_GENERIC_DATA_TYPE_PRIORITY: Record<string, number> = {
	foundation: 0,
	"sr legacy": 1,
	"survey (fndds)": 2,
	branded: 3,
};

const normalizeDataType = (value?: string) => value?.trim().toLocaleLowerCase() ?? "";

const getDataTypePriority = (food: FdcFood) =>
	USDA_GENERIC_DATA_TYPE_PRIORITY[normalizeDataType(food.dataType)] ?? 100;

const parseSourceDate = (value?: string) => {
	const milliseconds = value ? Date.parse(value) : Number.NaN;
	return Number.isFinite(milliseconds) ? milliseconds : 0;
};

const getNewestSourceDate = (food: FdcFood) =>
	Math.max(
		parseSourceDate(food.publishedDate),
		parseSourceDate(food.publicationDate),
		parseSourceDate(food.modifiedDate),
		parseSourceDate(food.availableDate),
	);

const compareNewestUsdaRecord = (left: FdcFood, right: FdcFood) =>
	Number(Boolean(left.discontinuedDate)) - Number(Boolean(right.discontinuedDate)) ||
	getNewestSourceDate(right) - getNewestSourceDate(left) ||
	parseSourceDate(right.modifiedDate) - parseSourceDate(left.modifiedDate) ||
	(right.foodNutrients?.length ?? 0) - (left.foodNutrients?.length ?? 0) ||
	right.fdcId - left.fdcId;

export const selectPreferredUsdaBarcodeFood = (
	foods: readonly FdcFood[],
	barcode: string,
) => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return null;

	return [...foods]
		.filter(
			(food) =>
				normalizeDataType(food.dataType) === "branded" &&
				food.gtinUpc &&
				normalizeBarcode(food.gtinUpc) === canonicalBarcode,
		)
		.sort(compareNewestUsdaRecord)[0] ?? null;
};

export const rankUsdaGenericFoods = (
	foods: readonly FdcFood[],
	query: string,
) => {
	const compareRelevance = createIngredientSearchRelevanceComparator(query);
	return foods
		.map((food, originalIndex) => ({ food, originalIndex }))
		.sort((left, right) =>
			compareRelevance(left.food, right.food) ||
			getDataTypePriority(left.food) - getDataTypePriority(right.food) ||
			left.food.description.localeCompare(right.food.description) ||
			left.food.fdcId - right.food.fdcId ||
			left.originalIndex - right.originalIndex,
		)
		.map(({ food }) => food);
};
