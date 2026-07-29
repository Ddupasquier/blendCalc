import type { SavedDrink } from "$lib/utils/storage/client/savedDrinks";

export type SavedDrinkCardProps = {
	drink: SavedDrink;
	loading?: boolean;
	deleting?: boolean;
	disabled?: boolean;
	onLoad: (drink: SavedDrink) => void;
	onDelete: (drink: SavedDrink) => void;
};
