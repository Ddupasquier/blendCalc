import type { RegulatoryRegionOption } from "./regulatoryRegion";

export const FOOD_PREFERENCE_MAX_ITEMS = 30;
export const FOOD_PREFERENCE_MAX_LENGTH = 60;
export const DEFAULT_SERVING_SIZE_MAX_GRAMS = 5000;
export const OUNCE_TO_GRAMS = 28.349523125;

export const FOOD_PREFERENCE_UNIT_SYSTEMS = ["metric", "us"] as const;
export const DEFAULT_SERVING_UNITS = ["g", "oz"] as const;

export type FoodPreferenceUnitSystem =
	(typeof FOOD_PREFERENCE_UNIT_SYSTEMS)[number];
export type DefaultServingUnit = (typeof DEFAULT_SERVING_UNITS)[number];

export type FoodPreferenceFormValues = {
	unitSystem: FoodPreferenceUnitSystem | null;
	allergens: string[];
	dietaryRestrictions: string[];
	prioritizedNutrientIds: number[];
	defaultSmoothieServingSize: string;
	defaultSmoothieServingUnit: DefaultServingUnit;
	sensitiveAcknowledged: boolean;
	regulatoryRegionCode: string;
	regulatoryRegionSource: "account" | "device" | null;
};

export const normalizeUnitSystem = (
	value: FormDataEntryValue | null,
): FoodPreferenceUnitSystem | null => {
	const normalized = String(value ?? "").trim();
	if (FOOD_PREFERENCE_UNIT_SYSTEMS.includes(normalized as FoodPreferenceUnitSystem)) {
		return normalized as FoodPreferenceUnitSystem;
	}
	return null;
};

export const normalizeServingUnit = (
	value: FormDataEntryValue | null,
): DefaultServingUnit => {
	const normalized = String(value ?? "").trim();
	if (DEFAULT_SERVING_UNITS.includes(normalized as DefaultServingUnit)) {
		return normalized as DefaultServingUnit;
	}
	return "g";
};

export const parsePreferenceList = (
	value: FormDataEntryValue | null,
	maxItems = FOOD_PREFERENCE_MAX_ITEMS,
) => {
	const seen = new Set<string>();
	const parsed = String(value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean)
		.filter((item) => {
			const key = item.toLocaleLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});

	return parsed.slice(0, maxItems);
};

export const parsePrioritizedNutrientIds = (values: FormDataEntryValue[]) => {
	const ids = values
		.map((value) => Number(value))
		.filter((value) => Number.isInteger(value) && value > 0);

	return [...new Set(ids)].slice(0, FOOD_PREFERENCE_MAX_ITEMS);
};

export const getServingSizeGrams = (
	quantity: string,
	unit: DefaultServingUnit,
) => {
	const parsed = Number(quantity);
	if (!Number.isFinite(parsed) || parsed <= 0) return null;
	return unit === "oz" ? parsed * OUNCE_TO_GRAMS : parsed;
};

export const getServingSizeDisplayValue = (
	grams: number | null | undefined,
	unit: DefaultServingUnit,
) => {
	if (!grams) return "";
	const displayValue = unit === "oz" ? grams / OUNCE_TO_GRAMS : grams;
	return Number(displayValue.toFixed(2)).toString();
};

export const hasFoodPreferenceValues = (values: FoodPreferenceFormValues) =>
	Boolean(
		values.unitSystem ||
			values.regulatoryRegionCode ||
			values.allergens.length ||
			values.dietaryRestrictions.length ||
			values.prioritizedNutrientIds.length ||
			values.defaultSmoothieServingSize.trim(),
	);

const getLongPreferenceItem = (values: string[]) =>
	values.find((value) => value.length > FOOD_PREFERENCE_MAX_LENGTH);

export const getFoodPreferencesValidationError = (
	values: FoodPreferenceFormValues,
	regulatoryRegionOptions: RegulatoryRegionOption[] = [],
) => {
	if (
		values.regulatoryRegionCode &&
		!regulatoryRegionOptions.some((option) =>
			option.regionCode === values.regulatoryRegionCode
		)
	) {
		return "Choose a supported label region and try again.";
	}
	if (
		Boolean(values.regulatoryRegionCode) !==
		Boolean(values.regulatoryRegionSource)
	) {
		return "Choose a label region again so we can save it correctly.";
	}
	const preferenceGroups = [values.allergens, values.dietaryRestrictions];
	const longItem = preferenceGroups.map(getLongPreferenceItem).find(Boolean);
	if (longItem) {
		return `Preference entries must be ${FOOD_PREFERENCE_MAX_LENGTH} characters or fewer. Shorten “${longItem}”.`;
	}
	if (!hasFoodPreferenceValues(values)) return "";
	if (!values.sensitiveAcknowledged) {
		return "Confirm that you want these optional preferences saved to your account.";
	}

	const servingSizeGrams = getServingSizeGrams(
		values.defaultSmoothieServingSize,
		values.defaultSmoothieServingUnit,
	);
	if (
		values.defaultSmoothieServingSize.trim() &&
		(!servingSizeGrams || servingSizeGrams > DEFAULT_SERVING_SIZE_MAX_GRAMS)
	) {
		return "Default smoothie serving size must be greater than 0 and no more than 5,000g.";
	}

	return "";
};
