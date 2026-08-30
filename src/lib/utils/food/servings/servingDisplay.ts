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

	if (
		!withoutGramWeight ||
		GENERIC_SERVING_LABEL_PATTERN.test(withoutGramWeight)
	) {
		return null;
	}

	return withoutGramWeight;
};

export const formatNutritionServingSize = (serving: FoodServing): string => {
	const gramWeight = serving.gramWeight
		? formatGramWeight(serving.gramWeight)
		: null;
	const householdLabel = getHouseholdServingLabel(serving);
	if (householdLabel && gramWeight) return `${householdLabel} (${gramWeight})`;
	if (householdLabel) return householdLabel;
	if (gramWeight) return gramWeight;
	if (serving.milliliterVolume) return `${serving.milliliterVolume}mL`;
	return serving.label;
};

export const formatServingOrigin = (serving: FoodServing): string => {
	switch (serving.origin) {
		case "package-label":
			return "Package label";
		case "source-household-measure":
			return "Source household measure";
		case "source-weight":
			return "Source-reported weight";
		case "user-entered":
			return "User-entered serving";
		case "calculated-conversion":
			return "Calculated conversion";
		default:
			return "Origin not recorded";
	}
};

export const formatServingGramWeightMethod = (serving: FoodServing): string => {
	switch (serving.gramWeightMethod) {
		case "source-reported":
			return "Weight reported directly by the source";
		case "exact-unit-conversion":
			return "Weight calculated with an exact unit conversion";
		case "user-reported":
			return "Weight entered by a user";
		case "calculated-conversion":
			return "Weight calculated from a reported serving conversion";
		default:
			return "Weight basis not recorded";
	}
};
