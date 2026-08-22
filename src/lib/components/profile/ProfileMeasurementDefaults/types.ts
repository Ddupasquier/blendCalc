import type {
	DefaultServingUnit,
	FoodPreferenceUnitSystem,
} from "$lib/utils/profile/foodPreferences";

export type ProfileMeasurementDefaultsProps = {
	unitSystem: FoodPreferenceUnitSystem | "" | null;
	defaultServingSize: string;
	defaultServingUnit: DefaultServingUnit;
	disabled: boolean;
	onUnitSystemChange: (unitSystem: FoodPreferenceUnitSystem | "") => void;
	onDefaultServingSizeChange: (value: string) => void;
	onDefaultServingUnitChange: (unit: DefaultServingUnit) => void;
	onRestoreDefaults: () => void;
};
