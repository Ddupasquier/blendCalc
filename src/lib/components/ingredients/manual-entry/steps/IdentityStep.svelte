<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import InputLoadingFrame from "$lib/components/common/forms/InputLoadingFrame/InputLoadingFrame.svelte";
	import BarcodeAutofillSuggestion from "$lib/components/ingredients/manual-entry/BarcodeAutofillSuggestion.svelte";
	import FoodCategoryPicker from "$lib/components/ingredients/manual-entry/FoodCategoryPicker/FoodCategoryPicker.svelte";
	import type { IdentityStepProps } from "$lib/components/ingredients/manual-entry/formTypes";

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

<div class="custom-ingredient__step">
	<label class="custom-ingredient__field">
		<span>UPC / Barcode <small>optional</small></span>
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
		<small class="custom-ingredient__field-info">
			We’ll check trusted sources and offer autofill if existing data is available.
		</small>
		{#if !checkingBarcodeReference && barcodeValidationMessage}
			<small class="custom-ingredient__field-status" role="status">
				{barcodeValidationMessage}
			</small>
		{:else if !checkingBarcodeReference && barcodeMessage}
			<small class="custom-ingredient__field-status" role="status">
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
	</label>

	<label class="custom-ingredient__field">
		<span>Food name <em>*</em></span>
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
	</label>

	<label class="custom-ingredient__field">
		<span>Brand <small>optional</small></span>
		<input
			id="custom-ingredient-brand"
			name="custom-ingredient-brand"
			type="text"
			placeholder="e.g. KIND"
			maxlength="120"
			value={brandOwner}
			oninput={(event) => onBrandChange(event.currentTarget.value)}
		/>
	</label>

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
</div>
