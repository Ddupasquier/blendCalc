import type { NutrientDisplayField } from "$lib/utils/food/reference/appReferenceCatalog";

export type ProfileNutrientPrioritySettingsProps = {
	options: NutrientDisplayField[];
	selectedNutrientIds: number[];
	disabled: boolean;
	onSelectionChange: (selectedNutrientIds: number[]) => void;
};
