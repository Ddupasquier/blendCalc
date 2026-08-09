import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type IngredientSearchViewProps = {
	scanning?: boolean;
	filtersActive?: boolean;
	onSelect: (food: FoodItem) => void;
	onAdd: (food: FoodItem) => void | Promise<void>;
	addingFoodId?: number | null;
	savedFoodIdentityKeys?: ReadonlySet<string>;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	sourceFilter?: string;
	trustFilter?: string;
	onScan: () => void;
	onFilter: () => void;
	onClose: () => void;
};
