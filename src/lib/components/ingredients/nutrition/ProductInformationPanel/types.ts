import type { FoodItem } from "$lib/utils/food/types";

export type ProductInformationPanelProps = {
	food: FoodItem;
	onReportIncorrectInformation?: () => void;
};
