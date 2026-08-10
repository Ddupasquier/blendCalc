import type { DefaultServingUnit, FoodPreferenceUnitSystem } from "$lib/utils/profile/foodPreferences";
import type {
	RegulatoryRegionOption,
	RegulatoryRegionSelectionSource,
} from "$lib/utils/profile/regulatoryRegion";

export type ProfileFoodPreferenceBasicsProps = {
	regulatoryRegionCode: string;
	regulatoryRegionSource: RegulatoryRegionSelectionSource | null;
	regulatoryRegionOptions: RegulatoryRegionOption[];
	hasUnsupportedRegion: boolean;
	unitSystem: FoodPreferenceUnitSystem | "" | null;
	defaultServingSize: string;
	defaultServingUnit: DefaultServingUnit;
	disabled: boolean;
	onRegulatoryRegionChange: (value: string) => void;
};
