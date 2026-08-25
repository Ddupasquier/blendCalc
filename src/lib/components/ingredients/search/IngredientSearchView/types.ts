import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";

export type IngredientSearchViewProps = {
	scanning?: boolean;
	filtersActive?: boolean;
	onSelect: (food: FoodItem) => void;
	onAdd: (food: FoodItem) => void | Promise<void>;
	addingFoodId?: number | null;
	destinationListKey?: IngredientListKey;
	destinationListFoodIdentityKeys?: ReadonlySet<string>;
	otherListFoodIdentityKeys?: ReadonlySet<string>;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	sourceFilter?: string;
	trustFilter?: string;
	onScan: (event?: MouseEvent) => void;
	onFilter: () => void;
	onClose: () => void;
};
