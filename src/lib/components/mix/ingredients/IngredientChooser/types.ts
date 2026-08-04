import type { FdcFood } from "$lib/utils/food/types";
import type { MixSectionDisclosureProps } from "$lib/utils/mix/ui/mixSectionOrder";
import type { ScrollDirection } from "$lib/utils/navigation/scrollDirection";

export type IngredientChooserProps = MixSectionDisclosureProps & {
	fridgeItems: FdcFood[];
	shoppingItems: FdcFood[];
	selectedFoodIds: number[];
	onToggleFood: (foodId: number) => void;
	onScrollDirectionChange?: (direction: ScrollDirection) => void;
	filtersOpen?: boolean;
	onOpenFilters?: () => void;
	onCloseFilters?: () => void;
};
