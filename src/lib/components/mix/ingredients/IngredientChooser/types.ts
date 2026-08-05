import type { FdcFood } from "$lib/utils/food/types";
import type { MixSectionDisclosureProps } from "$lib/utils/mix/ui/mixSectionOrder";

export type IngredientChooserProps = MixSectionDisclosureProps & {
	fridgeItems: FdcFood[];
	shoppingItems: FdcFood[];
	selectedFoodIds: number[];
	onToggleFood: (foodId: number) => void;
	filtersOpen?: boolean;
	onOpenFilters?: () => void;
	onCloseFilters?: () => void;
};
