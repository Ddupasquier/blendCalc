<script lang="ts">
	import { enhance } from "$app/forms";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import CheckboxField from "$lib/components/common/forms/CheckboxField/CheckboxField.svelte";
	import FoodPreferencePicker from "$lib/components/profile/FoodPreferencePicker/FoodPreferencePicker.svelte";
	import ProfileMeasurementDefaults from "$lib/components/profile/ProfileMeasurementDefaults/ProfileMeasurementDefaults.svelte";
	import ProfileNutrientPrioritySettings from "$lib/components/profile/ProfileNutrientPrioritySettings/ProfileNutrientPrioritySettings.svelte";
	import ProfileRegulatoryRegionSettings from "$lib/components/profile/ProfileRegulatoryRegionSettings/ProfileRegulatoryRegionSettings.svelte";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import { createProfileFoodPreferenceFormState } from "./profileFoodPreferenceFormState.svelte";
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

	const preferenceFormState = createProfileFoodPreferenceFormState({
		getFoodPreferences: () => foodPreferences,
		getFoodPreferenceOptions: () => foodPreferenceOptions,
		getRegulatoryRegionOptions: () => regulatoryRegionOptions,
		getSubmittedValues: () => submittedValues,
		getErrorMessage: () => errorMessage,
	});
	const groupPresentation: Record<
		FoodPreferenceGroupKey,
		FoodPreferenceGroupPresentation
	> = {
		allergens: {
			title: "Allergens",
			description:
				"Reviewed matches add warnings when food details conflict. New terms stay saved while their match is reviewed.",
			customEntryLabel: "Add a specific allergen",
		},
		dietaryRestrictions: {
			title: "Dietary restrictions",
			description:
				"Reviewed matches warn on possible conflicts without preventing an item from being added.",
			customEntryLabel: "Add a specific restriction",
		},
	};

	const isDisabled = $derived(
		preferenceFormState.form.isSaving || foodPreferencesUnavailable,
	);
	const enhanceFoodPreferences = createPendingSubmit(
		(pending) => (preferenceFormState.form.isSaving = pending),
		(result) => {
			if (result.type === "success") onSaveSuccess?.();
		},
	);
</script>

<div class="profile-food-preference-settings" data-tutorial-target="food-preferences">
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

	<form
		method="POST"
		action="/profile?/saveFoodPreferences"
		use:enhance={enhanceFoodPreferences}
		aria-busy={preferenceFormState.form.isSaving}
	>
		<div class="profile-food-preference-settings__sections">
			<CollapsibleSection
				title="Package-label region"
				titleId="profile-package-label-region-title"
				badge={preferenceFormState.selectedRegion?.regionCode ??
					(preferenceFormState.form.regulatoryRegionCode || undefined)}
				surface="accent"
				open={preferenceFormState.openSections.region}
				onOpenChange={(open) =>
					preferenceFormState.setSectionOpen("region", open)}
			>
				<p class="profile-food-preference-settings__description">
					Use the label rules for a region when they are known. Personal allergen and dietary warnings always remain in effect.
				</p>
				<ProfileRegulatoryRegionSettings
					regulatoryRegionCode={preferenceFormState.form.regulatoryRegionCode}
					regulatoryRegionSource={preferenceFormState.form.regulatoryRegionSource}
					{regulatoryRegionOptions}
					hasUnsupportedRegion={preferenceFormState.hasUnsupportedRegion}
					disabled={isDisabled}
					onRegulatoryRegionChange={preferenceFormState.selectRegulatoryRegion}
				/>
			</CollapsibleSection>

			<CollapsibleSection
				title="Measurements"
				titleId="profile-measurements-title"
				badge={preferenceFormState.measurementSummary}
				surface="accent"
				open={preferenceFormState.openSections.measurements}
				onOpenChange={(open) =>
					preferenceFormState.setSectionOpen("measurements", open)}
			>
				<p class="profile-food-preference-settings__description">
					Choose how amounts appear and the serving size Mix starts with.
				</p>
				<ProfileMeasurementDefaults
					unitSystem={preferenceFormState.form.unitSystem}
					defaultServingSize={preferenceFormState.form.defaultServingSize}
					defaultServingUnit={preferenceFormState.form.defaultServingUnit}
					disabled={isDisabled}
					onUnitSystemChange={(value) =>
						(preferenceFormState.form.unitSystem = value)}
					onDefaultServingSizeChange={(value) =>
						(preferenceFormState.form.defaultServingSize = value)}
					onDefaultServingUnitChange={(value) =>
						(preferenceFormState.form.defaultServingUnit = value)}
				/>
			</CollapsibleSection>

			{#each preferenceFormState.form.allergens as allergen (allergen)}
				<input type="hidden" name="allergens" value={allergen} />
			{/each}
			{#each preferenceFormState.form.dietaryRestrictions as restriction (restriction)}
				<input type="hidden" name="dietaryRestrictions" value={restriction} />
			{/each}

			{#each ["allergens", "dietaryRestrictions"] as group (group)}
				{@const groupKey = group as FoodPreferenceGroupKey}
				{@const selectedValues = preferenceFormState.readGroup(groupKey)}
				<CollapsibleSection
					title={groupPresentation[groupKey].title}
					titleId={`profile-${groupKey}-title`}
					badge={selectedValues.length ? `${selectedValues.length}` : undefined}
					surface="accent"
					open={preferenceFormState.openSections[groupKey]}
					onOpenChange={(open) =>
						preferenceFormState.setSectionOpen(groupKey, open)}
				>
					<p class="profile-food-preference-settings__description">
						{groupPresentation[groupKey].description}
					</p>
					<FoodPreferencePicker
						id={`profile-${groupKey}`}
						title={groupPresentation[groupKey].title}
						labelledBy={`profile-${groupKey}-title`}
						customEntryLabel={groupPresentation[groupKey].customEntryLabel}
						{selectedValues}
						options={groupKey === "allergens"
							? foodPreferenceOptions.allergens
							: foodPreferenceOptions.dietaryRestrictions}
						disabled={isDisabled}
						referenceDataUnavailable={foodPreferenceOptionsUnavailable}
						emptyLabel={groupKey === "allergens" ? "No allergens saved." : "No restrictions saved."}
						unresolvedValues={groupKey === "allergens"
							? preferenceFormState.unresolvedAllergens
							: preferenceFormState.unresolvedDietaryRestrictions}
						onAdd={(value) => preferenceFormState.addPreference(groupKey, value)}
						onRemove={(value) => preferenceFormState.removePreference(groupKey, value)}
					/>
				</CollapsibleSection>
			{/each}

			<CollapsibleSection
				title="Nutrient priorities"
				titleId="profile-nutrient-priorities-title"
				badge={preferenceFormState.form.prioritizedNutrientIds.length
					? `${preferenceFormState.form.prioritizedNutrientIds.length}`
					: undefined}
				surface="accent"
				open={preferenceFormState.openSections.priorityNutrients}
				onOpenChange={(open) =>
					preferenceFormState.setSectionOpen("priorityNutrients", open)}
			>
				<p class="profile-food-preference-settings__description">
					Choose the nutrients you want emphasized while building a Mix and reviewing food details.
				</p>
				<ProfileNutrientPrioritySettings
					options={priorityNutrientOptions}
					selectedNutrientIds={preferenceFormState.form.prioritizedNutrientIds}
					disabled={isDisabled}
					onSelectionChange={(values) =>
						(preferenceFormState.form.prioritizedNutrientIds = values)}
				/>
			</CollapsibleSection>

			<section
				class="profile-food-preference-settings__privacy"
				aria-labelledby="profile-food-preference-privacy-title"
			>
				<h2 id="profile-food-preference-privacy-title">Private account settings</h2>
				<p class="profile-food-preference-settings__description">
					These optional choices may include health-related information. The app uses them to personalize warnings and suggestions.
				</p>
				<CheckboxField
					id="profile-sensitive-preferences"
					name="sensitiveAcknowledged"
					checked={preferenceFormState.form.sensitiveAcknowledged}
					disabled={isDisabled}
					onchange={(event) =>
						(preferenceFormState.form.sensitiveAcknowledged =
							event.currentTarget.checked)}
				>
					I understand and want to save these preferences to my account.
				</CheckboxField>
			</section>
		</div>

		<div class="profile-food-preference-settings__actions">
			<RoundedActionButton
				type="submit"
				busy={preferenceFormState.form.isSaving}
				disabled={foodPreferencesUnavailable}
			>
				Save food preferences
			</RoundedActionButton>
		</div>
	</form>
</div>

<style lang="scss">
	@use "./ProfileFoodPreferenceSettings.scss";
</style>
