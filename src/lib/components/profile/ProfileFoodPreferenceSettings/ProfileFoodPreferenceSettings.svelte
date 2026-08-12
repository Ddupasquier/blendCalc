<script lang="ts">
	import { browser } from "$app/environment";
	import { enhance } from "$app/forms";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import CheckboxField from "$lib/components/common/forms/CheckboxField/CheckboxField.svelte";
	import FoodPreferencePicker from "$lib/components/profile/FoodPreferencePicker/FoodPreferencePicker.svelte";
	import ProfileFoodPreferenceBasics from "$lib/components/profile/ProfileFoodPreferenceBasics/ProfileFoodPreferenceBasics.svelte";
	import ProfileNutrientPrioritySettings from "$lib/components/profile/ProfileNutrientPrioritySettings/ProfileNutrientPrioritySettings.svelte";
	import ProfileSettingsSection from "$lib/components/profile/ProfileSettingsSection/ProfileSettingsSection.svelte";
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
	import { getSavedFoodPreferenceSummaryItems } from "$lib/utils/profile/foodPreferenceSummary";
	import type {
		FoodPreferenceGroupKey,
		FoodPreferenceGroupPresentation,
		ProfileFoodPreferenceSettingsProps,
	} from "./types";

	let {
		foodPreferences,
		foodPreferencesUnavailable,
		foodPreferenceOptions,
		foodPreferenceOptionsUnavailable,
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
	const groupPresentation: Record<
		FoodPreferenceGroupKey,
		FoodPreferenceGroupPresentation
	> = {
		allergens: {
			title: "Allergens",
			helper:
				"Reviewed matches add warnings when food details conflict. New terms stay saved while their match is reviewed.",
			customEntryLabel: "Add a specific allergen",
		},
		dietaryRestrictions: {
			title: "Dietary restrictions",
			helper:
				"Reviewed matches warn on possible conflicts without preventing an item from being added.",
			customEntryLabel: "Add a specific restriction",
		},
	};

	const readGroup = (group: FoodPreferenceGroupKey) =>
		group === "allergens" ? allergens : dietaryRestrictions;
	const writeGroup = (group: FoodPreferenceGroupKey, values: string[]) => {
		const nextValues = uniquePreferenceValues(values);
		if (group === "allergens") allergens = nextValues;
		else dietaryRestrictions = nextValues;
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

	const selectedRegion = $derived(
		regulatoryRegionOptions.find((option) => option.regionCode === regulatoryRegionCode) ?? null,
	);
	const hasUnsupportedRegion = $derived(
		Boolean(regulatoryRegionCode && !selectedRegion),
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
	const savedSummaryItems = $derived(
		getSavedFoodPreferenceSummaryItems({
			foodPreferences,
			priorityNutrientOptions,
			regulatoryRegionOptions,
		}),
	);

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
	<StatusMessage tone="info" title="Optional and private">
		These settings can include health-related information. They stay with your account and shape warnings and suggestions.
	</StatusMessage>

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
		<ProfileSettingsSection
			title="Everyday defaults"
			description="Choose how measurements appear and set the serving amount Mix starts with."
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
		</ProfileSettingsSection>

		{#each allergens as allergen (allergen)}
			<input type="hidden" name="allergens" value={allergen} />
		{/each}
		{#each dietaryRestrictions as restriction (restriction)}
			<input type="hidden" name="dietaryRestrictions" value={restriction} />
		{/each}

		<ProfileSettingsSection
			title="Food warnings"
			description="Pick reviewed choices for immediate checks, or save exact wording for review."
		>
			<div class="food-preference-editors">
				{#each ["allergens", "dietaryRestrictions"] as group (group)}
					{@const groupKey = group as FoodPreferenceGroupKey}
					<FoodPreferencePicker
						id={`profile-${groupKey}`}
						title={groupPresentation[groupKey].title}
						helper={groupPresentation[groupKey].helper}
						customEntryLabel={groupPresentation[groupKey].customEntryLabel}
						selectedValues={readGroup(groupKey)}
						options={groupKey === "allergens"
							? foodPreferenceOptions.allergens
							: foodPreferenceOptions.dietaryRestrictions}
						disabled={isDisabled}
						referenceDataUnavailable={foodPreferenceOptionsUnavailable}
						emptyLabel={groupKey === "allergens" ? "No allergens saved." : "No restrictions saved."}
						unresolvedValues={groupKey === "allergens" ? unresolvedAllergens : unresolvedDietaryRestrictions}
						onAdd={(value) => addPreference(groupKey, value)}
						onRemove={(value) => removePreference(groupKey, value)}
					/>
				{/each}
			</div>
		</ProfileSettingsSection>

		<ProfileSettingsSection
			title="Mix guidance"
			description="Choose the nutrients you want emphasized while building a Mix."
		>
			<ProfileNutrientPrioritySettings
				options={priorityNutrientOptions}
				selectedNutrientIds={prioritizedNutrientIds}
				disabled={isDisabled}
				onSelectionChange={(values) => (prioritizedNutrientIds = values)}
			/>
		</ProfileSettingsSection>

		<CheckboxField
			id="profile-sensitive-preferences"
			name="sensitiveAcknowledged"
			checked={incomingValues.sensitiveAcknowledged}
			disabled={isDisabled}
		>
			I understand these optional preferences may affect warnings and suggestion ranking.
		</CheckboxField>

		<div class="profile-food-preference-settings__actions">
			<RoundedActionButton type="submit" busy={isSaving} disabled={foodPreferencesUnavailable}>
				Save food preferences
			</RoundedActionButton>
		</div>
	</form>
</div>

<style lang="scss">
	@use "./ProfileFoodPreferenceSettings.scss";
</style>
