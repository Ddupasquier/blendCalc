import { browser } from "$app/environment";
import type { FoodPreferenceOptionSets } from "$lib/utils/profile/foodPreferenceOptions";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
import {
	getServingSizeDisplayValue,
	type DefaultServingUnit,
	type FoodPreferenceFormValues,
	type FoodPreferenceUnitSystem,
} from "$lib/utils/profile/foodPreferences";
import {
	getDeviceRegulatoryRegionSuggestion,
	type RegulatoryRegionOption,
	type RegulatoryRegionSelectionSource,
} from "$lib/utils/profile/regulatoryRegion";
import type {
	FoodPreferenceDisclosureKey,
	FoodPreferenceGroupKey,
} from "./types";

type ProfileFoodPreferenceFormStateOptions = {
	getFoodPreferences: () => FoodPreferenceProfile | null;
	getFoodPreferenceOptions: () => FoodPreferenceOptionSets;
	getRegulatoryRegionOptions: () => RegulatoryRegionOption[];
	getSubmittedValues: () => FoodPreferenceFormValues | null | undefined;
	getErrorMessage: () => string | null | undefined;
};

const normalizePreferenceValue = (value: string) =>
	value.toLocaleLowerCase().trim().replace(/\s+/g, " ");

const uniquePreferenceValues = (values: string[]) => {
	const seen = new Set<string>();
	return values.filter((value) => {
		const key = normalizePreferenceValue(value);
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

export const createProfileFoodPreferenceFormState = (
	options: ProfileFoodPreferenceFormStateOptions,
) => {
	const form = $state({
		isSaving: false,
		regulatoryRegionCode: "",
		regulatoryRegionSource: null as RegulatoryRegionSelectionSource | null,
		allergens: [] as string[],
		dietaryRestrictions: [] as string[],
		prioritizedNutrientIds: [] as number[],
		unitSystem: "" as FoodPreferenceUnitSystem | "" | null,
		defaultServingSize: "",
		defaultServingUnit: "g" as DefaultServingUnit,
		sensitiveAcknowledged: false,
	});
	const openSections = $state<Record<FoodPreferenceDisclosureKey, boolean>>({
		region: false,
		measurements: false,
		allergens: false,
		dietaryRestrictions: false,
		priorityNutrients: false,
	});
	let previousSeed = "";
	let previousErrorMessage: string | null = null;

	const storedServingUnit = $derived<DefaultServingUnit>(
		options.getFoodPreferences()?.unitSystem === "us" ? "oz" : "g",
	);
	const storedUnitSystem = $derived.by<FoodPreferenceUnitSystem | "">(() => {
		const unitSystem = options.getFoodPreferences()?.unitSystem;
		return unitSystem === "metric" || unitSystem === "us" ? unitSystem : "";
	});
	const incomingValues = $derived.by(() => {
		const foodPreferences = options.getFoodPreferences();
		const submittedValues = options.getSubmittedValues();
		return {
			unitSystem: submittedValues?.unitSystem ?? storedUnitSystem,
			allergens: submittedValues?.allergens ?? foodPreferences?.allergens ?? [],
			dietaryRestrictions:
				submittedValues?.dietaryRestrictions ??
				foodPreferences?.dietaryRestrictions ??
				[],
			prioritizedNutrientIds:
				submittedValues?.prioritizedNutrientIds ??
				foodPreferences?.prioritizedNutrientIds ??
				[],
			defaultMixServingUnit:
				submittedValues?.defaultMixServingUnit ?? storedServingUnit,
			defaultMixServingSize:
				submittedValues?.defaultMixServingSize ??
				getServingSizeDisplayValue(
					foodPreferences?.defaultMixServingGrams,
					storedServingUnit,
				),
			sensitiveAcknowledged:
				submittedValues?.sensitiveAcknowledged ??
				Boolean(foodPreferences?.sensitiveAcknowledgedAt),
			regulatoryRegionCode:
				submittedValues?.regulatoryRegionCode ??
				foodPreferences?.regulatoryRegionCode ??
				"",
			regulatoryRegionSource:
				submittedValues?.regulatoryRegionSource ??
				foodPreferences?.regulatoryRegionSource ??
				null,
		};
	});
	const incomingValuesSeed = $derived(JSON.stringify(incomingValues));

	$effect(() => {
		const seed = incomingValuesSeed;
		if (seed === previousSeed) return;
		previousSeed = seed;
		form.regulatoryRegionCode = incomingValues.regulatoryRegionCode;
		form.regulatoryRegionSource = incomingValues.regulatoryRegionSource;
		form.allergens = [...incomingValues.allergens];
		form.dietaryRestrictions = [...incomingValues.dietaryRestrictions];
		form.prioritizedNutrientIds = [...incomingValues.prioritizedNutrientIds];
		form.unitSystem = incomingValues.unitSystem;
		form.defaultServingSize = incomingValues.defaultMixServingSize;
		form.defaultServingUnit = incomingValues.defaultMixServingUnit;
		form.sensitiveAcknowledged = incomingValues.sensitiveAcknowledged;

		if (!browser || form.regulatoryRegionCode) return;
		const suggestion = getDeviceRegulatoryRegionSuggestion(
			navigator.languages,
			options.getRegulatoryRegionOptions(),
		);
		if (!suggestion) return;
		form.regulatoryRegionCode = suggestion;
		form.regulatoryRegionSource = "device";
	});

	$effect(() => {
		const errorMessage = options.getErrorMessage();
		if (!errorMessage) {
			previousErrorMessage = null;
			return;
		}
		if (errorMessage === previousErrorMessage) return;
		previousErrorMessage = errorMessage;
		for (const key of Object.keys(openSections) as FoodPreferenceDisclosureKey[]) {
			openSections[key] = true;
		}
	});

	const selectedRegion = $derived(
		options.getRegulatoryRegionOptions().find(
			(option) => option.regionCode === form.regulatoryRegionCode,
		) ?? null,
	);
	const hasUnsupportedRegion = $derived(
		Boolean(form.regulatoryRegionCode && !selectedRegion),
	);
	const resolvedAllergenKeys = $derived(
		new Set(
			(options.getFoodPreferences()?.preferenceResolutions ?? [])
				.filter((resolution) =>
					resolution.ruleType === "allergen" && resolution.status === "resolved")
				.map((resolution) => normalizePreferenceValue(resolution.rawValue)),
		),
	);
	const resolvedDietaryRestrictionKeys = $derived(
		new Set(
			(options.getFoodPreferences()?.preferenceResolutions ?? [])
				.filter((resolution) =>
					resolution.ruleType === "dietary_restriction" &&
					resolution.status === "resolved")
				.map((resolution) => normalizePreferenceValue(resolution.rawValue)),
		),
	);
	const reviewedAllergenKeys = $derived(
		new Set(options.getFoodPreferenceOptions().allergens.flatMap((option) => [
			option.normalizedValue,
			normalizePreferenceValue(option.label),
		])),
	);
	const reviewedDietaryRestrictionKeys = $derived(
		new Set(
			options.getFoodPreferenceOptions().dietaryRestrictions.flatMap((option) => [
				option.normalizedValue,
				normalizePreferenceValue(option.label),
			]),
		),
	);
	const unresolvedAllergens = $derived(
		form.allergens.filter((value) => {
			const key = normalizePreferenceValue(value);
			return !reviewedAllergenKeys.has(key) && !resolvedAllergenKeys.has(key);
		}),
	);
	const unresolvedDietaryRestrictions = $derived(
		form.dietaryRestrictions.filter((value) => {
			const key = normalizePreferenceValue(value);
			return !reviewedDietaryRestrictionKeys.has(key) &&
				!resolvedDietaryRestrictionKeys.has(key);
		}),
	);
	const measurementSummary = $derived(
		[
			form.unitSystem === "metric"
				? "Metric display"
				: form.unitSystem === "us"
					? "US display"
					: null,
			form.defaultServingSize
				? `${form.defaultServingSize} ${form.defaultServingUnit} Mix start`
				: null,
		].filter(Boolean).join(" · ") || "App defaults",
	);
	const getGroupPendingValues = (group: FoodPreferenceGroupKey) =>
		group === "allergens"
			? unresolvedAllergens
			: unresolvedDietaryRestrictions;
	const getGroupSummary = (group: FoodPreferenceGroupKey) => {
		const selectedCount = readGroup(group).length;
		const pendingCount = getGroupPendingValues(group).length;
		const activeCount = Math.max(0, selectedCount - pendingCount);
		if (selectedCount === 0) return "None saved";
		return [
			activeCount ? `${activeCount} active` : null,
			pendingCount ? `${pendingCount} pending` : null,
		].filter(Boolean).join(" · ");
	};
	const regionSummary = $derived(
		selectedRegion
			? [
					selectedRegion.regionCode,
					selectedRegion.policyVersion
						? `policy v${selectedRegion.policyVersion}`
						: null,
				].filter(Boolean).join(" · ")
			: "Personal settings only",
	);

	const readGroup = (group: FoodPreferenceGroupKey) =>
		group === "allergens" ? form.allergens : form.dietaryRestrictions;
	const writeGroup = (group: FoodPreferenceGroupKey, values: string[]) => {
		const nextValues = uniquePreferenceValues(values);
		if (group === "allergens") form.allergens = nextValues;
		else form.dietaryRestrictions = nextValues;
	};
	const addPreference = (group: FoodPreferenceGroupKey, value: string) => {
		const cleanedValue = value.trim().replace(/\s+/g, " ");
		if (!cleanedValue) return;
		if (
			readGroup(group).some(
				(item) => normalizePreferenceValue(item) === normalizePreferenceValue(cleanedValue),
			)
		) return;
		writeGroup(group, [...readGroup(group), cleanedValue]);
	};
	const removePreference = (group: FoodPreferenceGroupKey, value: string) => {
		const valueKey = normalizePreferenceValue(value);
		writeGroup(
			group,
			readGroup(group).filter((item) => normalizePreferenceValue(item) !== valueKey),
		);
	};
	const clearPreferenceGroup = (group: FoodPreferenceGroupKey) => {
		writeGroup(group, []);
	};
	const restoreMeasurementDefaults = () => {
		form.unitSystem = "";
		form.defaultServingSize = "";
		form.defaultServingUnit = "g";
	};
	const setSectionOpen = (
		section: FoodPreferenceDisclosureKey,
		open: boolean,
	) => {
		openSections[section] = open;
	};
	const selectRegulatoryRegion = (value: string) => {
		form.regulatoryRegionCode = value;
		form.regulatoryRegionSource = value ? "account" : null;
	};

	return {
		form,
		openSections,
		readGroup,
		addPreference,
		removePreference,
		clearPreferenceGroup,
		restoreMeasurementDefaults,
		getGroupSummary,
		setSectionOpen,
		selectRegulatoryRegion,
		get selectedRegion() {
			return selectedRegion;
		},
		get hasUnsupportedRegion() {
			return hasUnsupportedRegion;
		},
		get unresolvedAllergens() {
			return unresolvedAllergens;
		},
		get unresolvedDietaryRestrictions() {
			return unresolvedDietaryRestrictions;
		},
		get measurementSummary() {
			return measurementSummary;
		},
		get regionSummary() {
			return regionSummary;
		},
	};
};

export type ProfileFoodPreferenceFormState = ReturnType<
	typeof createProfileFoodPreferenceFormState
>;
