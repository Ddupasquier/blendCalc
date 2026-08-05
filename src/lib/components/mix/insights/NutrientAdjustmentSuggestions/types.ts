import type { NutrientAdjustmentSuggestion } from "$lib/utils/mix/calculations";
import type { MixSectionDisclosureProps } from "$lib/utils/mix/ui/mixSectionOrder";

export type NutrientAdjustmentSuggestionsProps = MixSectionDisclosureProps & {
	suggestions?: NutrientAdjustmentSuggestion[];
	onApply: (foodId: number, servingGrams: number) => void;
};
