import type { FoodItem } from "$lib/utils/food/types";

type FoodClassificationInput = Pick<
	FoodItem,
	| "barcodeSource"
	| "customFood"
	| "sharedProductId"
	| "sharedProductSubmissionId"
	| "sourceKey"
>;

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

export const isSourceBackedFood = (food: FoodClassificationInput) =>
	Boolean(
		food.sharedProductId ||
		food.sharedProductSubmissionId ||
		(food.sourceKey && SOURCE_BACKED_KEYS.has(food.sourceKey)) ||
		(food.barcodeSource && food.barcodeSource !== "manual"),
	);

export const isPrivateCustomFood = (food: FoodClassificationInput) =>
	food.customFood === true && !isSourceBackedFood(food);

export const normalizePrivateCustomFoodFlag = (food: FoodItem): FoodItem => ({
	...food,
	customFood: isPrivateCustomFood(food),
});
