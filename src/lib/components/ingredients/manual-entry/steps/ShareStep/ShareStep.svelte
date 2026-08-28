<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import PhotoUploadInput from "$lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch/ToggleSwitch.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ManualEntryValidationList from "$lib/components/ingredients/manual-entry/ManualEntryValidationList/ManualEntryValidationList.svelte";
	import ProductImageEvidenceInput from "$lib/components/ingredients/manual-entry/ProductImageEvidenceInput/ProductImageEvidenceInput.svelte";
	import BarcodeAutofillSuggestion from "$lib/components/ingredients/manual-entry/BarcodeAutofillSuggestion/BarcodeAutofillSuggestion.svelte";
	import ManualEntryActions from "$lib/components/ingredients/manual-entry/ManualEntryActions/ManualEntryActions.svelte";
	import ManualEntryField from "$lib/components/ingredients/manual-entry/ManualEntryField/ManualEntryField.svelte";
	import ManualEntryStepLayout from "$lib/components/ingredients/manual-entry/ManualEntryStepLayout/ManualEntryStepLayout.svelte";
	import ManualEntryToggleRow from "$lib/components/ingredients/manual-entry/ManualEntryToggleRow/ManualEntryToggleRow.svelte";
	import ProductSafetyAlerts from "$lib/components/ingredients/nutrition/ProductSafetyAlerts/ProductSafetyAlerts.svelte";
	import type { ShareStepProps } from "./types";
	import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

	let {
		normalizedName,
		brandOwner,
		activeCategory,
		summaryNutrients,
		optionalNutrientCount,
		validationItems,
		barcodeMessage,
		barcodeSafetyAlerts,
		canShareWithCatalog,
		shareUnavailableMessage,
		shareHelpMessage,
		shareWithCatalog,
		barcodeShareMismatch,
		lookingUpBarcode,
		validatingBarcodeShare,
		requiresCatalogEvidence,
		showOptionalProductImageUpload,
		trustedProductImage,
		frontPhoto,
		nutritionPhoto,
		barcodePhoto,
		imagePlacement,
		regulatoryDisclosureProfile,
		alcoholByVolumePercent,
		packageQuantityLabel,
		usesNonstandardNutritionDisclosure,
		saveDestination,
		error,
		placementMessage,
		catalogMessage,
		catalogMessageTone,
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
		onBack,
		onSubmit,
		onCatalogSubmissionComplete,
		onSaveDestinationControl,
	}: ShareStepProps = $props();

	let saveDestinationControl = $state<HTMLButtonElement | null>(null);
	let automaticImagePlacementBusy = $state(false);

	$effect(() => {
		if (saveDestinationControl)
			onSaveDestinationControl?.(saveDestinationControl);
	});

	const formatUnit = (unitName: string) =>
		unitName.trim().toLowerCase() === "kcal"
			? "kcal"
			: unitName.trim().toLowerCase();
	const catalogSubmissionComplete = $derived(
		catalogSubmissionOnly && Boolean(catalogMessage),
	);
	const saveDestinationOptions = [
		{ value: MIX_STORAGE_KEYS.fridge, label: "Fridge" },
		{ value: MIX_STORAGE_KEYS.shoppingList, label: "Shopping List" },
	];
	const labelEvidencePrompt = $derived(
		usesNonstandardNutritionDisclosure
			? "Available label details"
			: "Nutrition facts label",
	);
	const labelEvidenceDescription = $derived(
		usesNonstandardNutritionDisclosure
			? "Show every nutrition, ingredient, allergen, alcohol, and package detail the label provides."
			: "Show the entire nutrition label with every value readable.",
	);
	const nutritionSummaryCopy = $derived(
		usesNonstandardNutritionDisclosure
			? optionalNutrientCount > 0
				? `${optionalNutrientCount} reported nutrition ${optionalNutrientCount === 1 ? "value" : "values"}`
				: "No nutrition values were reported; missing values remain unknown"
			: `${optionalNutrientCount} optional nutrients filled`,
	);
</script>

<ManualEntryStepLayout>
	{#if lookingUpBarcode}
		<section
			class="share-step__lookup-status"
			aria-labelledby="barcode-product-lookup-title"
			aria-live="polite"
			role="status"
		>
			<LoadingSpinner size="large" label="Finding product details" decorative />
			<div>
				<strong id="barcode-product-lookup-title"
					>Finding product details</strong
				>
				<p>
					Checking blendCalc and available product sources. New products can
					take a moment.
				</p>
			</div>
		</section>
	{:else}
		<section class="share-step__summary" aria-label="Ingredient summary">
			<div>
				<strong>{normalizedName || "Unnamed ingredient"}</strong>
				<span>{activeCategory}</span>
			</div>
			{#if summaryNutrients.length > 0}
				<div class="share-step__macro-row">
					{#each summaryNutrients as nutrient (nutrient.label)}
						<span>
							<strong
								>{nutrient.value === null
									? "—"
									: `${nutrient.value.toFixed(1)}${formatUnit(nutrient.unitName)}`}</strong
							>
							<small>{nutrient.label}</small>
						</span>
					{/each}
				</div>
			{/if}
			<p>{nutritionSummaryCopy}</p>
			{#if regulatoryDisclosureProfile || packageQuantityLabel}
				<p>
					{[
						regulatoryDisclosureProfile?.displayName,
						alcoholByVolumePercent !== null
							? `${alcoholByVolumePercent}% ABV`
							: "",
						packageQuantityLabel,
					]
						.filter(Boolean)
						.join(" · ")}
				</p>
			{/if}
		</section>

		<ManualEntryValidationList items={validationItems} />

		{#if barcodeMessage}
			<StatusMessage message={barcodeMessage} />
		{/if}

		<ProductSafetyAlerts alerts={barcodeSafetyAlerts} />

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
	{/if}

	{#if lookingUpBarcode}
		<ManualEntryToggleRow
			title="Share with community"
			description="Available when the product check finishes."
			disabled
		>
			<ToggleSwitch
				id="custom-ingredient-share-product"
				name="custom-ingredient-share-product"
				ariaLabel="Share with community"
				disabled
				checked={false}
				onChange={onShareChange}
			/>
		</ManualEntryToggleRow>
	{:else if catalogSubmissionOnly}
		<StatusMessage
			message="Your correction will stay pending until a moderator compares it with the current product and package evidence."
		/>
	{:else if shareUnavailableMessage}
		<StatusMessage message={shareUnavailableMessage} />
	{:else}
		<ManualEntryToggleRow
			title="Share with community"
			description={validatingBarcodeShare
				? "Checking this barcode before sharing"
				: shareHelpMessage}
			disabled={!canShareWithCatalog || validatingBarcodeShare}
		>
			{#if validatingBarcodeShare}
				<LoadingSpinner
					size="small"
					label="Checking this barcode before sharing"
				/>
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
		<section
			class="share-step__evidence"
			aria-labelledby="product-evidence-title"
		>
			<div>
				<strong id="product-evidence-title">Photos for catalog review</strong>
				<p>
					These private photos let a moderator confirm the package, available
					label details, and barcode before other users can find the product.
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
				{onFrontPhotoChange}
				onPlacementChange={onImagePlacementChange}
				onPlacementProcessingStateChange={(busy) =>
					(automaticImagePlacementBusy = busy)}
			/>
			<PhotoUploadInput
				id="custom-product-nutrition-photo"
				name="custom-product-nutrition-photo"
				prompt={labelEvidencePrompt}
				description={labelEvidenceDescription}
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
				{onFrontPhotoChange}
				onPlacementChange={onImagePlacementChange}
				onPlacementProcessingStateChange={(busy) =>
					(automaticImagePlacementBusy = busy)}
			/>
		</section>
	{/if}

	{#if !catalogSubmissionOnly}
		<ManualEntryField
			forId="custom-ingredient-save-destination"
			label="Add after saving"
		>
			<SelectField
				bind:element={saveDestinationControl}
				id="custom-ingredient-save-destination"
				name="custom-ingredient-save-destination"
				value={saveDestination}
				options={saveDestinationOptions}
				onValueChange={(value) =>
					onSaveDestinationChange(value as IngredientListKey)}
			/>
		</ManualEntryField>
	{/if}

	{#if error}
		<StatusMessage tone="danger" message={error} />
	{/if}
	{#if placementMessage}
		<StatusMessage tone="info" message={placementMessage} />
	{/if}
	{#if catalogMessage}
		<StatusMessage tone={catalogMessageTone} message={catalogMessage} />
	{/if}

	<ManualEntryActions
		{onBack}
		onNext={catalogSubmissionComplete ? onCatalogSubmissionComplete : onSubmit}
		nextLabel={catalogSubmissionComplete
			? "Done"
			: catalogSubmissionOnly
				? "Submit Correction"
				: "Add Ingredient"}
		busy={saving}
		nextDisabled={automaticImagePlacementBusy}
		showBack={!catalogSubmissionComplete}
	/>
</ManualEntryStepLayout>

<style lang="scss">
	@use "./ShareStep.scss";
</style>
