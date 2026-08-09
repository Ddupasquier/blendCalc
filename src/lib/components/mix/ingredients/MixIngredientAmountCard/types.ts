import type { FoodItem } from "$lib/utils/food/types";
import type { NutrientChip } from "$lib/utils/mix/ui/mixUi";
import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";

export type MixIngredientAmountCardProps = {
	food: FoodItem;
	sourceListLabel: string;
	servingQuantity: number;
	servingUnit: ServingMeasureUnit;
	convertedWeightLabel: string | null;
	servingConversionBasis?: string | null;
	servingConversionWarningMessage?: string | null;
	nutrientContributionChips?: NutrientChip[];
	isServingConversionDetailsOpen?: boolean;
	onOpenConversionDetails: (foodId: number) => void;
	onCloseConversionDetails: () => void;
	onRemove: (foodId: number) => void;
	onServingChange: (
		food: FoodItem,
		quantityValue: string,
		unit: ServingMeasureUnit,
	) => void;
};
