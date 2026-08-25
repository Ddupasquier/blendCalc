import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";

export type IngredientSearchCardProps = {
	food: FoodItem;
	index: number;
	active?: boolean;
	adding?: boolean;
	destinationListKey?: IngredientListKey;
	alreadyInDestinationList?: boolean;
	alreadyInOtherList?: boolean;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	onSelect: (food: FoodItem) => void;
	onAdd: (food: FoodItem) => void | Promise<void>;
	onActivate: (index: number) => void;
};
