import type { FoodItem } from "$lib/utils/food/types";
import type { MixSectionDisclosureProps } from "$lib/utils/mix/ui/mixSectionOrder";

export type IngredientChooserProps = MixSectionDisclosureProps & {
	fridgeItems: FoodItem[];
	shoppingItems: FoodItem[];
	selectedFoodIds: number[];
	onToggleFood: (foodId: number) => void;
	filtersOpen?: boolean;
	onOpenFilters?: () => void;
	onCloseFilters?: () => void;
};
