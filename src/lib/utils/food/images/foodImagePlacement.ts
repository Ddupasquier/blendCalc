import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import type { FoodImageAsset } from "$lib/utils/food/types";
import {
	createUserFacingErrorFromResponse,
	createUserFacingIssueError,
} from "$lib/utils/errors/userFacingErrors";

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
		throw await createUserFacingErrorFromResponse(
			response,
			"IMAGE_PLACEMENT_SAVE_UNCONFIRMED",
		);
	}

	const data = (await response.json()) as { image?: FoodImageAsset };
	if (!data.image) {
		throw createUserFacingIssueError("IMAGE_PLACEMENT_SAVE_UNCONFIRMED");
	}
	return data.image;
};
