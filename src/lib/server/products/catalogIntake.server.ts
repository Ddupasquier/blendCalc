import type { FoodItem } from "$lib/utils/food/types";
import type {
	CatalogSubmissionIntent,
	SharedProductSubmissionResult,
} from "$lib/utils/products/catalog";
import { submitProductForCatalog } from "./catalog.server";
import type { FoodImagePlacementValues } from "./foodImages.server";
import {
	deleteProductEvidence,
	type ProductEvidencePaths,
} from "./productEvidence.server";

export type CatalogIntakeRequest = {
	actorUserId: string;
	food: FoodItem;
	evidencePaths?: ProductEvidencePaths;
	reviewFlags?: string[];
	frontImageCrop?: FoodImagePlacementValues | null;
	intent?: CatalogSubmissionIntent;
};

export const submitCatalogIntake = async (
	request: CatalogIntakeRequest,
): Promise<SharedProductSubmissionResult> => {
	const evidencePaths = request.evidencePaths ?? {};
	let result: SharedProductSubmissionResult;

	try {
		result = await submitProductForCatalog(
			request.actorUserId,
			request.food,
			evidencePaths,
			{
				reviewFlags: request.reviewFlags,
				frontImageCrop: request.frontImageCrop,
				intent: request.intent,
			},
		);
	} catch (error) {
		await deleteProductEvidence(evidencePaths);
		throw error;
	}

	if (result.evidenceAccepted !== true) {
		await deleteProductEvidence(evidencePaths);
	}
	return result;
};
