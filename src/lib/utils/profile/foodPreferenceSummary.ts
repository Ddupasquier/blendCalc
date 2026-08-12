import type { NutrientDisplayField } from "$lib/utils/food/reference/appReferenceCatalog";
import {
	getServingSizeDisplayValue,
	type DefaultServingUnit,
} from "$lib/utils/profile/foodPreferences";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
import type { RegulatoryRegionOption } from "$lib/utils/profile/regulatoryRegion";

export type SavedFoodPreferenceSummaryItem = {
	label: string;
	value: string;
};

export const getSavedFoodPreferenceSummaryItems = ({
	foodPreferences,
	priorityNutrientOptions,
	regulatoryRegionOptions,
}: {
	foodPreferences: FoodPreferenceProfile | null;
	priorityNutrientOptions: NutrientDisplayField[];
	regulatoryRegionOptions: RegulatoryRegionOption[];
}): SavedFoodPreferenceSummaryItem[] => {
	if (!foodPreferences) return [];

	const servingUnit: DefaultServingUnit =
		foodPreferences.unitSystem === "us" ? "oz" : "g";
	const priorityNutrientLabels = foodPreferences.prioritizedNutrientIds
		.map(
			(nutrientId) =>
				priorityNutrientOptions.find((nutrient) => nutrient.id === nutrientId)
					?.label,
		)
		.filter((label): label is string => Boolean(label));
	const summaryItems = [
		foodPreferences.regulatoryRegionCode
			? {
					label: "Label region",
					value:
						regulatoryRegionOptions.find(
							(option) =>
								option.regionCode === foodPreferences.regulatoryRegionCode,
						)?.displayName ??
						`Unavailable (${foodPreferences.regulatoryRegionCode})`,
				}
			: null,
		foodPreferences.unitSystem
			? {
					label: "Units",
					value:
						foodPreferences.unitSystem === "us" ? "US units" : "Metric",
				}
			: null,
		foodPreferences.defaultMixServingGrams
			? {
					label: "Serving",
					value: `${getServingSizeDisplayValue(
						foodPreferences.defaultMixServingGrams,
						servingUnit,
					)} ${servingUnit}`,
				}
			: null,
		foodPreferences.allergens.length
			? {
					label: "Allergens",
					value: foodPreferences.allergens.join(", "),
				}
			: null,
		foodPreferences.dietaryRestrictions.length
			? {
					label: "Dietary restrictions",
					value: foodPreferences.dietaryRestrictions.join(", "),
				}
			: null,
		priorityNutrientLabels.length
			? {
					label: "Priority nutrients",
					value: priorityNutrientLabels.join(", "),
				}
			: null,
	];

	return summaryItems.filter(
		(item): item is SavedFoodPreferenceSummaryItem => item !== null,
	);
};
