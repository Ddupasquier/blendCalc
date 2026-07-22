<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch.svelte";
	import CustomIngredientOutcome from "$lib/components/ingredients/manual-entry/CustomIngredientOutcome.svelte";
	import ManualEntryValidationList from "$lib/components/ingredients/manual-entry/ManualEntryValidationList.svelte";
	import ProductImageEvidenceInput from "$lib/components/ingredients/manual-entry/ProductImageEvidenceInput.svelte";
	import BarcodeAutofillSuggestion from "$lib/components/ingredients/manual-entry/BarcodeAutofillSuggestion.svelte";
	import type { ShareStepProps } from "$lib/components/ingredients/manual-entry/formTypes";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
	import { MIX_STORAGE_KEYS } from "../../../../../defaults/mixDefaults";

	let {
		normalizedName,
		activeCategory,
		summaryNutrients,
		optionalNutrientCount,
		validationItems,
		barcodeMessage,
		canShareWithCatalog,
		shareUnavailableMessage,
		shareHelpMessage,
		shareWithCatalog,
		barcodeShareMismatch,
		validatingBarcodeShare,
		requiresCatalogEvidence,
		showOptionalProductImageUpload,
		trustedProductImage,
		frontPhoto,
		imagePlacement,
		saveDestination,
		error,
		lastOutcome,
		outcomeAction,
		savedMessage,
		catalogMessage,
		saving,
		onShareChange,
		onApplyVerifiedBarcode,
		onDetachBarcodeForPrivateSave,
		onFrontPhotoChange,
		onImagePlacementChange,
		onNutritionPhotoChange,
		onBarcodePhotoChange,
		onSaveDestinationChange,
		onMoveToShopping,
		onMoveToFridge,
		onUndo,
		onBack,
		onSubmit,
		onSaveDestinationInput,
	}: ShareStepProps = $props();

	let saveDestinationSelect = $state<HTMLSelectElement | null>(null);

	$effect(() => {
		if (saveDestinationSelect) onSaveDestinationInput?.(saveDestinationSelect);
	});

	const formatUnit = (unitName: string) =>
		unitName.trim().toLowerCase() === "kcal" ? "kcal" : unitName.trim().toLowerCase();
</script>

<div class="custom-ingredient__step">
	<section class="custom-ingredient__summary" aria-label="Ingredient summary">
		<div>
			<strong>{normalizedName || "Unnamed ingredient"}</strong>
			<span>{activeCategory}</span>
		</div>
		<div class="custom-ingredient__macro-row">
			{#each summaryNutrients as nutrient}
				<span>
					<strong>{nutrient.value === null ? "—" : `${nutrient.value.toFixed(1)}${formatUnit(nutrient.unitName)}`}</strong>
					<small>{nutrient.label}</small>
				</span>
			{/each}
		</div>
		<p>{optionalNutrientCount} optional nutrients filled</p>
	</section>

	<ManualEntryValidationList items={validationItems} />

	{#if barcodeMessage}
		<p class="custom-ingredient__status" role="status">{barcodeMessage}</p>
	{/if}

	{#if barcodeShareMismatch}
		<BarcodeAutofillSuggestion
			name={barcodeShareMismatch.name}
			brandOwner={barcodeShareMismatch.brandOwner}
			sourceLabel={barcodeShareMismatch.sourceLabel}
			heading="Product name does not match this barcode"
			description={barcodeShareMismatch.message}
			applyLabel="Use verified information"
			keepLabel="Remove barcode & keep private"
			tone="error"
			onApply={onApplyVerifiedBarcode}
			onKeepManual={onDetachBarcodeForPrivateSave}
		/>
	{/if}

	{#if shareUnavailableMessage}
		<p class="custom-ingredient__status" role="status">{shareUnavailableMessage}</p>
	{:else}
		<label
			class="custom-ingredient__share-toggle"
			class:custom-ingredient__share-toggle--disabled={!canShareWithCatalog ||
				validatingBarcodeShare}
		>
			<span>
				<strong>Share with community</strong>
				<small>
					{#if validatingBarcodeShare}
						<LoadingSpinner
							size="small"
							label="Checking this barcode before sharing"
							showLabel
						/>
					{:else}
						{shareHelpMessage}
					{/if}
				</small>
			</span>
			<ToggleSwitch
				id="custom-ingredient-share-product"
				name="custom-ingredient-share-product"
				ariaLabel="Share with community"
				disabled={!canShareWithCatalog || validatingBarcodeShare}
				checked={shareWithCatalog}
				onChange={onShareChange}
			/>
		</label>
	{/if}

	{#if requiresCatalogEvidence}
		<section class="custom-ingredient__evidence" aria-labelledby="product-evidence-title">
			<div>
				<strong id="product-evidence-title">Photos for catalog review</strong>
				<p>
					These private photos let a moderator confirm the package, nutrition facts,
					and barcode before other users can find the product.
				</p>
			</div>
			<ProductImageEvidenceInput
				trustedImage={trustedProductImage}
				{frontPhoto}
				placement={imagePlacement}
				required
				onFrontPhotoChange={onFrontPhotoChange}
				onPlacementChange={onImagePlacementChange}
			/>
			<label class="custom-ingredient__field">
				<span>Nutrition facts label</span>
				<input
					id="custom-product-nutrition-photo"
					name="custom-product-nutrition-photo"
					type="file"
					accept="image/jpeg,image/png,image/webp"
					aria-required="true"
					onchange={(event) => onNutritionPhotoChange(event.currentTarget.files?.[0] ?? null)}
				/>
			</label>
			<label class="custom-ingredient__field">
				<span>Barcode</span>
				<input
					id="custom-product-barcode-photo"
					name="custom-product-barcode-photo"
					type="file"
					accept="image/jpeg,image/png,image/webp"
					aria-required="true"
					onchange={(event) => onBarcodePhotoChange(event.currentTarget.files?.[0] ?? null)}
				/>
			</label>
		</section>
	{:else if showOptionalProductImageUpload}
		<section class="custom-ingredient__evidence" aria-labelledby="product-image-title">
			<ProductImageEvidenceInput
				trustedImage={trustedProductImage}
				{frontPhoto}
				placement={imagePlacement}
				description="No trusted DB/API product image was found for this barcode. You can add a front package photo now; it stays private until a moderator approves it."
				onFrontPhotoChange={onFrontPhotoChange}
				onPlacementChange={onImagePlacementChange}
			/>
		</section>
	{/if}

	<label class="custom-ingredient__destination custom-ingredient__field">
		<span>Add after saving</span>
		<select
			bind:this={saveDestinationSelect}
			id="custom-ingredient-save-destination"
			name="custom-ingredient-save-destination"
			value={saveDestination}
			onchange={(event) =>
				onSaveDestinationChange(event.currentTarget.value as SmoothieListKey)}
		>
			<option value={MIX_STORAGE_KEYS.fridge}>Fridge</option>
			<option value={MIX_STORAGE_KEYS.shoppingList}>Shopping List</option>
		</select>
	</label>

	{#if error}
		<p class="custom-ingredient__error" role="alert">{error}</p>
	{/if}
	{#if lastOutcome}
		<CustomIngredientOutcome
			outcome={lastOutcome}
			action={outcomeAction}
			onMoveToShopping={onMoveToShopping}
			onMoveToFridge={onMoveToFridge}
			onUndo={onUndo}
		/>
	{:else if savedMessage}
		<p class="custom-ingredient__success" role="status">{savedMessage}</p>
	{/if}
	{#if catalogMessage}
		<p class="custom-ingredient__catalog-message" role="status">{catalogMessage}</p>
	{/if}

	<div class="custom-ingredient__actions">
		<RoundedActionButton variant="neutral" onclick={onBack}>
			Back
		</RoundedActionButton>
		<RoundedActionButton onclick={onSubmit} busy={saving}>
			Add Ingredient
		</RoundedActionButton>
	</div>
</div>
