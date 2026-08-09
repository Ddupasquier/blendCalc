import { createHash } from "node:crypto";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import { createCustomFood } from "$lib/utils/food/custom/customFoods";
import type { FoodItem } from "$lib/utils/food/types";
import {
	applyCanonicalFoodCategory,
	mergeCanonicalFoodCategories,
	type ResolvedFoodCategory,
} from "./categoryMapping.server";

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
	category?: ResolvedFoodCategory,
	sharedProductId?: string,
): FoodItem => {
	const food = createCustomFood({
		name: draft.name,
		nameProvenance: draft.nameProvenance,
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
		foodIdentityType: "packaged",
		ingredients: draft.ingredients,
		ingredientList: draft.ingredientList,
		structuredIngredients: draft.structuredIngredients,
		ingredientAnalysis: draft.ingredientAnalysis,
		additives: draft.additives,
		allergens: draft.allergens,
			traces: draft.traces,
			precautionaryStatements: draft.precautionaryStatements,
		dietaryTags: draft.dietaryTags,
		labels: draft.labels,
		packageQuantity: draft.packageQuantity,
		sourceMetadata: draft.sourceMetadata,
		categories: category
			? mergeCanonicalFoodCategories(category.label, draft.categories)
			: draft.categories,
		image: draft.image,
		fieldProvenance: draft.fieldProvenance,
		nutrients: draft.nutrients,
		reportedNutrientIds: draft.reportedNutrientIds,
		hasSourceServing: draft.hasSourceServing,
		serving: draft.serving,
	});

	const catalogFood: FoodItem = {
		...food,
		reportedNutrientIds: [...draft.reportedNutrientIds],
		fdcId: getCatalogFoodId(draft),
		dataType: "Shared Product",
		foodIdentityType: "packaged",
		customFood: false,
		gtinUpc: draft.barcode,
		sharedProductId,
		sharedProductConfidence: "imported",
		sourceKey: draft.sourceKey,
		sourceLabel: draft.sourceLabel,
		sourceDataType: draft.sourceDataType,
		sourcePublishedDate: draft.sourcePublishedDate,
		sourceModifiedDate: draft.sourceModifiedDate,
	};

	return category
		? applyCanonicalFoodCategory(catalogFood, category)
		: catalogFood;
};
