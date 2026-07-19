import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import type { FoodImageAsset } from "$lib/utils/food/types";

export type FoodImagePlacementRequest = ImagePlacementValue & {
	source: FoodImageAsset["source"];
	sourceReference: string;
	role: FoodImageAsset["role"];
};

export const updateFoodImagePlacement = async (
	request: FoodImagePlacementRequest,
) => {
	const response = await fetch("/api/food-images/crop", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});

	if (!response.ok) {
		const message = await response.text();
		throw new Error(message || "Product image placement could not be saved.");
	}

	const data = (await response.json()) as { image?: FoodImageAsset };
	if (!data.image) throw new Error("Product image placement could not be saved.");
	return data.image;
};
