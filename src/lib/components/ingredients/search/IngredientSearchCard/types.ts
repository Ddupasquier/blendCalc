import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type IngredientSearchCardProps = {
	food: FoodItem;
	index: number;
	active?: boolean;
	adding?: boolean;
	saved?: boolean;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	onSelect: (food: FoodItem) => void;
	onAdd: (food: FoodItem) => void | Promise<void>;
	onActivate: (index: number) => void;
};
