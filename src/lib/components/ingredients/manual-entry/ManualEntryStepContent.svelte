<script lang="ts">
	import {
		type ServingMeasureUnit,
	} from "$lib/utils/serving/servingMeasureCatalog";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
	import type {
		ManualEntryNutrientDefinition,
		ManualEntryNutrientGroupsByStep,
	} from "$lib/utils/food/nutrients/nutrientDefinitions";
	import type {
		CustomIngredientOutcomeState,
		ManualEntryBarcodeShareMismatch,
		ManualEntryBarcodeSuggestion,
		ManualEntryStepId,
		ManualEntrySummaryItem,
		StepValidationItem,
	} from "$lib/components/ingredients/manual-entry/formTypes";
	import IdentityStep from "$lib/components/ingredients/manual-entry/steps/IdentityStep.svelte";
	import NutrientStep from "$lib/components/ingredients/manual-entry/steps/NutrientStep.svelte";
	import ServingsStep from "$lib/components/ingredients/manual-entry/steps/ServingsStep.svelte";
	import ShareStep from "$lib/components/ingredients/manual-entry/steps/ShareStep.svelte";

	let {
		activeStep,
		name,
		brandOwner,
		category,
		barcode,
		categoryPlaceholder,
		visibleCategoryOptions,
		loadingCategoryOptions,
		categoryOptionsError,
		categoryWarningMessage,
		barcodeMessage,
		barcodeValidationMessage,
		checkingBarcodeReference,
		barcodeSuggestion,
		servingLabel,
		resolvedServingLabel,
		servingWeightGrams,
		useVolumeEquivalent,
		volumeQuantity,
		volumeUnit,
		volumeOptions,
		manualEntryNutrientGroups,
		loadingManualEntryNutrients,
		manualEntryNutrientError,
		hideMacroUnavailableStatus,
		customIngredientValidationItems,
		normalizedName,
		activeCategory,
		summaryNutrients,
		optionalNutrientCount,
		canShareWithCatalog,
		shareUnavailableMessage,
		shareHelpMessage,
		shareWithCatalog,
		barcodeShareMismatch,
		validatingBarcodeShare,
		requiresCatalogEvidence,
		showOptionalProductImageUpload,
		trustedProductImageUrl,
		frontPhoto,
		imageCropX,
		imageCropY,
		imageCropZoom,
		saveDestination,
		error,
		lastOutcome,
		outcomeAction,
		savedMessage,
		catalogMessage,
		saving,
		getAttemptedValidationItems,
		getManualNutrientValue,
		onValueChange,
		isRequired,
		onNameChange,
		onBrandChange,
		onCategoryChange,
		onBarcodeChange,
		onBarcodeBlur,
		onApplyBarcodeSuggestion,
		onKeepManualBarcodeEntry,
		onNameInput,
		onServingLabelChange,
		onServingWeightChange,
		onUseVolumeChange,
		onVolumeQuantityChange,
		onVolumeUnitChange,
		onShareChange,
		onApplyVerifiedBarcode,
		onDetachBarcodeForPrivateSave,
		onFrontPhotoChange,
		onImageCropXChange,
		onImageCropYChange,
		onImageCropZoomChange,
		onNutritionPhotoChange,
		onBarcodePhotoChange,
		onSaveDestinationChange,
		onSaveDestinationInput,
		onMoveToShopping,
		onMoveToFridge,
		onUndo,
		onBack,
		onNext,
		onSubmit,
	}: {
		activeStep: ManualEntryStepId;
		name: string;
		brandOwner: string;
		category: string;
		barcode: string;
		categoryPlaceholder: string;
		visibleCategoryOptions: string[];
		loadingCategoryOptions: boolean;
		categoryOptionsError: string;
		categoryWarningMessage: string;
		barcodeMessage: string;
		barcodeValidationMessage: string;
		checkingBarcodeReference: boolean;
		barcodeSuggestion: ManualEntryBarcodeSuggestion;
		servingLabel: string;
		resolvedServingLabel: string;
		servingWeightGrams: number | null;
		useVolumeEquivalent: boolean;
		volumeQuantity: number | null;
		volumeUnit: ServingMeasureUnit;
		volumeOptions: Array<{ value: ServingMeasureUnit; label: string }>;
		manualEntryNutrientGroups: ManualEntryNutrientGroupsByStep;
		loadingManualEntryNutrients: boolean;
		manualEntryNutrientError: string;
		hideMacroUnavailableStatus: boolean;
		customIngredientValidationItems: StepValidationItem[];
		normalizedName: string;
		activeCategory: string;
		summaryNutrients: ManualEntrySummaryItem[];
		optionalNutrientCount: number;
		canShareWithCatalog: boolean;
		shareUnavailableMessage: string;
		shareHelpMessage: string;
		shareWithCatalog: boolean;
		barcodeShareMismatch: ManualEntryBarcodeShareMismatch;
		validatingBarcodeShare: boolean;
		requiresCatalogEvidence: boolean;
		showOptionalProductImageUpload: boolean;
		trustedProductImageUrl: string;
		frontPhoto: File | null;
		imageCropX: number;
		imageCropY: number;
		imageCropZoom: number;
		saveDestination: SmoothieListKey;
		error: string;
		lastOutcome: CustomIngredientOutcomeState | null;
		outcomeAction: "move" | "undo" | null;
		savedMessage: string;
		catalogMessage: string;
		saving: boolean;
		getAttemptedValidationItems: (
			items: StepValidationItem[],
		) => StepValidationItem[];
		getManualNutrientValue: (
			field: ManualEntryNutrientDefinition,
		) => number | null;
		onValueChange: (
			field: ManualEntryNutrientDefinition,
			value: string,
		) => void;
		isRequired: (field: ManualEntryNutrientDefinition) => boolean;
		onNameChange: (value: string) => void;
		onBrandChange: (value: string) => void;
		onCategoryChange: (value: string) => void;
		onBarcodeChange: (value: string) => void;
		onBarcodeBlur: () => void | Promise<void>;
		onApplyBarcodeSuggestion: () => void | Promise<void>;
		onKeepManualBarcodeEntry: () => void;
		onNameInput: (element: HTMLInputElement | null) => void;
		onServingLabelChange: (value: string) => void;
		onServingWeightChange: (value: number | null) => void;
		onUseVolumeChange: (value: boolean) => void;
		onVolumeQuantityChange: (value: number | null) => void;
		onVolumeUnitChange: (value: ServingMeasureUnit) => void;
		onShareChange: (checked: boolean) => void | Promise<void>;
		onApplyVerifiedBarcode: () => void | Promise<void>;
		onDetachBarcodeForPrivateSave: () => void;
		onFrontPhotoChange: (file: File | null) => void;
		onImageCropXChange: (value: number) => void;
		onImageCropYChange: (value: number) => void;
		onImageCropZoomChange: (value: number) => void;
		onNutritionPhotoChange: (file: File | null) => void;
		onBarcodePhotoChange: (file: File | null) => void;
		onSaveDestinationChange: (destination: SmoothieListKey) => void;
		onSaveDestinationInput: (element: HTMLSelectElement | null) => void;
		onMoveToShopping: () => void;
		onMoveToFridge: () => void;
		onUndo: () => void;
		onBack: () => void;
		onNext: () => void | Promise<void>;
		onSubmit: () => void | Promise<void>;
	} = $props();
</script>

{#if activeStep === "identity"}
	<IdentityStep
		{name}
		{brandOwner}
		{category}
		{barcode}
		{categoryPlaceholder}
		{visibleCategoryOptions}
		{loadingCategoryOptions}
		{categoryOptionsError}
		{categoryWarningMessage}
		{barcodeMessage}
		{barcodeValidationMessage}
		{checkingBarcodeReference}
		{barcodeSuggestion}
		onNameChange={onNameChange}
		onBrandChange={onBrandChange}
		onCategoryChange={onCategoryChange}
		onBarcodeChange={onBarcodeChange}
		onBarcodeBlur={onBarcodeBlur}
		onApplyBarcodeSuggestion={onApplyBarcodeSuggestion}
		onKeepManualBarcodeEntry={onKeepManualBarcodeEntry}
		onNameInput={onNameInput}
		onNext={onNext}
	/>
{:else if activeStep === "servings"}
	<ServingsStep
		{servingLabel}
		{resolvedServingLabel}
		{servingWeightGrams}
		{useVolumeEquivalent}
		{volumeQuantity}
		{volumeUnit}
		{volumeOptions}
		onServingLabelChange={onServingLabelChange}
		onServingWeightChange={onServingWeightChange}
		onUseVolumeChange={onUseVolumeChange}
		onVolumeQuantityChange={onVolumeQuantityChange}
		onVolumeUnitChange={onVolumeUnitChange}
		onBack={onBack}
		onNext={onNext}
	/>
{:else if activeStep === "macros"}
	<NutrientStep
		groups={manualEntryNutrientGroups.macros}
		loading={loadingManualEntryNutrients}
		error={manualEntryNutrientError}
		helper="Enter values from the nutrition label for the serving above. The app stores normalized per-100g values. Fields marked * are required."
		hideUnavailableStatus={hideMacroUnavailableStatus}
		validationItems={getAttemptedValidationItems(
			customIngredientValidationItems.filter((item) => item.step === "macros"),
		)}
		getValue={getManualNutrientValue}
		onValueChange={onValueChange}
		{isRequired}
		onBack={onBack}
		onNext={onNext}
	/>
{:else if activeStep === "extended"}
	<NutrientStep
		groups={manualEntryNutrientGroups.extended}
		loading={loadingManualEntryNutrients}
		error={manualEntryNutrientError}
		helper="All fields on this step are optional. Fill what you know."
		accordion
		defaultOpenFirst={false}
		getValue={getManualNutrientValue}
		onValueChange={onValueChange}
		{isRequired}
		onBack={onBack}
		onNext={onNext}
	/>
{:else}
	<ShareStep
		{normalizedName}
		{activeCategory}
		{summaryNutrients}
		{optionalNutrientCount}
		validationItems={getAttemptedValidationItems(customIngredientValidationItems)}
		{barcodeMessage}
		{canShareWithCatalog}
		{shareUnavailableMessage}
		{shareHelpMessage}
		{shareWithCatalog}
		{barcodeShareMismatch}
		{validatingBarcodeShare}
		{requiresCatalogEvidence}
		{showOptionalProductImageUpload}
		{trustedProductImageUrl}
		{frontPhoto}
		{imageCropX}
		{imageCropY}
		{imageCropZoom}
		{saveDestination}
		{error}
		{lastOutcome}
		{outcomeAction}
		{savedMessage}
		{catalogMessage}
		{saving}
		onShareChange={onShareChange}
		onApplyVerifiedBarcode={onApplyVerifiedBarcode}
		onDetachBarcodeForPrivateSave={onDetachBarcodeForPrivateSave}
		onFrontPhotoChange={onFrontPhotoChange}
		onImageCropXChange={onImageCropXChange}
		onImageCropYChange={onImageCropYChange}
		onImageCropZoomChange={onImageCropZoomChange}
		onNutritionPhotoChange={onNutritionPhotoChange}
		onBarcodePhotoChange={onBarcodePhotoChange}
		onSaveDestinationChange={onSaveDestinationChange}
		onSaveDestinationInput={onSaveDestinationInput}
		onMoveToShopping={onMoveToShopping}
		onMoveToFridge={onMoveToFridge}
		onUndo={onUndo}
		onBack={onBack}
		onSubmit={onSubmit}
	/>
{/if}
