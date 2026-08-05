import type { FdcFood } from "$lib/utils/food/types";
import type { NutrientMeta } from "$lib/utils/mix/calculations";
import type { ServingConversion } from "$lib/utils/serving/servingAmount";
import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import type { MixSectionDisclosureProps } from "$lib/utils/mix/ui/mixSectionOrder";

export type SelectedIngredientsPanelProps = MixSectionDisclosureProps & {
	selectedFoods: FdcFood[];
	fridgeItems: FdcFood[];
	selectedNutrients: NutrientMeta[];
	servingGrams: Record<number, number>;
	getServingQuantity: (food: FdcFood) => number;
	getServingUnit: (food: FdcFood) => ServingMeasureUnit;
	getServingConversion: (food: FdcFood) => ServingConversion;
	getServingConversionWarning: (food: FdcFood) => string | null | undefined;
	conversionDetailsFoodId?: number | null;
	onOpenConversionDetails: (foodId: number) => void;
	onCloseConversionDetails: () => void;
	onRemove: (foodId: number) => void;
	onServingChange: (
		food: FdcFood,
		quantityValue: string,
		unit: ServingMeasureUnit,
	) => void;
};
