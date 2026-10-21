import type { FoodImageAsset } from "$lib/utils/food/types";
import type { ImagePlacementValue } from "./types";
import {
	createUserFacingErrorFromResponse,
	createUserFacingIssueError,
} from "$lib/utils/errors/userFacingErrors";

export type PlacementContributionStatus =
	| "personal_saved"
	| "personal_reset"
	| "pending"
	| "published"
	| "stale"
	| "restricted"
	| "limit_reached"
	| "already_submitted"
	| "locked"
	| "unchanged";

export const savePersonalImagePlacement = async (
	image: FoodImageAsset,
	action: "personal" | "reset" | "suggest",
	placement: ImagePlacementValue,
) => {
	const response = await fetch("/api/food-images/placement", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			imageId: image.assetId,
			imageUrl: image.imageUrl,
			baseRevision: image.placementRevision,
			action,
			placement,
		}),
	});
	if (!response.ok)
		throw await createUserFacingErrorFromResponse(
			response,
			"IMAGE_PLACEMENT_SAVE_UNCONFIRMED",
		);
	const data = (await response.json()) as {
		status?: PlacementContributionStatus;
		placement?: ImagePlacementValue;
		sharedPlacement?: ImagePlacementValue;
		revision?: number;
		locked?: boolean;
	};
	if (
		!data.status ||
		![
			"personal_saved",
			"personal_reset",
			"pending",
			"published",
			"stale",
			"restricted",
			"limit_reached",
			"already_submitted",
			"locked",
			"unchanged",
		].includes(data.status) ||
		(["personal_saved", "personal_reset"].includes(data.status) &&
			(!data.placement ||
				!data.sharedPlacement ||
				!Number.isSafeInteger(data.revision) ||
				typeof data.locked !== "boolean"))
	) {
		throw createUserFacingIssueError("IMAGE_PLACEMENT_SAVE_UNCONFIRMED");
	}
	return data as {
		status: PlacementContributionStatus;
		placement?: ImagePlacementValue;
		sharedPlacement?: ImagePlacementValue;
		revision?: number;
		locked?: boolean;
	};
};
