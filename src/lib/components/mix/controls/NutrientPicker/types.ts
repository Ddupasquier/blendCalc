import type { MixNutrientGoal } from "$lib/utils/mix/goals/types";
import type { NutrientMeta } from "$lib/utils/mix/calculations";

export type NutrientPickerProps = {
	excludedIds: (string | number)[];
	getGoal: (nutrient: NutrientMeta) => MixNutrientGoal | null;
	onSelect: (id: string | number, targetAmount?: number) => boolean;
};
