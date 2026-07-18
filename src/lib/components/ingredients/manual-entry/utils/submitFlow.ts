import {
	findCustomFoodByBarcode,
	findCustomFoodByName,
	saveCustomFood,
} from "$lib/utils/food/custom/customFoods";
import type { FdcFood } from "$lib/utils/food/types";
import { submitSharedProduct } from "$lib/utils/products/catalog";
import { notifySmoothieListsChanged } from "$lib/utils/storage/client/smoothieLists";

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
	  }
	| {
			status: "cancelled";
	  };

export const saveManualEntryCustomFood = async ({
	food,
	name,
	normalizedBarcode,
	shareWithCatalog,
	submitForCatalog = false,
	photos,
	reviewFlags,
	useIngredient,
}: {
	food: FdcFood;
	name: string;
	normalizedBarcode: string | null;
	shareWithCatalog: boolean;
	submitForCatalog?: boolean;
	photos: ManualEntrySharedProductPhotos;
	reviewFlags: string[];
	useIngredient: (food: FdcFood, alreadySaved?: boolean) => Promise<boolean>;
}): Promise<ManualEntrySubmitFlowResult> => {
	const result = await saveCustomFood(food);

	if (result === "duplicate-name") {
		const existingFood = findCustomFoodByName(name);
		if (existingFood) {
			const usedIngredient = await useIngredient(existingFood, true);
			if (!usedIngredient) return { status: "cancelled" };
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
			const usedIngredient = await useIngredient(existingFood, true);
			if (!usedIngredient) return { status: "cancelled" };
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
	if (!addedToDestination) return { status: "cancelled" };
	let catalogMessage = "";

	if (
		normalizedBarcode &&
		addedToDestination &&
		(shareWithCatalog || submitForCatalog)
	) {
		try {
			const submission = await submitSharedProduct(food, photos, { reviewFlags });
			catalogMessage = submission.message;
			notifySmoothieListsChanged();
		} catch {
			catalogMessage =
				"The ingredient was saved privately, but catalog review could not be started. You can try again later.";
		}
	}

	return { status: "complete", catalogMessage, resetForm: true };
};
