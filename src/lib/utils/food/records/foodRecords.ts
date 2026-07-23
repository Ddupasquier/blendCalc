import type { FdcFood } from "$lib/utils/food/types";
import { normalizeFoodProductName } from "$lib/utils/products/productNameFormatting.js";
import { resolveFoodSymbolKey } from "$lib/utils/food/reference/appReferenceCatalog";

export const compactFood = (food: FdcFood): FdcFood => {
	const normalizedFood = normalizeFoodProductName(food) as FdcFood;
	const foodNutrients = food.foodNutrients.filter((nutrient) =>
		Number.isSafeInteger(nutrient.nutrientId) &&
		nutrient.nutrientId > 0 &&
		Number.isFinite(nutrient.value) &&
		nutrient.value >= 0
	);
	const nutrientIds = new Set(foodNutrients.map((nutrient) => nutrient.nutrientId));
	const reportedNutrientIds = food.reportedNutrientIds ?? foodNutrients
		.filter((nutrient) => nutrient.valueOrigin === "reported")
		.map((nutrient) => nutrient.nutrientId);
	return {
		fdcId: normalizedFood.fdcId,
		description: normalizedFood.description,
		nameProvenance: normalizedFood.nameProvenance,
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
		hasSourceServing: food.hasSourceServing,
		foodServings: food.foodServings?.map((serving) => ({ ...serving })),
		gtinUpc: food.gtinUpc,
		ingredients: food.ingredients,
		ingredientList: food.ingredientList,
		allergens: food.allergens,
		traces: food.traces,
		dietaryTags: food.dietaryTags,
		labels: food.labels,
		categories: food.categories,
		categoryOptionId: food.categoryOptionId,
			symbolKey: resolveFoodSymbolKey(normalizedFood),
		image: food.image,
		fieldProvenance: food.fieldProvenance
			? Object.fromEntries(
				Object.entries(food.fieldProvenance).map(([field, source]) => [
					field,
					{ ...source },
				]),
			)
			: undefined,
		customFood: food.customFood,
		barcode: food.barcode,
		barcodeSource: food.barcodeSource,
		barcodeProvenance: food.barcodeProvenance
			? { ...food.barcodeProvenance }
			: undefined,
		sourceKey: food.sourceKey,
		sourceLabel: food.sourceLabel,
		sourceDataType: food.sourceDataType,
		sourcePublishedDate: food.sourcePublishedDate,
		sourceModifiedDate: food.sourceModifiedDate,
		sharedProductId: food.sharedProductId,
		sharedProductSubmissionId: food.sharedProductSubmissionId,
		sharedProductConfidence: food.sharedProductConfidence,
		trustStatus: food.trustStatus,
		listAddedAt: food.listAddedAt,
		customServingLabel: food.customServingLabel,
		customServingWeightGrams: food.customServingWeightGrams,
		customDensityGramsPerMilliliter: food.customDensityGramsPerMilliliter,
		customDensityLabel: food.customDensityLabel,
		customDensityVariancePercent: food.customDensityVariancePercent,
		customDensityConfidence: food.customDensityConfidence,
		compatibilitySummary: food.compatibilitySummary,
		reportedNutrientIds: [...new Set(reportedNutrientIds)].filter((nutrientId) =>
			nutrientIds.has(nutrientId)
		),
		foodNutrients: foodNutrients.map((nutrient) => ({
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
