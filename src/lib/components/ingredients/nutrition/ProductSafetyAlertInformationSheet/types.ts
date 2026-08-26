import type { FoodSafetyAlert } from "$lib/utils/food/types";

export type ProductSafetyAlertInformationSheetProps = {
	open: boolean;
	alerts: FoodSafetyAlert[];
	onClose: () => void;
};
