import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { FdcFood } from "$lib/utils/food/types";

export type ProductSourceQualitySummary = {
	reportedNutrientCount: number;
	hasBrand: boolean;
	hasCategory: boolean;
	hasServing: boolean;
	hasIngredients: boolean;
	hasImage: boolean;
};

const hasText = (value?: string | null) => Boolean(value?.trim());

export const summarizeBarcodeProductQuality = (
	draft: BarcodeProductDraft,
): ProductSourceQualitySummary => ({
	reportedNutrientCount: new Set(draft.reportedNutrientIds).size,
	hasBrand: hasText(draft.brandOwner),
	hasCategory: Boolean(
		draft.categoryResolution
		|| hasText(draft.resolvedCategory)
		|| draft.categories?.length,
	),
	hasServing: draft.hasSourceServing === true,
	hasIngredients: hasText(draft.ingredients) || Boolean(draft.ingredientList?.length),
	hasImage: Boolean(draft.image?.imageUrl),
});

export const summarizeUsdaFoodQuality = (
	food: FdcFood,
): ProductSourceQualitySummary => ({
	reportedNutrientCount: new Set(
		food.reportedNutrientIds
		?? food.foodNutrients.map((nutrient) => nutrient.nutrientId),
	).size,
	hasBrand: hasText(food.brandOwner),
	hasCategory: Boolean(
		hasText(food.foodCategory)
		|| hasText(food.brandedFoodCategory)
		|| food.categories?.length,
	),
	hasServing: Number(food.servingSize) > 0 && hasText(food.servingSizeUnit),
	hasIngredients: hasText(food.ingredients) || Boolean(food.ingredientList?.length),
	hasImage: Boolean(food.image?.imageUrl),
});
