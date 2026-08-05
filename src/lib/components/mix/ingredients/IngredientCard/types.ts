import type { FdcFood } from "$lib/utils/food/types";
import type { NutrientChip } from "$lib/utils/mix/ui/mixUi";
import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";

export type IngredientCardProps = {
	food: FdcFood;
	sourceLabel: string;
	quantity: number;
	unit: ServingMeasureUnit;
	gramsLabel: string | null;
	conversionBasis?: string | null;
	warning?: string | null;
	nutrientChips?: NutrientChip[];
	conversionDetailsOpen?: boolean;
	onOpenConversionDetails: (foodId: number) => void;
	onCloseConversionDetails: () => void;
	onRemove: (foodId: number) => void;
	onServingChange: (
		food: FdcFood,
		quantityValue: string,
		unit: ServingMeasureUnit,
	) => void;
};
