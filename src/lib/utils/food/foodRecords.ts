import type { FdcFood } from "$lib/utils/food/types";

export const compactFood = (food: FdcFood): FdcFood => {
	return {
		fdcId: food.fdcId,
		description: food.description,
		brandOwner: food.brandOwner,
		foodCategory: food.foodCategory,
		dataType: food.dataType,
		servingSize: food.servingSize,
		servingSizeUnit: food.servingSizeUnit,
		householdServingFullText: food.householdServingFullText,
		gtinUpc: food.gtinUpc,
		customFood: food.customFood,
		barcode: food.barcode,
		barcodeSource: food.barcodeSource,
		customServingLabel: food.customServingLabel,
		customServingWeightGrams: food.customServingWeightGrams,
		customDensityGramsPerMilliliter: food.customDensityGramsPerMilliliter,
		customDensityLabel: food.customDensityLabel,
		customDensityVariancePercent: food.customDensityVariancePercent,
		customDensityConfidence: food.customDensityConfidence,
		foodNutrients: food.foodNutrients.map((nutrient) => ({
			nutrientId: nutrient.nutrientId,
			nutrientName: nutrient.nutrientName,
			nutrientNumber: nutrient.nutrientNumber,
			unitName: nutrient.unitName,
			value: nutrient.value,
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
