import type { FdcFood } from "$lib/utils/food/types";
import type { NutrientMeta } from "$lib/utils/mix/calculations";
import type { ServingConversion } from "$lib/utils/serving/servingAmount";
import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";

export type SelectedIngredientsPanelProps = {
	selectedFoods: FdcFood[];
	fridgeItems: FdcFood[];
	selectedNutrients: NutrientMeta[];
	servingGrams: Record<number, number>;
	getServingQuantity: (food: FdcFood) => number;
	getServingUnit: (food: FdcFood) => ServingMeasureUnit;
	getServingConversion: (food: FdcFood) => ServingConversion;
	getServingConversionWarning: (food: FdcFood) => string | null | undefined;
	onRemove: (foodId: number) => void;
	onServingChange: (
		food: FdcFood,
		quantityValue: string,
		unit: ServingMeasureUnit,
	) => void;
};
