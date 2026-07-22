import type { NutrientOption } from "$lib/utils/mix/ui/mixUi";

export type NutrientSelectorProps = {
	options: NutrientOption[];
	selected: (string | number)[];
	selectedCount: number;
	onChange: (next: (string | number)[]) => void;
	onAddNutrient: (id: string | number) => void;
};
