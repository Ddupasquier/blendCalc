import type { FdcFood } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type IngredientSearchCardProps = {
	food: FdcFood;
	index: number;
	active?: boolean;
	adding?: boolean;
	saved?: boolean;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	onSelect: (food: FdcFood) => void;
	onAdd: (food: FdcFood) => void | Promise<void>;
	onActivate: (index: number) => void;
};
