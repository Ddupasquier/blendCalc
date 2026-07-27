import type { FdcFood, FoodIdentityType } from "$lib/utils/food/types";

const GENERIC_DATA_TYPES = new Set([
	"foundation",
	"generic",
	"sr legacy",
	"survey fndds",
]);

const normalizeDataType = (value: string | null | undefined) =>
	(value ?? "")
		.toLocaleLowerCase()
		.replace(/[()]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

export const resolveFoodIdentityType = (
	food: Pick<
		FdcFood,
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

	const dataTypes = [food.dataType, food.sourceDataType].map(normalizeDataType);
	return dataTypes.some((dataType) => GENERIC_DATA_TYPES.has(dataType))
		? "generic"
		: "packaged";
};

export const isAuthoritativeGenericFood = (
	food: Pick<
		FdcFood,
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
		FdcFood,
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
