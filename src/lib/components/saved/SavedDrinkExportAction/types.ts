import type { SavedDrink } from "$lib/utils/storage/client/savedDrinks";
import type { RoundedActionButtonVariant } from "$lib/components/common/buttons/RoundedActionButton/types";

export type SavedDrinkExportActionProps = {
	drink: SavedDrink;
	fullWidth?: boolean;
	disabled?: boolean;
	variant?: RoundedActionButtonVariant;
};
