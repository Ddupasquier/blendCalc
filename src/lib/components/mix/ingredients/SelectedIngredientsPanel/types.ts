import type { FoodItem } from "$lib/utils/food/types";
import type { NutrientMeta } from "$lib/utils/mix/calculations";
import type { ServingConversion } from "$lib/utils/serving/servingAmount";
import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import type { MixSectionDisclosureProps } from "$lib/utils/mix/ui/mixSectionOrder";

export type SelectedIngredientsPanelProps = MixSectionDisclosureProps & {
	selectedFoods: FoodItem[];
	fridgeItems: FoodItem[];
	selectedNutrients: NutrientMeta[];
	servingGrams: Record<number, number>;
	getServingQuantity: (food: FoodItem) => number;
	getServingUnit: (food: FoodItem) => ServingMeasureUnit;
	getServingConversion: (food: FoodItem) => ServingConversion;
	getServingConversionWarning: (food: FoodItem) => string | null | undefined;
	conversionDetailsFoodId?: number | null;
	onOpenConversionDetails: (foodId: number) => void;
	onCloseConversionDetails: () => void;
	onRemove: (foodId: number) => void;
	onServingChange: (
		food: FoodItem,
		quantityValue: string,
		unit: ServingMeasureUnit,
	) => void;
};
