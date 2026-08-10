import type { FoodCategoryPickerOption } from "$lib/utils/food/categories/categoryPicker";
import type { FoodCategoryPickerStatus } from "../formTypes";

export type FoodCategoryPickerProps = {
	selectedId: string;
	selectedLabel: string;
	productName: string;
	sourceCategories: string[];
	warningMessage?: string;
	onChange: (option: FoodCategoryPickerOption) => void;
	onStatusChange?: (status: FoodCategoryPickerStatus) => void;
};
