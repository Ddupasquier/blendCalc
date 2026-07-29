import type { SavedDrink } from "$lib/utils/storage/client/savedDrinks";
import type { RoundedActionButtonVariant } from "$lib/components/common/buttons/RoundedActionButton/types";

export type SavedDrinkExportActionProps = {
	drink: SavedDrink;
	compact?: boolean;
	fullWidth?: boolean;
	disabled?: boolean;
	variant?: RoundedActionButtonVariant;
};
