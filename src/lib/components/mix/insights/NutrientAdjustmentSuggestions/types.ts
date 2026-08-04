import type {
	NutrientFoodSuggestion,
	NutrientReductionSuggestion,
} from "$lib/utils/mix/calculations";
import type { MixSectionDisclosureProps } from "$lib/utils/mix/ui/mixSectionOrder";

export type NutrientAdjustment =
	| { type: "add"; suggestion: NutrientFoodSuggestion }
	| { type: "reduce"; suggestion: NutrientReductionSuggestion };

export type NutrientAdjustmentSuggestionsProps = MixSectionDisclosureProps & {
	foodSuggestions?: NutrientFoodSuggestion[];
	reductionSuggestions?: NutrientReductionSuggestion[];
	onAdd: (foodId: number, servingGrams: number) => void;
	onReduce: (foodId: number, nextServingGrams: number) => void;
	maxSuggestions?: number;
};
