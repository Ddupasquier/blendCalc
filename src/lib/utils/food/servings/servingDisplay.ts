import type { FoodServing } from "$lib/utils/food/types";

const GRAM_TEXT_PATTERN = /\(?\b\d+(?:\.\d+)?\s*(?:g|gram|grams)\b\)?/gi;
const GENERIC_SERVING_LABEL_PATTERN = /^(?:serving|portion)$/i;

const formatGramWeight = (gramWeight: number): string =>
	`${Number(gramWeight.toFixed(2))}g`;

const getHouseholdServingLabel = (serving: FoodServing): string | null => {
	const withoutGramWeight = serving.label
		.replace(GRAM_TEXT_PATTERN, " ")
		.replace(/^[\s,;:·/\-()]+|[\s,;:·/\-()]+$/g, "")
		.replace(/\s+/g, " ")
		.trim();

	if (!withoutGramWeight || GENERIC_SERVING_LABEL_PATTERN.test(withoutGramWeight)) {
		return null;
	}

	return withoutGramWeight;
};

export const formatNutritionServingSize = (serving: FoodServing): string => {
	const gramWeight = formatGramWeight(serving.gramWeight);
	const householdLabel = getHouseholdServingLabel(serving);
	return householdLabel ? `${householdLabel} (${gramWeight})` : gramWeight;
};
