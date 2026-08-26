import type { NutrientDisplayField } from "$lib/utils/food/reference/appReferenceCatalog";
import type { FoodPreferenceOptionSets } from "$lib/utils/profile/foodPreferenceOptions";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
import type { FoodPreferenceFormValues } from "$lib/utils/profile/foodPreferences";
import type { RegulatoryRegionOption } from "$lib/utils/profile/regulatoryRegion";

export type ProfileFoodPreferenceSettingsProps = {
	foodPreferences: FoodPreferenceProfile | null;
	foodPreferencesUnavailable: boolean;
	foodPreferenceOptions: FoodPreferenceOptionSets;
	foodPreferenceOptionsUnavailable: boolean;
	priorityNutrientOptions: NutrientDisplayField[];
	regulatoryRegionOptions: RegulatoryRegionOption[];
	submittedValues?: FoodPreferenceFormValues | null;
	errorMessage?: string | null;
	successMessage?: string | null;
	onSaveSuccess?: () => void;
};

export type FoodPreferenceGroupKey = "allergens" | "dietaryRestrictions";

export type FoodPreferenceDisclosureKey =
	"region" | "measurements" | FoodPreferenceGroupKey | "priorityNutrients";

export type FoodPreferenceGroupPresentation = {
	title: string;
	description: string;
	customEntryLabel: string;
};
