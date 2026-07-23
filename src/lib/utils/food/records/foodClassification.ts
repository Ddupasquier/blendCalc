import type { FdcFood } from "$lib/utils/food/types";

const SOURCE_BACKED_KEYS = new Set([
	"fdc",
	"usda",
	"open-food-facts",
	"health-canada-cnf",
	"uk-cofid",
	"fsanz-afcd",
	"national-dataset",
	"shared-catalog",
	"community-reviewed",
	"community",
]);

export const isSourceBackedFood = (food: FdcFood) =>
	Boolean(
		food.sharedProductId ||
			food.sharedProductSubmissionId ||
			(food.sourceKey && SOURCE_BACKED_KEYS.has(food.sourceKey)) ||
			(food.barcodeSource && food.barcodeSource !== "manual"),
	);

export const isPrivateCustomFood = (food: FdcFood) =>
	food.customFood === true && !isSourceBackedFood(food);

export const normalizePrivateCustomFoodFlag = (food: FdcFood): FdcFood => ({
	...food,
	customFood: isPrivateCustomFood(food),
});
