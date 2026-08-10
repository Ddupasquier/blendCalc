<script lang="ts">
	import { browser } from "$app/environment";
	import { enhance } from "$app/forms";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import CheckboxField from "$lib/components/common/forms/CheckboxField/CheckboxField.svelte";
	import FoodPreferencePicker from "$lib/components/profile/FoodPreferencePicker/FoodPreferencePicker.svelte";
	import ProfileFoodPreferenceBasics from "$lib/components/profile/ProfileFoodPreferenceBasics/ProfileFoodPreferenceBasics.svelte";
	import ProfileNutrientPrioritySettings from "$lib/components/profile/ProfileNutrientPrioritySettings/ProfileNutrientPrioritySettings.svelte";
	import SavedFoodPreferenceSummary from "$lib/components/profile/SavedFoodPreferenceSummary/SavedFoodPreferenceSummary.svelte";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import {
		getServingSizeDisplayValue,
		type DefaultServingUnit,
		type FoodPreferenceUnitSystem,
	} from "$lib/utils/profile/foodPreferences";
	import {
		getDeviceRegulatoryRegionSuggestion,
		type RegulatoryRegionSelectionSource,
	} from "$lib/utils/profile/regulatoryRegion";
	import type {
		FoodPreferenceGroupKey,
		FoodPreferenceGroupPresentation,
		ProfileFoodPreferenceSettingsProps,
	} from "./types";

	let {
		foodPreferences,
		foodPreferencesUnavailable,
		foodPreferenceOptions,
		priorityNutrientOptions,
		regulatoryRegionOptions,
		submittedValues,
		errorMessage,
		successMessage,
		onSaveSuccess,
	}: ProfileFoodPreferenceSettingsProps = $props();

	const storedServingUnit = $derived<DefaultServingUnit>(
		foodPreferences?.unitSystem === "us" ? "oz" : "g",
	);
	const storedUnitSystem = $derived(
		foodPreferences?.unitSystem === "metric" || foodPreferences?.unitSystem === "us"
			? foodPreferences.unitSystem
			: "",
	);
	const selectedUnitSystem = $derived<FoodPreferenceUnitSystem | "" | null>(
		submittedValues?.unitSystem ?? storedUnitSystem,
	);
	const incomingValues = $derived({
		unitSystem: selectedUnitSystem,
		allergens: submittedValues?.allergens ?? foodPreferences?.allergens ?? [],
		dietaryRestrictions:
			submittedValues?.dietaryRestrictions ?? foodPreferences?.dietaryRestrictions ?? [],
		prioritizedNutrientIds:
			submittedValues?.prioritizedNutrientIds ??
			foodPreferences?.prioritizedNutrientIds ??
			[],
		defaultMixServingUnit: submittedValues?.defaultMixServingUnit ?? storedServingUnit,
		defaultMixServingSize:
			submittedValues?.defaultMixServingSize ??
			getServingSizeDisplayValue(foodPreferences?.defaultMixServingGrams, storedServingUnit),
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
	});

	let isSaving = $state(false);
	let regulatoryRegionCode = $state("");
	let regulatoryRegionSource = $state<RegulatoryRegionSelectionSource | null>(null);
	let allergens = $state<string[]>([]);
	let dietaryRestrictions = $state<string[]>([]);
	let prioritizedNutrientIds = $state<number[]>([]);
	let previousSeed = "";
	let preferenceSearch = $state<Record<FoodPreferenceGroupKey, string>>({
		allergens: "",
		dietaryRestrictions: "",
	});
	let preferenceSelect = $state<Record<FoodPreferenceGroupKey, string>>({
		allergens: "",
		dietaryRestrictions: "",
	});

	const valuesSeed = $derived(JSON.stringify(incomingValues));
	$effect(() => {
		const seed = valuesSeed;
		if (seed === previousSeed) return;
		previousSeed = seed;
		regulatoryRegionCode = incomingValues.regulatoryRegionCode;
		regulatoryRegionSource = incomingValues.regulatoryRegionSource;
		allergens = [...incomingValues.allergens];
		dietaryRestrictions = [...incomingValues.dietaryRestrictions];
		prioritizedNutrientIds = [...incomingValues.prioritizedNutrientIds];

		if (!browser || regulatoryRegionCode) return;
		const suggestion = getDeviceRegulatoryRegionSuggestion(
			navigator.languages,
			regulatoryRegionOptions,
		);
		if (!suggestion) return;
		regulatoryRegionCode = suggestion;
		regulatoryRegionSource = "device";
	});

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
	const getOptionRows = (optionLabels: string[], selectedValues: string[]) =>
		uniquePreferenceValues([...optionLabels, ...selectedValues]);

	const groupPresentation: Record<
		FoodPreferenceGroupKey,
		FoodPreferenceGroupPresentation
	> = {
		allergens: {
			title: "Allergens",
			helper:
				"Reviewed matches add warnings when food details conflict. New terms stay saved while their match is reviewed.",
			searchLabel: "Type your own allergen",
			selectLabel: "Common allergens",
		},
		dietaryRestrictions: {
			title: "Dietary restrictions",
			helper:
				"Reviewed matches warn on possible conflicts without preventing an item from being added.",
			searchLabel: "Type your own restriction",
			selectLabel: "Common restrictions",
		},
	};

	const readGroup = (group: FoodPreferenceGroupKey) =>
		group === "allergens" ? allergens : dietaryRestrictions;
	const writeGroup = (group: FoodPreferenceGroupKey, values: string[]) => {
		const nextValues = uniquePreferenceValues(values);
		if (group === "allergens") allergens = nextValues;
		else dietaryRestrictions = nextValues;
	};
	const getOptionPool = (group: FoodPreferenceGroupKey) =>
		group === "allergens" ? allergenOptions : restrictionOptions;
	const getAvailableOptions = (group: FoodPreferenceGroupKey) => {
		const selectedValues = new Set(readGroup(group).map(normalizePreferenceValue));
		return getOptionPool(group).filter(
			(option) => !selectedValues.has(normalizePreferenceValue(option)),
		);
	};
	const getFilteredOptions = (group: FoodPreferenceGroupKey) => {
		const query = normalizePreferenceValue(preferenceSearch[group]);
		return getAvailableOptions(group).filter((option) =>
			!query || normalizePreferenceValue(option).includes(query)
		);
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
		preferenceSearch = { ...preferenceSearch, [group]: "" };
		preferenceSelect = { ...preferenceSelect, [group]: "" };
	};
	const removePreference = (group: FoodPreferenceGroupKey, value: string) => {
		const valueKey = normalizePreferenceValue(value);
		writeGroup(
			group,
			readGroup(group).filter((item) => normalizePreferenceValue(item) !== valueKey),
		);
	};

	const selectedRegion = $derived(
		regulatoryRegionOptions.find((option) => option.regionCode === regulatoryRegionCode) ?? null,
	);
	const hasUnsupportedRegion = $derived(
		Boolean(regulatoryRegionCode && !selectedRegion),
	);
	const allergenOptions = $derived(
		getOptionRows(
			foodPreferenceOptions.allergens.map((option) => option.label),
			allergens,
		),
	);
	const restrictionOptions = $derived(
		getOptionRows(
			foodPreferenceOptions.dietaryRestrictions.map((option) => option.label),
			dietaryRestrictions,
		),
	);
	const unresolvedAllergens = $derived(
		(foodPreferences?.preferenceResolutions ?? [])
			.filter((resolution) =>
				resolution.ruleType === "allergen" && resolution.status === "unresolved"
			)
			.map((resolution) => resolution.rawValue),
	);
	const unresolvedDietaryRestrictions = $derived(
		(foodPreferences?.preferenceResolutions ?? [])
			.filter((resolution) =>
				resolution.ruleType === "dietary_restriction" && resolution.status === "unresolved"
			)
			.map((resolution) => resolution.rawValue),
	);
	const savedPriorityNutrientLabels = $derived(
		(foodPreferences?.prioritizedNutrientIds ?? [])
			.map((nutrientId) =>
				priorityNutrientOptions.find((nutrient) => nutrient.id === nutrientId)?.label
			)
			.filter((label): label is string => Boolean(label)),
	);
	const savedSummaryItems = $derived([
		foodPreferences?.regulatoryRegionCode
			? {
					label: "Label region",
					value:
						regulatoryRegionOptions.find(
							(option) => option.regionCode === foodPreferences.regulatoryRegionCode,
						)?.displayName ?? `Unavailable (${foodPreferences.regulatoryRegionCode})`,
				}
			: null,
		foodPreferences?.unitSystem
			? {
					label: "Units",
					value: foodPreferences.unitSystem === "us" ? "US units" : "Metric",
				}
			: null,
		foodPreferences?.defaultMixServingGrams
			? {
					label: "Serving",
					value: `${getServingSizeDisplayValue(
						foodPreferences.defaultMixServingGrams,
						foodPreferences.unitSystem === "us" ? "oz" : "g",
					)}${foodPreferences.unitSystem === "us" ? "oz" : "g"}`,
				}
			: null,
		foodPreferences?.allergens.length
			? { label: "Allergens", value: foodPreferences.allergens.join(", ") }
			: null,
		foodPreferences?.dietaryRestrictions.length
			? {
					label: "Dietary restrictions",
					value: foodPreferences.dietaryRestrictions.join(", "),
				}
			: null,
		savedPriorityNutrientLabels.length
			? { label: "Priority nutrients", value: savedPriorityNutrientLabels.join(", ") }
			: null,
	].filter((item) => item !== null));

	const isDisabled = $derived(isSaving || foodPreferencesUnavailable);
	const enhanceFoodPreferences = createPendingSubmit(
		(pending) => (isSaving = pending),
		(result) => {
			if (result.type === "success") onSaveSuccess?.();
		},
	);
	const selectRegulatoryRegion = (value: string) => {
		regulatoryRegionCode = value;
		regulatoryRegionSource = value ? "account" : null;
	};
</script>

<div class="profile-food-preference-settings" data-tutorial-target="food-preferences">
	<p class="profile-food-preference-settings__description">
		Save optional settings for clearer warnings and more useful Mix suggestions.
	</p>
	<div class="food-preference-notice">
		<strong>Optional and private</strong>
		<span>These settings can include health-related information. They stay with your account and shape warnings and suggestions.</span>
	</div>

	{#if errorMessage}
		<StatusMessage tone="danger" message={errorMessage} />
	{:else if successMessage}
		<StatusMessage tone="success" message={successMessage} />
	{/if}
	{#if foodPreferencesUnavailable}
		<StatusMessage
			tone="warning"
			message="Food preferences are temporarily unavailable. Your other profile settings still work."
		/>
	{/if}

	<SavedFoodPreferenceSummary items={savedSummaryItems} />

	<form
		method="POST"
		action="/profile?/saveFoodPreferences"
		use:enhance={enhanceFoodPreferences}
		aria-busy={isSaving}
	>
		<ProfileFoodPreferenceBasics
			{regulatoryRegionCode}
			{regulatoryRegionSource}
			{regulatoryRegionOptions}
			{hasUnsupportedRegion}
			unitSystem={selectedUnitSystem}
			defaultServingSize={incomingValues.defaultMixServingSize}
			defaultServingUnit={incomingValues.defaultMixServingUnit}
			disabled={isDisabled}
			onRegulatoryRegionChange={selectRegulatoryRegion}
		/>

		<input type="hidden" name="allergens" value={allergens.join(", ")} />
		<input type="hidden" name="dietaryRestrictions" value={dietaryRestrictions.join(", ")} />

		<div class="food-preference-editors">
			{#each ["allergens", "dietaryRestrictions"] as group (group)}
				{@const groupKey = group as FoodPreferenceGroupKey}
				<FoodPreferencePicker
					id={`profile-${groupKey}`}
					title={groupPresentation[groupKey].title}
					helper={groupPresentation[groupKey].helper}
					searchLabel={groupPresentation[groupKey].searchLabel}
					selectLabel={groupPresentation[groupKey].selectLabel}
					selectedValues={readGroup(groupKey)}
					selectValue={preferenceSelect[groupKey]}
					searchValue={preferenceSearch[groupKey]}
					availableOptions={getAvailableOptions(groupKey)}
					filteredOptions={getFilteredOptions(groupKey)}
					disabled={isDisabled}
					emptyLabel={groupKey === "allergens" ? "No allergens saved." : "No restrictions saved."}
					unresolvedValues={groupKey === "allergens" ? unresolvedAllergens : unresolvedDietaryRestrictions}
					onAdd={(value) => addPreference(groupKey, value)}
					onRemove={(value) => removePreference(groupKey, value)}
					onSearchChange={(value) =>
						(preferenceSearch = { ...preferenceSearch, [groupKey]: value })}
					onSelectChange={(value) =>
						(preferenceSelect = { ...preferenceSelect, [groupKey]: value })}
				/>
			{/each}
		</div>

		<ProfileNutrientPrioritySettings
			options={priorityNutrientOptions}
			selectedNutrientIds={prioritizedNutrientIds}
			disabled={isDisabled}
			onSelectionChange={(values) => (prioritizedNutrientIds = values)}
		/>

		<CheckboxField
			id="profile-sensitive-preferences"
			name="sensitiveAcknowledged"
			checked={incomingValues.sensitiveAcknowledged}
			disabled={isDisabled}
		>
			I understand these optional preferences may affect warnings and suggestion ranking.
		</CheckboxField>

		<RoundedActionButton type="submit" busy={isSaving} disabled={foodPreferencesUnavailable}>
			Save food preferences
		</RoundedActionButton>
	</form>
</div>

<style lang="scss">
	@use "./ProfileFoodPreferenceSettings.scss";
</style>
