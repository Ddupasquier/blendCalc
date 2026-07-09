import {
	findCustomFoodByBarcode,
	findCustomFoodByName,
	saveCustomFood,
} from "$lib/utils/food/custom/customFoods";
import type { FdcFood } from "$lib/utils/food/types";
import { submitSharedProduct } from "$lib/utils/products/catalog";

export type ManualEntrySharedProductPhotos = {
	frontPhoto: File | null;
	nutritionPhoto: File | null;
	barcodePhoto: File | null;
	frontImageCrop: {
		cropX: number;
		cropY: number;
		cropZoom: number;
	} | null;
};

export type ManualEntrySubmitFlowResult =
	| {
			status: "complete";
			catalogMessage: string;
			resetForm: boolean;
	  }
	| {
			status: "error";
			error: string;
	  };

export const saveManualEntryCustomFood = async ({
	food,
	name,
	normalizedBarcode,
	shareWithCatalog,
	submitForCatalog = false,
	barcodeSource,
	photos,
	reviewFlags,
	useIngredient,
}: {
	food: FdcFood;
	name: string;
	normalizedBarcode: string | null;
	shareWithCatalog: boolean;
	submitForCatalog?: boolean;
	barcodeSource: FdcFood["barcodeSource"];
	photos: ManualEntrySharedProductPhotos;
	reviewFlags: string[];
	useIngredient: (food: FdcFood, alreadySaved?: boolean) => Promise<boolean>;
}): Promise<ManualEntrySubmitFlowResult> => {
	const result = await saveCustomFood(food);

	if (result === "duplicate-name") {
		const existingFood = findCustomFoodByName(name);
		if (existingFood) {
			await useIngredient(existingFood, true);
			return { status: "complete", catalogMessage: "", resetForm: true };
		}

		return {
			status: "error",
			error:
				"This ingredient is already saved to your account. Refresh and try again.",
		};
	}

	if (result === "duplicate-barcode") {
		const existingFood = normalizedBarcode
			? findCustomFoodByBarcode(normalizedBarcode)
			: null;
		if (existingFood) {
			await useIngredient(existingFood, true);
			return { status: "complete", catalogMessage: "", resetForm: true };
		}

		return {
			status: "error",
			error: "An ingredient with this barcode is already saved to your account.",
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
	let catalogMessage = "";

	if (
		normalizedBarcode &&
		addedToDestination &&
		(shareWithCatalog || barcodeSource === "open-food-facts" || submitForCatalog)
	) {
		try {
			const submission = await submitSharedProduct(food, photos, { reviewFlags });
			catalogMessage = submission.message;
		} catch {
			catalogMessage =
				"The ingredient was saved privately, but catalog review could not be started. You can try again later.";
		}
	}

	return { status: "complete", catalogMessage, resetForm: true };
};
