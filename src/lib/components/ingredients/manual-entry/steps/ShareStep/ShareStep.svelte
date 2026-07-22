<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import PhotoUploadInput from "$lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.svelte";
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch/ToggleSwitch.svelte";
	import CustomIngredientOutcome from "$lib/components/ingredients/manual-entry/CustomIngredientOutcome/CustomIngredientOutcome.svelte";
	import ManualEntryValidationList from "$lib/components/ingredients/manual-entry/ManualEntryValidationList/ManualEntryValidationList.svelte";
	import ProductImageEvidenceInput from "$lib/components/ingredients/manual-entry/ProductImageEvidenceInput/ProductImageEvidenceInput.svelte";
	import BarcodeAutofillSuggestion from "$lib/components/ingredients/manual-entry/BarcodeAutofillSuggestion/BarcodeAutofillSuggestion.svelte";
	import ManualEntryActions from "$lib/components/ingredients/manual-entry/ManualEntryActions/ManualEntryActions.svelte";
	import ManualEntryField from "$lib/components/ingredients/manual-entry/ManualEntryField/ManualEntryField.svelte";
	import ManualEntryStepLayout from "$lib/components/ingredients/manual-entry/ManualEntryStepLayout/ManualEntryStepLayout.svelte";
	import ManualEntryToggleRow from "$lib/components/ingredients/manual-entry/ManualEntryToggleRow/ManualEntryToggleRow.svelte";
	import type { ShareStepProps } from "./types";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

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
		nutritionPhoto,
		barcodePhoto,
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

<ManualEntryStepLayout>
	<section class="share-step__summary" aria-label="Ingredient summary">
		<div>
			<strong>{normalizedName || "Unnamed ingredient"}</strong>
			<span>{activeCategory}</span>
		</div>
		<div class="share-step__macro-row">
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
		<p class="share-step__status" role="status">{barcodeMessage}</p>
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
		<p class="share-step__status" role="status">{shareUnavailableMessage}</p>
	{:else}
		<ManualEntryToggleRow
			title="Share with community"
			description={validatingBarcodeShare ? "Checking this barcode before sharing" : shareHelpMessage}
			disabled={!canShareWithCatalog || validatingBarcodeShare}
		>
			{#if validatingBarcodeShare}
				<LoadingSpinner size="small" label="Checking this barcode before sharing" />
			{:else}
			<ToggleSwitch
				id="custom-ingredient-share-product"
				name="custom-ingredient-share-product"
				ariaLabel="Share with community"
				disabled={!canShareWithCatalog || validatingBarcodeShare}
				checked={shareWithCatalog}
				onChange={onShareChange}
			/>
			{/if}
		</ManualEntryToggleRow>
	{/if}

	{#if requiresCatalogEvidence}
		<section class="share-step__evidence" aria-labelledby="product-evidence-title">
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
			<PhotoUploadInput
				id="custom-product-nutrition-photo"
				name="custom-product-nutrition-photo"
				prompt="Nutrition facts label"
				description="Show the entire nutrition label with every value readable."
				photoCount={1}
				files={nutritionPhoto ? [nutritionPhoto] : []}
				capture="environment"
				required
				onFilesChange={(files) => onNutritionPhotoChange(files[0] ?? null)}
			/>
			<PhotoUploadInput
				id="custom-product-barcode-photo"
				name="custom-product-barcode-photo"
				prompt="Barcode"
				description="Show the full barcode and its printed digits in clear focus."
				photoCount={1}
				files={barcodePhoto ? [barcodePhoto] : []}
				capture="environment"
				required
				onFilesChange={(files) => onBarcodePhotoChange(files[0] ?? null)}
			/>
		</section>
	{:else if showOptionalProductImageUpload}
		<section class="share-step__evidence" aria-labelledby="product-image-title">
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

	<ManualEntryField forId="custom-ingredient-save-destination" label="Add after saving">
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
	</ManualEntryField>

	{#if error}
		<p class="share-step__message share-step__message--error" role="alert">{error}</p>
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
		<p class="share-step__message share-step__message--success" role="status">{savedMessage}</p>
	{/if}
	{#if catalogMessage}
		<p class="share-step__message share-step__message--success" role="status">{catalogMessage}</p>
	{/if}

	<ManualEntryActions {onBack} onNext={onSubmit} nextLabel="Add Ingredient" busy={saving} />
</ManualEntryStepLayout>

<style lang="scss">
	@use "./ShareStep.scss";
</style>
