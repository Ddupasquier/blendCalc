import type { FoodSafetyAlert } from "$lib/utils/food/types";
import type { DialogReturnFocusTarget } from "$lib/utils/accessibility/dialogFocus";

export type ProductSafetyAlertInformationSheetProps = {
	open: boolean;
	alerts: FoodSafetyAlert[];
	returnFocusTarget?: DialogReturnFocusTarget;
	onClose: () => void;
};
