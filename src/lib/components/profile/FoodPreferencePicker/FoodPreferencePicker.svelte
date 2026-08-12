<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import PillRow from "$lib/components/common/display/PillRow/PillRow.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import CheckboxGroup from "$lib/components/common/forms/CheckboxGroup/CheckboxGroup.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import { FOOD_PREFERENCE_MAX_LENGTH } from "$lib/utils/profile/foodPreferences";
	import type { FoodPreferencePickerProps } from "./types";

	let {
		id,
		options,
		disabled = false,
		emptyLabel,
		helper,
		onAdd,
		onRemove,
		customEntryLabel,
		selectedValues,
		title,
		unresolvedValues = [],
		referenceDataUnavailable = false,
	}: FoodPreferencePickerProps = $props();

	let customEntry = $state("");
	const normalizeValue = (value: string) =>
		value.toLocaleLowerCase().trim().replace(/\s+/g, " ");
	const optionValueSet = $derived(
		new Set(options.map((option) => option.normalizedValue)),
	);
	const selectedOptionValues = $derived(
		selectedValues
			.map(normalizeValue)
			.filter((value) => optionValueSet.has(value)),
	);
	const customValues = $derived(
		selectedValues.filter(
			(value) => !optionValueSet.has(normalizeValue(value)),
		),
	);

	const updateReviewedSelections = (
		selectedNormalizedValues: (string | number)[],
	) => {
		const nextSelection = new Set(selectedNormalizedValues.map(String));
		const previousSelection = new Set(selectedOptionValues);
		const addedValue = [...nextSelection].find(
			(value) => !previousSelection.has(value),
		);
		if (addedValue) {
			const option = options.find(
				(candidate) => candidate.normalizedValue === addedValue,
			);
			if (option) onAdd(option.label);
			return;
		}

		const removedValue = [...previousSelection].find(
			(value) => !nextSelection.has(value),
		);
		if (!removedValue) return;
		const savedValue = selectedValues.find(
			(value) => normalizeValue(value) === removedValue,
		);
		if (savedValue) onRemove(savedValue);
	};

	const addCustomEntry = () => {
		const value = customEntry.trim().replace(/\s+/g, " ");
		if (!value) return;
		onAdd(value);
		customEntry = "";
	};
</script>

<section class="preference-editor-card">
	<div class="preference-editor-card__heading">
		<div>
			<h3>{title}</h3>
			<p>{helper}</p>
		</div>
	</div>

	{#if referenceDataUnavailable}
		<StatusMessage
			tone="warning"
			title="Reviewed choices are unavailable"
			message="Your saved choices are still here, but this list could not load. Try again before changing it."
		/>
	{:else if options.length}
		<fieldset class="preference-reviewed-options">
			<legend>Reviewed choices</legend>
			<CheckboxGroup
				id={`${id}-reviewed-option`}
				options={options.map((option) => ({
					id: option.normalizedValue,
					label: option.label,
				}))}
				selected={selectedOptionValues}
				{disabled}
				onChange={updateReviewedSelections}
			/>
		</fieldset>
	{:else}
		<StatusMessage
			tone="info"
			message="No reviewed choices are available yet. You can still add your own wording below."
		/>
	{/if}

	<div class="preference-custom-entry">
		<div class="preference-custom-entry__controls">
			<TextField
				id={`${id}-custom-option`}
				label={customEntryLabel}
				value={customEntry}
				placeholder="Type a specific preference"
				maxlength={FOOD_PREFERENCE_MAX_LENGTH}
				disabled={disabled || referenceDataUnavailable}
				oninput={(event) =>
					(customEntry = (event.currentTarget as HTMLInputElement).value)}
				onkeydown={(event) => {
					if (event.key !== "Enter") return;
					event.preventDefault();
					addCustomEntry();
				}}
			/>
			<RoundedActionButton
				type="button"
				variant="neutral"
				disabled={disabled || referenceDataUnavailable || !customEntry.trim()}
				onclick={addCustomEntry}
			>
				Add
			</RoundedActionButton>
		</div>
	</div>

	{#if customValues.length}
		<div class="preference-custom-values">
			<strong>Your wording</strong>
			<PillRow
				pills={customValues}
				onRemove={(index) => onRemove(customValues[index])}
				disabledIndices={disabled || referenceDataUnavailable
					? customValues.map((_, index) => index)
					: []}
				preserveOrder
			/>
		</div>
	{:else if !selectedOptionValues.length}
		<p class="preference-empty">{emptyLabel}</p>
	{/if}

	{#if unresolvedValues.length}
		<StatusMessage
			tone="warning"
			title="Waiting for review"
			message={`${unresolvedValues.join(", ")} ${unresolvedValues.length === 1 ? "is" : "are"} saved, but warnings will not use ${unresolvedValues.length === 1 ? "it" : "them"} until there is an exact reviewed match.`}
		/>
	{/if}
</section>

<style lang="scss">
	@use "./FoodPreferencePicker.scss";
</style>
