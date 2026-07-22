<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import InputLoadingFrame from "$lib/components/common/forms/InputLoadingFrame/InputLoadingFrame.svelte";
	import BarcodeAutofillSuggestion from "$lib/components/ingredients/manual-entry/BarcodeAutofillSuggestion/BarcodeAutofillSuggestion.svelte";
	import FoodCategoryPicker from "$lib/components/ingredients/manual-entry/FoodCategoryPicker/FoodCategoryPicker.svelte";
	import ManualEntryField from "$lib/components/ingredients/manual-entry/ManualEntryField/ManualEntryField.svelte";
	import ManualEntryStepLayout from "$lib/components/ingredients/manual-entry/ManualEntryStepLayout/ManualEntryStepLayout.svelte";
	import type { IdentityStepProps } from "./types";

	let {
		name,
		brandOwner,
		category,
		categoryOptionId,
		barcode,
		categoryWarningMessage,
		categorySourceValues,
		barcodeMessage,
		barcodeValidationMessage,
		checkingBarcodeReference,
		barcodeSuggestion = null,
		onNameChange,
		onBrandChange,
		onCategoryChange,
		onCategoryStatusChange,
		onBarcodeChange,
		onBarcodeBlur,
		onApplyBarcodeSuggestion,
		onKeepManualBarcodeEntry,
		onNameInput,
		onNext,
	}: IdentityStepProps = $props();

	let nameInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (nameInput) onNameInput?.(nameInput);
	});
</script>

<ManualEntryStepLayout>
	<ManualEntryField forId="custom-ingredient-barcode" label="UPC / Barcode" optional>
		<InputLoadingFrame
			loading={checkingBarcodeReference}
			loadingLabel="Checking barcode sources"
		>
			<input
				id="custom-ingredient-barcode"
				name="custom-ingredient-barcode"
				type="text"
				inputmode="numeric"
				placeholder="Recommended for packaged foods"
				maxlength="18"
				value={barcode}
				oninput={(event) => onBarcodeChange(event.currentTarget.value)}
				onblur={onBarcodeBlur}
			/>
		</InputLoadingFrame>
		<small class="manual-entry-field__info">
			We’ll check trusted sources and offer autofill if existing data is available.
		</small>
		{#if !checkingBarcodeReference && barcodeValidationMessage}
			<small class="manual-entry-field__status" role="status">
				{barcodeValidationMessage}
			</small>
		{:else if !checkingBarcodeReference && barcodeMessage}
			<small class="manual-entry-field__status" role="status">
				{barcodeMessage}
			</small>
		{/if}
		{#if barcodeSuggestion}
			<BarcodeAutofillSuggestion
				name={barcodeSuggestion.name}
				brandOwner={barcodeSuggestion.brandOwner}
				sourceLabel={barcodeSuggestion.sourceLabel}
				onApply={onApplyBarcodeSuggestion}
				onKeepManual={onKeepManualBarcodeEntry}
			/>
		{/if}
	</ManualEntryField>

	<ManualEntryField forId="custom-ingredient-name" label="Food name" required>
		<input
			bind:this={nameInput}
			id="custom-ingredient-name"
			name="custom-ingredient-name"
			type="text"
			placeholder="e.g. Almond Flour Protein Bar"
			maxlength="120"
			aria-required="true"
			value={name}
			oninput={(event) => onNameChange(event.currentTarget.value)}
		/>
	</ManualEntryField>

	<ManualEntryField forId="custom-ingredient-brand" label="Brand" optional>
		<input
			id="custom-ingredient-brand"
			name="custom-ingredient-brand"
			type="text"
			placeholder="e.g. KIND"
			maxlength="120"
			value={brandOwner}
			oninput={(event) => onBrandChange(event.currentTarget.value)}
		/>
	</ManualEntryField>

	<FoodCategoryPicker
		selectedId={categoryOptionId}
		selectedLabel={category}
		productName={name}
		sourceCategories={categorySourceValues}
		warningMessage={categoryWarningMessage}
		onChange={onCategoryChange}
		onStatusChange={onCategoryStatusChange}
	/>

	<RoundedActionButton fullWidth busy={checkingBarcodeReference} onclick={onNext}>
		Continue
	</RoundedActionButton>
</ManualEntryStepLayout>
