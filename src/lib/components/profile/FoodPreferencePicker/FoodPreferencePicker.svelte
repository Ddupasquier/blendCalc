<script lang="ts">
	import X from "$lib/assets/icons/X/X.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import SettingsSelectionRow from "$lib/components/common/display/SettingsSelectionRow/SettingsSelectionRow.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import { FOOD_PREFERENCE_MAX_LENGTH } from "$lib/utils/profile/foodPreferences";
	import type { FoodPreferencePickerProps } from "./types";

	let {
		id,
		options,
		disabled = false,
		emptyLabel,
		onAdd,
		onClear,
		onRemove,
		clearLabel,
		customEntryLabel,
		selectedValues,
		title,
		labelledBy,
		unresolvedValues = [],
		referenceDataUnavailable = false,
	}: FoodPreferencePickerProps = $props();

	let customEntry = $state("");
	let reviewedChoiceSearch = $state("");
	const normalizeValue = (value: string) =>
		value.toLocaleLowerCase().trim().replace(/\s+/g, " ");
	const selectedValueKeys = $derived(
		new Set(selectedValues.map(normalizeValue)),
	);
	const unresolvedValueKeys = $derived(
		new Set(unresolvedValues.map(normalizeValue)),
	);
	const filteredOptions = $derived(
		options
			.filter((option) => {
				if (selectedValueKeys.has(option.normalizedValue)) return false;
				const search = normalizeValue(reviewedChoiceSearch);
				if (!search) return true;
				return [
					option.label,
					option.normalizedValue,
					...option.sourceValues,
				].some((value) => normalizeValue(value).includes(search));
			})
			.slice(0, 6),
	);
	const reviewedResultLabel = $derived(
		reviewedChoiceSearch.trim()
			? "Matching reviewed choices"
			: "Suggested reviewed choices",
	);

	const addCustomEntry = () => {
		const value = customEntry.trim().replace(/\s+/g, " ");
		if (!value) return;
		onAdd(value);
		customEntry = "";
	};

	const addReviewedOption = (label: string) => {
		onAdd(label);
		reviewedChoiceSearch = "";
	};
</script>

<section class="preference-editor-card" aria-labelledby={labelledBy}>
	{#if selectedValues.length}
		<div
			class="preference-selections"
			aria-label={`Selected ${title.toLocaleLowerCase()}`}
		>
			{#each selectedValues as value (normalizeValue(value))}
				{@const waitingForReview = unresolvedValueKeys.has(
					normalizeValue(value),
				)}
				<SettingsSelectionRow
					title={value}
					description={waitingForReview
						? "Saved, but not used for automatic checks yet."
						: "Used for automatic checks."}
				>
					{#snippet status()}
						<TextBadge
							label={waitingForReview ? "Waiting for review" : "Active"}
							tone={waitingForReview ? "warning" : "success"}
						/>
					{/snippet}
					{#snippet actions()}
						<CircleIconButton
							label={`Remove ${value}`}
							variant="ghost"
							size="tiny"
							disabled={disabled || referenceDataUnavailable}
							onclick={() => onRemove(value)}
						>
							<X size={14} />
						</CircleIconButton>
					{/snippet}
				</SettingsSelectionRow>
			{/each}
		</div>
	{:else}
		<p class="preference-empty">{emptyLabel}</p>
	{/if}

	{#if referenceDataUnavailable}
		<StatusMessage
			tone="warning"
			title="Reviewed choices are unavailable"
			message="Your saved choices are still here, but this list could not load. Try again before changing it."
		/>
	{:else if options.length}
		<div class="preference-reviewed-options">
			<TextField
				id={`${id}-reviewed-search`}
				label={`Find reviewed ${title.toLocaleLowerCase()}`}
				type="search"
				value={reviewedChoiceSearch}
				placeholder={`Search and add ${title.toLocaleLowerCase()}`}
				{disabled}
				oninput={(event) =>
					(reviewedChoiceSearch = (event.currentTarget as HTMLInputElement)
						.value)}
			/>
			{#if filteredOptions.length}
				<div class="preference-reviewed-results">
					<strong>{reviewedResultLabel}</strong>
					{#each filteredOptions as option (option.normalizedValue)}
						<RoundedActionButton
							type="button"
							variant="neutral"
							contentAlign="space-between"
							fullWidth
							{disabled}
							onclick={() => addReviewedOption(option.label)}
						>
							<span>{option.label}</span>
							<span aria-hidden="true">+</span>
						</RoundedActionButton>
					{/each}
				</div>
			{:else if reviewedChoiceSearch.trim()}
				<p class="preference-empty">No reviewed choices match that search.</p>
			{:else}
				<p class="preference-empty">
					Every reviewed choice shown here is already active.
				</p>
			{/if}
		</div>
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

	{#if selectedValues.length}
		<div class="preference-editor-card__actions">
			<RoundedActionButton
				type="button"
				variant="quiet"
				disabled={disabled || referenceDataUnavailable}
				onclick={onClear}
			>
				{clearLabel}
			</RoundedActionButton>
		</div>
	{/if}
</section>

<style lang="scss">
	@use "./FoodPreferencePicker.scss";
</style>
