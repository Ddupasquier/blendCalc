import type {
	NutrientFoodSuggestion,
	NutrientReductionSuggestion,
} from "$lib/utils/mix/calculations";

export type NutrientAdjustment =
	| { type: "add"; suggestion: NutrientFoodSuggestion }
	| { type: "reduce"; suggestion: NutrientReductionSuggestion };

export type NutrientAdjustmentSuggestionsProps = {
	foodSuggestions?: NutrientFoodSuggestion[];
	reductionSuggestions?: NutrientReductionSuggestion[];
	onAdd: (foodId: number, servingGrams: number) => void;
	onReduce: (foodId: number, nextServingGrams: number) => void;
	maxSuggestions?: number;
};
