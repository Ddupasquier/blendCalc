import type { FoodImageAsset } from "$lib/utils/food/types";

export const OPEN_FOOD_FACTS_IMAGE_LICENSE = {
	name: "Creative Commons Attribution-ShareAlike",
	url: "https://world.openfoodfacts.org/terms-of-use",
	attribution: "Open Food Facts contributors",
} as const;

export const pickFoodImageUrl = (image?: FoodImageAsset | null) =>
	image?.thumbnailUrl || image?.imageUrl || "";

export const pickFoodFullImageUrl = (image?: FoodImageAsset | null) =>
	image?.imageUrl || image?.thumbnailUrl || "";

export const getFoodImageAltText = ({
	foodName,
	role,
}: {
	foodName: string;
	role?: FoodImageAsset["role"];
}) => {
	const label = role === "front" ? "package image" : "food image";
	return `${foodName} ${label}`;
};
