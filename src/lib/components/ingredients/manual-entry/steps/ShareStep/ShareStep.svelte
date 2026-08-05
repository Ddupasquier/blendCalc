<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import PhotoUploadInput from "$lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch/ToggleSwitch.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
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
		brandOwner,
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
		catalogSubmissionOnly,
		onShareChange,
		onApplyVerifiedBarcode,
		onDetachBarcodeForPrivateSave,
		onSubmitBarcodeCorrection,
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
		onCatalogSubmissionComplete,
		onSaveDestinationInput,
	}: ShareStepProps = $props();

	let saveDestinationSelect = $state<HTMLSelectElement | null>(null);

	$effect(() => {
		if (saveDestinationSelect) onSaveDestinationInput?.(saveDestinationSelect);
	});

	const formatUnit = (unitName: string) =>
		unitName.trim().toLowerCase() === "kcal" ? "kcal" : unitName.trim().toLowerCase();
	const catalogSubmissionComplete = $derived(
		catalogSubmissionOnly && Boolean(catalogMessage),
	);
	const saveDestinationOptions = [
		{ value: MIX_STORAGE_KEYS.fridge, label: "Fridge" },
		{ value: MIX_STORAGE_KEYS.shoppingList, label: "Shopping List" },
	];
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
		<StatusMessage message={barcodeMessage} />
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
			extraLabel="Submit a correction"
			onExtra={onSubmitBarcodeCorrection}
		/>
	{/if}

	{#if catalogSubmissionOnly}
		<StatusMessage
			message="Your correction will stay pending until a moderator compares it with the current product and package evidence."
		/>
	{:else if shareUnavailableMessage}
		<StatusMessage message={shareUnavailableMessage} />
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
					foodName={normalizedName || "Unnamed ingredient"}
					brandName={brandOwner}
					category={activeCategory}
					required
					requireFreshPhoto={catalogSubmissionOnly}
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
					foodName={normalizedName || "Unnamed ingredient"}
					brandName={brandOwner}
					category={activeCategory}
					description="No trusted DB/API product image was found for this barcode. You can add a front package photo now; it stays private until a moderator approves it."
				onFrontPhotoChange={onFrontPhotoChange}
				onPlacementChange={onImagePlacementChange}
			/>
		</section>
	{/if}

	{#if !catalogSubmissionOnly}
		<ManualEntryField forId="custom-ingredient-save-destination" label="Add after saving">
			<SelectField
				bind:element={saveDestinationSelect}
				id="custom-ingredient-save-destination"
				name="custom-ingredient-save-destination"
				value={saveDestination}
				options={saveDestinationOptions}
				onValueChange={(value) =>
					onSaveDestinationChange(value as SmoothieListKey)}
			/>
		</ManualEntryField>
	{/if}

	{#if error}
		<StatusMessage tone="danger" message={error} />
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
		<StatusMessage tone="success" message={savedMessage} />
	{/if}
	{#if catalogMessage}
		<StatusMessage tone="success" message={catalogMessage} />
	{/if}

	<ManualEntryActions
		{onBack}
		onNext={catalogSubmissionComplete
			? onCatalogSubmissionComplete
			: onSubmit}
		nextLabel={catalogSubmissionComplete
			? "Done"
			: catalogSubmissionOnly
				? "Submit Correction"
				: "Add Ingredient"}
		busy={saving}
		showBack={!catalogSubmissionComplete}
	/>
</ManualEntryStepLayout>

<style lang="scss">
	@use "./ShareStep.scss";
</style>
