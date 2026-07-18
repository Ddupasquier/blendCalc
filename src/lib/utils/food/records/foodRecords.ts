import type { FdcFood } from "$lib/utils/food/types";

export const compactFood = (food: FdcFood): FdcFood => {
	return {
		fdcId: food.fdcId,
		description: food.description,
		brandOwner: food.brandOwner,
		foodCategory: food.foodCategory,
		dataType: food.dataType,
		publishedDate: food.publishedDate,
		publicationDate: food.publicationDate,
		modifiedDate: food.modifiedDate,
		availableDate: food.availableDate,
		discontinuedDate: food.discontinuedDate,
		servingSize: food.servingSize,
		servingSizeUnit: food.servingSizeUnit,
		householdServingFullText: food.householdServingFullText,
		gtinUpc: food.gtinUpc,
		ingredients: food.ingredients,
		ingredientList: food.ingredientList,
		allergens: food.allergens,
		traces: food.traces,
		dietaryTags: food.dietaryTags,
		labels: food.labels,
		categories: food.categories,
		categoryOptionId: food.categoryOptionId,
		image: food.image,
		customFood: food.customFood,
		barcode: food.barcode,
		barcodeSource: food.barcodeSource,
		sourceKey: food.sourceKey,
		sourceLabel: food.sourceLabel,
		sourceDataType: food.sourceDataType,
		sourcePublishedDate: food.sourcePublishedDate,
		sourceModifiedDate: food.sourceModifiedDate,
		sharedProductId: food.sharedProductId,
		sharedProductConfidence: food.sharedProductConfidence,
		listAddedAt: food.listAddedAt,
		customServingLabel: food.customServingLabel,
		customServingWeightGrams: food.customServingWeightGrams,
		customDensityGramsPerMilliliter: food.customDensityGramsPerMilliliter,
		customDensityLabel: food.customDensityLabel,
		customDensityVariancePercent: food.customDensityVariancePercent,
		customDensityConfidence: food.customDensityConfidence,
		compatibilitySummary: food.compatibilitySummary,
		reportedNutrientIds: food.reportedNutrientIds
			? [...food.reportedNutrientIds]
			: food.foodNutrients.map((nutrient) => nutrient.nutrientId),
		foodNutrients: food.foodNutrients.map((nutrient) => ({
			nutrientId: nutrient.nutrientId,
			nutrientName: nutrient.nutrientName,
			nutrientNumber: nutrient.nutrientNumber,
			unitName: nutrient.unitName,
			value: nutrient.value,
			valueOrigin: nutrient.valueOrigin,
			source: nutrient.source,
			sourceReference: nutrient.sourceReference,
			confidence: nutrient.confidence,
		})),
	};
};

export const uniqueFoodsById = (foods: FdcFood[]) => {
	const seen = new Set<number>();

	return foods.filter((food) => {
		if (seen.has(food.fdcId)) return false;
		seen.add(food.fdcId);
		return true;
	});
};
