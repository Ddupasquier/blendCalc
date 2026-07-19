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
		NutritionLabelOcrApplyPayload,
		FoodCategoryPickerStatus,
	} from "$lib/components/ingredients/manual-entry/formTypes";
	import type { FoodCategoryPickerOption } from "$lib/utils/food/categories/categoryPicker";
	import type { NutritionLabelOcrMapping } from "$lib/utils/food/ocr/nutritionLabelOcr";
	import type { ImagePlacementValue } from "$lib/utils/food/images/types";
	import IdentityStep from "$lib/components/ingredients/manual-entry/steps/IdentityStep.svelte";
	import NutrientStep from "$lib/components/ingredients/manual-entry/steps/NutrientStep.svelte";
	import ServingsStep from "$lib/components/ingredients/manual-entry/steps/ServingsStep.svelte";
	import ShareStep from "$lib/components/ingredients/manual-entry/steps/ShareStep.svelte";

	let {
		activeStep,
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
		nutritionLabelOcrMappings,
		nutritionLabelOcrMappingError,
		nutritionPhoto,
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
		imagePlacement,
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
		onApplyNutritionLabelOcr,
		isRequired,
		onNameChange,
		onBrandChange,
		onCategoryChange,
		onCategoryStatusChange,
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
		onImagePlacementChange,
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
		categoryOptionId: string;
		barcode: string;
		categoryWarningMessage: string;
		categorySourceValues: string[];
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
		nutritionLabelOcrMappings: NutritionLabelOcrMapping[];
		nutritionLabelOcrMappingError: string;
		nutritionPhoto: File | null;
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
		imagePlacement: ImagePlacementValue;
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
		onApplyNutritionLabelOcr: (payload: NutritionLabelOcrApplyPayload) => void;
		isRequired: (field: ManualEntryNutrientDefinition) => boolean;
		onNameChange: (value: string) => void;
		onBrandChange: (value: string) => void;
		onCategoryChange: (option: FoodCategoryPickerOption) => void;
		onCategoryStatusChange: (status: FoodCategoryPickerStatus) => void;
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
		onImagePlacementChange: (value: ImagePlacementValue) => void;
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
		{categoryOptionId}
		{barcode}
		{categoryWarningMessage}
		{categorySourceValues}
		{barcodeMessage}
		{barcodeValidationMessage}
		{checkingBarcodeReference}
		{barcodeSuggestion}
		onNameChange={onNameChange}
		onBrandChange={onBrandChange}
		onCategoryChange={onCategoryChange}
		onCategoryStatusChange={onCategoryStatusChange}
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
		labelOcrMappings={nutritionLabelOcrMappings}
		labelOcrMappingError={nutritionLabelOcrMappingError}
		{nutritionPhoto}
		onNutritionPhotoChange={onNutritionPhotoChange}
		{onApplyNutritionLabelOcr}
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
			{imagePlacement}
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
			onImagePlacementChange={onImagePlacementChange}
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
