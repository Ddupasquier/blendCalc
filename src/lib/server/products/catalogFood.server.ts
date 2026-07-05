import { createHash } from "node:crypto";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import { createCustomFood } from "$lib/utils/food/customFoods";
import type { FdcFood } from "$lib/utils/food/types";

const getCatalogFoodId = (draft: BarcodeProductDraft) => {
	if (draft.source === "usda") {
		const fdcId = Number(draft.sourceReference);
		if (Number.isSafeInteger(fdcId) && fdcId > 0) return fdcId;
	}

	const hash = createHash("sha256").update(draft.barcode).digest();
	return -Math.max(1, hash.readUInt32BE(0));
};

export const createCatalogFoodFromDraft = (
	draft: BarcodeProductDraft,
	sharedProductId?: string,
): FdcFood => {
	const food = createCustomFood({
		name: draft.name,
		brandOwner: draft.brandOwner,
		servingLabel: draft.servingLabel,
		servingWeightGrams: draft.servingWeightGrams,
		volumeQuantity: draft.volumeEquivalent?.quantity,
		volumeUnit: draft.volumeEquivalent?.unit,
		barcode: draft.barcode,
		barcodeSource: draft.source === "open-food-facts"
			? "open-food-facts"
			: draft.source === "usda"
				? "usda"
				: "community",
		ingredients: draft.ingredients,
		ingredientList: draft.ingredientList,
		allergens: draft.allergens,
		traces: draft.traces,
		dietaryTags: draft.dietaryTags,
		labels: draft.labels,
		categories: draft.categories,
		nutrients: draft.nutrients,
		reportedNutrientIds: draft.reportedNutrientIds,
	});

	return {
		...food,
		reportedNutrientIds: [...draft.reportedNutrientIds],
		fdcId: getCatalogFoodId(draft),
		dataType: "Shared Product",
		foodCategory: "Verified Packaged Food",
		customFood: false,
		gtinUpc: draft.barcode,
		sharedProductId,
		sharedProductConfidence:
			draft.source === "usda"
				? "source-verified"
				: draft.source === "open-food-facts"
					? "imported"
					: "moderator-reviewed",
	};
};
