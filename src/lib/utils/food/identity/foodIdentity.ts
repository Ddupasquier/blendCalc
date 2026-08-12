import type { FoodItem, FoodIdentityType } from "$lib/utils/food/types";

export const resolveFoodIdentityType = (
	food: Pick<
		FoodItem,
		| "foodIdentityType"
		| "dataType"
		| "sourceDataType"
		| "customFood"
		| "barcode"
		| "gtinUpc"
		| "brandOwner"
	>,
): FoodIdentityType => {
	if (food.foodIdentityType) return food.foodIdentityType;
	if (food.customFood === true) return "private-custom";
	if (food.barcode || food.gtinUpc || food.brandOwner?.trim()) return "packaged";
	return "unknown";
};

export const isAuthoritativeGenericFood = (
	food: Pick<
		FoodItem,
		| "foodIdentityType"
		| "dataType"
		| "sourceDataType"
		| "customFood"
		| "barcode"
		| "gtinUpc"
		| "brandOwner"
	>,
) => resolveFoodIdentityType(food) === "generic";

export const getAuthoritativeGenericFoodIdentity = (
	food: Pick<
		FoodItem,
		| "description"
		| "scientificName"
		| "alternateDescription"
		| "foodCategory"
		| "preparation"
	>,
) =>
	[
		food.description,
		food.scientificName,
		food.alternateDescription,
		food.foodCategory,
		food.preparation,
	]
		.map((value) => value?.trim())
		.filter((value): value is string => Boolean(value))
		.join(" | ");
