<script lang="ts">
	import ToggleSwitch from "$lib/components/common/ToggleSwitch.svelte";

	let {
		name,
		brandOwner,
		category,
		barcode,
		visibleCategoryOptions,
		loadingCategoryOptions,
		categoryOptionsError,
		useVolumeEquivalent,
		onNameChange,
		onBrandChange,
		onCategoryChange,
		onBarcodeChange,
		onUseVolumeChange,
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
		useVolumeEquivalent: boolean;
		onNameChange: (value: string) => void;
		onBrandChange: (value: string) => void;
		onCategoryChange: (value: string) => void;
		onBarcodeChange: (value: string) => void;
		onUseVolumeChange: (value: boolean) => void;
		onNameInput?: (element: HTMLInputElement) => void;
		onNext: () => void;
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
		/>
	</label>

	<label class="custom-ingredient__switch">
		<span>
			<strong>Liquid ingredient</strong>
			<small>Affects volume unit conversion warnings</small>
		</span>
		<ToggleSwitch
			id="custom-ingredient-use-volume"
			name="custom-ingredient-use-volume"
			ariaLabel="Allow volume measurements"
			checked={useVolumeEquivalent}
			onChange={onUseVolumeChange}
		/>
	</label>

	<button type="button" class="custom-ingredient__primary" onclick={onNext}>
		Continue
	</button>
</div>
