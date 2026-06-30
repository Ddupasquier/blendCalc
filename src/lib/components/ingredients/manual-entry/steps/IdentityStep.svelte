<script lang="ts">
	import BarcodeAutofillSuggestion from "$lib/components/ingredients/manual-entry/BarcodeAutofillSuggestion.svelte";

	let {
		name,
		brandOwner,
		category,
		barcode,
		visibleCategoryOptions,
		loadingCategoryOptions,
		categoryOptionsError,
		barcodeMessage,
		checkingBarcodeReference,
		barcodeSuggestion = null,
		onNameChange,
		onBrandChange,
		onCategoryChange,
		onBarcodeChange,
		onBarcodeBlur,
		onApplyBarcodeSuggestion,
		onKeepManualBarcodeEntry,
		onNameInput,
		onNext,
	}: {
		name: string;
		brandOwner: string;
		category: string;
		barcode: string;
		visibleCategoryOptions: string[];
		loadingCategoryOptions: boolean;
		categoryOptionsError: string;
		barcodeMessage: string;
		checkingBarcodeReference: boolean;
		barcodeSuggestion: {
			name: string;
			brandOwner?: string;
			sourceLabel: string;
		} | null;
		onNameChange: (value: string) => void;
		onBrandChange: (value: string) => void;
		onCategoryChange: (value: string) => void;
		onBarcodeChange: (value: string) => void;
		onBarcodeBlur: () => void | Promise<void>;
		onApplyBarcodeSuggestion: () => void;
		onKeepManualBarcodeEntry: () => void;
		onNameInput?: (element: HTMLInputElement) => void;
		onNext: () => void | Promise<void>;
	} = $props();

	let nameInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (nameInput) onNameInput?.(nameInput);
	});
</script>

<div class="custom-ingredient__step">
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

	<label class="custom-ingredient__field">
		<span>Category <em>*</em></span>
		<select
			id="custom-ingredient-category"
			name="custom-ingredient-category"
			value={category}
			disabled={loadingCategoryOptions || visibleCategoryOptions.length === 0}
			aria-busy={loadingCategoryOptions}
			onchange={(event) => onCategoryChange(event.currentTarget.value)}
		>
			{#if loadingCategoryOptions}
				<option value="">Loading categories…</option>
			{:else if visibleCategoryOptions.length === 0}
				<option value="">Categories unavailable</option>
			{:else}
				{#each visibleCategoryOptions as option}
					<option value={option}>{option}</option>
				{/each}
			{/if}
		</select>
		{#if categoryOptionsError}
			<small>{categoryOptionsError}</small>
		{/if}
	</label>

	<label class="custom-ingredient__field">
		<span>UPC / Barcode <small>optional</small></span>
		<input
			id="custom-ingredient-barcode"
			name="custom-ingredient-barcode"
			type="text"
			inputmode="numeric"
			placeholder="12-digit number"
			maxlength="18"
			value={barcode}
			oninput={(event) => onBarcodeChange(event.currentTarget.value)}
			onblur={onBarcodeBlur}
		/>
		{#if checkingBarcodeReference}
			<small class="custom-ingredient__field-status" role="status">
				Checking barcode sources…
			</small>
		{:else if barcodeMessage}
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

	<button
		type="button"
		class="custom-ingredient__primary"
		disabled={checkingBarcodeReference}
		aria-busy={checkingBarcodeReference}
		onclick={onNext}
	>
		{checkingBarcodeReference ? "Checking…" : "Continue"}
	</button>
</div>
