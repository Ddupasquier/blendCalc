<script lang="ts">
	import PillRow from "$lib/components/common/display/PillRow/PillRow.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import type { FoodPreferencePickerProps } from "./types";

	let {
		id,
		availableOptions,
		disabled = false,
		emptyLabel,
		filteredOptions,
		helper,
		onAdd,
		onRemove,
		onSearchChange,
		onSelectChange,
		searchLabel,
		searchValue,
		selectedValues,
		selectLabel,
		selectValue,
		title,
		unresolvedValues = [],
	}: FoodPreferencePickerProps = $props();

	const addSearchValue = () => {
		onAdd(searchValue);
	};
</script>

<section class="preference-editor-card">
	<div class="preference-editor-card__heading">
		<div>
			<h3>{title}</h3>
			<p>{helper}</p>
		</div>
	</div>

	<div class="preference-add-flow">
		<p class="preference-add-flow__label">Add a saved option or type your own.</p>

		<div class="preference-picker">
			<div class="preference-picker__controls">
				<SelectField
					id={`${id}-saved-option`}
					label={selectLabel}
					value={selectValue}
					disabled={disabled}
					options={[
						{ value: "", label: "Select an option" },
						...availableOptions.map((option) => ({ value: option, label: option })),
					]}
					onValueChange={onSelectChange}
				/>
				<RoundedActionButton
					type="button"
					variant="neutral"
					disabled={disabled || !selectValue}
					onclick={() => onAdd(selectValue)}
				>
					Add
				</RoundedActionButton>
			</div>
		</div>

		<div class="preference-add-flow__divider" aria-hidden="true">
			<span>or</span>
		</div>

		<div class="preference-search">
			<div class="preference-search__controls">
				<TextField
					id={`${id}-custom-option`}
					label={searchLabel}
					type="search"
					value={searchValue}
					placeholder="Search catalog or add your own"
					disabled={disabled}
					oninput={(event) =>
						onSearchChange((event.currentTarget as HTMLInputElement).value)}
					onkeydown={(event) => {
						if (event.key !== "Enter") return;
						event.preventDefault();
						addSearchValue();
					}}
				/>
				<RoundedActionButton
					type="button"
					variant="neutral"
					disabled={disabled || !searchValue.trim()}
					onclick={addSearchValue}
				>
					Add
				</RoundedActionButton>
			</div>
		</div>
	</div>

	{#if filteredOptions.length}
		<PillRow
			pills={filteredOptions}
			onSelect={(index) => onAdd(filteredOptions[index])}
			removable={false}
		/>
	{/if}

	{#if selectedValues.length}
		<hr class="preference-divider" aria-hidden="true" />
		<PillRow
			pills={selectedValues}
			onRemove={(index) => onRemove(selectedValues[index])}
			preserveOrder
		/>
	{:else}
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
