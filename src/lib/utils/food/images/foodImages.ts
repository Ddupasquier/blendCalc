import type { FoodImageAsset } from "$lib/utils/food/types";
import { constrainCardImagePlacement } from "$lib/utils/food/images/imagePlacement";
import type { ImagePlacementValue } from "$lib/utils/food/images/types";

export const OPEN_FOOD_FACTS_IMAGE_LICENSE = {
	name: "Creative Commons Attribution-ShareAlike",
	url: "https://world.openfoodfacts.org/terms-of-use",
	attribution: "Open Food Facts contributors",
} as const;

export const pickFoodImageUrl = (image?: FoodImageAsset | null) =>
	image?.thumbnailUrl || image?.imageUrl || "";

export const pickFoodFullImageUrl = (image?: FoodImageAsset | null) =>
	image?.imageUrl || image?.thumbnailUrl || "";

export const applyCardImagePlacementToFoodImage = (
	image: FoodImageAsset,
	value: Partial<ImagePlacementValue>,
): FoodImageAsset => {
	const placement = constrainCardImagePlacement(value);
	return {
		...image,
		cropX: placement.cropX,
		cropY: placement.cropY,
		cropZoom: placement.cropZoom,
		rotationDegrees: placement.rotationDegrees,
		fitMode: placement.fitMode,
		placementVersion: placement.placementVersion,
		placementMethod: placement.placementMethod,
		suggestionVersion: placement.suggestionVersion,
		suggestionConfidence: placement.suggestionConfidence,
	};
};

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
