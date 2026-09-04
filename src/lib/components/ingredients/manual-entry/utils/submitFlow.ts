import {
	findCustomFoodByBarcode,
	findCustomFoodByName,
	saveCustomFood,
} from "$lib/utils/food/custom/customFoods";
import type { FoodItem } from "$lib/utils/food/types";
import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import { submitSharedProduct } from "$lib/utils/products/catalog";
import type { CatalogSubmissionIntent } from "$lib/utils/products/catalog";
import type { SharedProductSubmissionProgress } from "$lib/utils/products/catalog";
import { notifyIngredientListsChanged } from "$lib/utils/storage/client/ingredientLists";
import { getUserFacingErrorMessage } from "$lib/utils/errors/userFacingErrors";

export type ManualEntryCatalogMessageTone = "success" | "warning";

export type ManualEntrySharedProductPhotos = {
	frontPhoto: File | null;
	nutritionPhoto: File | null;
	barcodePhoto: File | null;
	frontImageCrop: ImagePlacementValue | null;
};

export type ManualEntrySubmitFlowResult =
	| {
			status: "complete";
			catalogMessage: string;
			catalogMessageTone: ManualEntryCatalogMessageTone;
			resetForm: boolean;
	  }
	| {
			status: "error";
			error: string;
	  }
	| {
			status: "cancelled";
	  };

export const saveManualEntryCustomFood = async ({
	food,
	name,
	normalizedBarcode,
	shareWithCatalog,
	photos,
	reviewFlags,
	useIngredient,
	submissionIntent = "catalog_share",
	catalogSubmissionOnly = false,
	onCatalogProgress,
}: {
	food: FoodItem;
	name: string;
	normalizedBarcode: string | null;
	shareWithCatalog: boolean;
	photos: ManualEntrySharedProductPhotos;
	reviewFlags: string[];
	useIngredient: (food: FoodItem, alreadySaved?: boolean) => Promise<boolean>;
	submissionIntent?: CatalogSubmissionIntent;
	catalogSubmissionOnly?: boolean;
	onCatalogProgress?: (progress: SharedProductSubmissionProgress) => void;
}): Promise<ManualEntrySubmitFlowResult> => {
	const submissionContext = {
		consentToShare: true as const,
		reviewFlags,
		intent: submissionIntent,
		...(onCatalogProgress ? { onProgress: onCatalogProgress } : {}),
	};
	if (catalogSubmissionOnly) {
		if (!normalizedBarcode || !shareWithCatalog) {
			return {
				status: "error",
				error:
					"Keep community sharing on to submit this correction for review.",
			};
		}
		try {
			const submission = await submitSharedProduct(
				food,
				photos,
				submissionContext,
			);
			return {
				status: "complete",
				catalogMessage: submission.message,
				catalogMessageTone: "success",
				resetForm: false,
			};
		} catch (error) {
			return {
				status: "error",
				error: getUserFacingErrorMessage(error, {
					fallback:
						"We couldn’t submit this correction. Check your connection and try again.",
				}),
			};
		}
	}

	const result = await saveCustomFood(food);

	if (result === "duplicate-name") {
		const existingFood = await findCustomFoodByName(name);
		if (existingFood) {
			const usedIngredient = await useIngredient(existingFood, true);
			if (!usedIngredient) return { status: "cancelled" };
			return {
				status: "complete",
				catalogMessage: "",
				catalogMessageTone: "success",
				resetForm: true,
			};
		}

		return {
			status: "error",
			error:
				"This ingredient is already saved to your account. Refresh and try again.",
		};
	}

	if (result === "duplicate-barcode") {
		const existingFood = normalizedBarcode
			? await findCustomFoodByBarcode(normalizedBarcode)
			: null;
		if (existingFood) {
			const usedIngredient = await useIngredient(existingFood, true);
			if (!usedIngredient) return { status: "cancelled" };
			return {
				status: "complete",
				catalogMessage: "",
				catalogMessageTone: "success",
				resetForm: true,
			};
		}

		return {
			status: "error",
			error:
				"An ingredient with this barcode is already saved to your account.",
		};
	}

	if (result === "error") {
		return {
			status: "error",
			error:
				"This ingredient could not be saved. Check your connection and try again.",
		};
	}

	const addedToDestination = await useIngredient(food);
	if (!addedToDestination) return { status: "cancelled" };
	let catalogMessage = "";
	let catalogMessageTone: ManualEntryCatalogMessageTone = "success";

	if (normalizedBarcode && addedToDestination && shareWithCatalog) {
		try {
			const submission = await submitSharedProduct(
				food,
				photos,
				submissionContext,
			);
			catalogMessage = submission.message;
			notifyIngredientListsChanged();
		} catch (error) {
			catalogMessage = getUserFacingErrorMessage(error, {
				fallback:
					"The ingredient was saved privately, but catalog review could not be started. You can try again later.",
			});
			catalogMessageTone = "warning";
		}
	}

	return {
		status: "complete",
		catalogMessage,
		catalogMessageTone,
		resetForm: true,
	};
};
