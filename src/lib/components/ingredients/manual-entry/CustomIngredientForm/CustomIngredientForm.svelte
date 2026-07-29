<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import {
		SERVING_MEASURE_OPTIONS,
		type ServingMeasureUnit,
	} from "$lib/utils/serving/servingMeasureCatalog";
	import { getMotionSafeScrollBehavior } from "$lib/utils/accessibility/motion";
	import { setAnimatedDetailsOpen } from "$lib/utils/accessibility/animatedDetails";
	import type { BarcodeScanResult } from "$lib/utils/barcode/types";
	import type { FoodCategoryPickerOption } from "$lib/utils/food/categories/categoryPicker";
	import BarcodeScannerDialog from "$lib/components/ingredients/barcode/BarcodeScannerDialog/BarcodeScannerDialog.svelte";
	import ConfirmationDialog from "$lib/components/common/dialogs/ConfirmationDialog/ConfirmationDialog.svelte";
	import ManualEntryFormShell from "$lib/components/ingredients/manual-entry/ManualEntryFormShell/ManualEntryFormShell.svelte";
	import ManualEntryScanOption from "$lib/components/ingredients/manual-entry/ManualEntryScanOption/ManualEntryScanOption.svelte";
	import ManualEntryStepContent from "$lib/components/ingredients/manual-entry/ManualEntryStepContent/ManualEntryStepContent.svelte";
	import { manualEntrySteps } from "$lib/components/ingredients/manual-entry/formTypes";
	import type { IdentityStepProps } from "$lib/components/ingredients/manual-entry/steps/IdentityStep/types";
	import type { NutrientStepProps } from "$lib/components/ingredients/manual-entry/steps/NutrientStep/types";
	import type { ServingsStepProps } from "$lib/components/ingredients/manual-entry/steps/ServingsStep/types";
	import type { ShareStepProps } from "$lib/components/ingredients/manual-entry/steps/ShareStep/types";
	import { getDestinationLabel } from "$lib/components/ingredients/manual-entry/utils/listOutcome";
	import type { CustomIngredientFormProps } from "./types";
	import { createManualEntryFormState } from "./manualEntryFormState.svelte";
	import { createManualEntryReferenceDataController } from "./manualEntryReferenceDataController.svelte";
	import { createManualEntryValidationController } from "./manualEntryValidationController.svelte";
	import { createManualEntryBarcodeController } from "./manualEntryBarcodeController.svelte";
	import { createManualEntryOutcomeController } from "./manualEntryOutcomeController.svelte";
	import { createManualEntrySubmissionController } from "./manualEntrySubmissionController.svelte";
	import {
		persistManualEntryDraft,
		readManualEntryDraft,
	} from "./manualEntryDraft";

	let {
		onCreate,
		onClose,
		closeManualSignal = 0,
		scanSignal = 0,
		showScanButton = true,
		inline = true,
		onScannerOpen,
		onScannerClose,
		onLookupStateChange = () => {},
	}: CustomIngredientFormProps = $props();

	const volumeOptions = SERVING_MEASURE_OPTIONS.filter(
		(option) => option.dimension === "volume",
	).map((option) => ({
		value: option.value,
		label: option.label,
	}));
	const form = createManualEntryFormState();
	const referenceData = createManualEntryReferenceDataController();

	let labelDetailsElement: HTMLDetailsElement | null = null;
	let manualBodyElement: HTMLFieldSetElement | null = null;
	let ingredientNameInput: HTMLInputElement | null = null;
	let saveDestinationSelect: HTMLSelectElement | null = null;
	let lastCloseManualSignal: number | null = null;
	let lastScanSignal: number | null = null;
	let draftRestored = $state(false);

	const collapseManualEntry = () => {
		if (labelDetailsElement) {
			setAnimatedDetailsOpen(labelDetailsElement, false);
		}
	};

	const setSubmissionError = (message: string) => {
		submission.setError(message);
	};

	const validation = createManualEntryValidationController({
		form,
		referenceData,
		onClose: () => onClose?.(),
	});
	const outcome = createManualEntryOutcomeController({
		onCreate: (food, context) => onCreate(food, context),
		onCollapse: collapseManualEntry,
		onError: setSubmissionError,
	});
	const barcode = createManualEntryBarcodeController({
		form,
		validation,
		onScannerOpen: () => onScannerOpen?.(),
		onScannerClose: () => onScannerClose?.(),
		onLookupStateChange: (lookingUp) => onLookupStateChange(lookingUp),
		onError: setSubmissionError,
	});

	const resetForm = () => {
		validation.clearStepWarning();
		barcode.reset();
		form.reset();
	};

	const submission = createManualEntrySubmissionController({
		form,
		referenceData,
		validation,
		barcode,
		outcome,
		onReset: resetForm,
	});

	const goToStep = async (step: string) => {
		await validation.goToStep(
			step,
			barcode.checkManualBarcodeReference,
		);
	};
	const goNext = async () => {
		await validation.goNext(barcode.checkManualBarcodeReference);
	};

	const scrollToManualReview = async (
		focusTarget: "name" | "destination" = "destination",
	) => {
		await new Promise((resolve) => requestAnimationFrame(resolve));
		const target =
			focusTarget === "name" ? ingredientNameInput : saveDestinationSelect;
		(target ?? manualBodyElement)?.scrollIntoView({
			behavior: getMotionSafeScrollBehavior(),
			block: "center",
		});
		await new Promise((resolve) => requestAnimationFrame(resolve));
		target?.focus({ preventScroll: true });
	};

	const handleBarcodeDetected = async (result: BarcodeScanResult) => {
		if (labelDetailsElement) {
			setAnimatedDetailsOpen(labelDetailsElement, true);
		}
		const completion = await barcode.handleBarcodeDetected(result);
		await scrollToManualReview(completion.focusTarget);
	};

	const handleCategoryChange = (option: FoodCategoryPickerOption) => {
		form.data.category = option.label;
		form.data.categoryOptionId = option.id;
		form.data.categorySymbolKey = option.symbolKey;
		form.markFieldAsUserEntered("categories");
	};

	const handleServingWeightChange = (value: number) => {
		form.data.servingWeightGrams = Number.isFinite(value) ? value : null;
		form.markFieldAsUserEntered("serving");
	};

	const handleUseVolumeChange = (value: boolean) => {
		form.data.useVolumeEquivalent = value;
		form.markFieldAsUserEntered("serving");
	};

	const handleVolumeQuantityChange = (value: number | null) => {
		form.data.volumeQuantity = value;
		form.markFieldAsUserEntered("serving");
	};

	const handleVolumeUnitChange = (value: ServingMeasureUnit) => {
		form.data.volumeUnit = value;
		form.markFieldAsUserEntered("serving");
	};

	const identityStep = $derived<IdentityStepProps>({
		name: form.data.name,
		brandOwner: form.data.brandOwner,
		category: form.data.category,
		categoryOptionId: form.data.categoryOptionId,
		barcode: form.data.barcode,
		categoryWarningMessage: validation.categoryWarningMessage,
		categorySourceValues:
			form.data.barcodeReferenceSourceDraft?.categories ??
			form.data.categories,
		barcodeMessage: form.data.barcodeMessage,
		barcodeValidationMessage: barcode.barcodeValidationMessage,
		checkingBarcodeReference: form.data.checkingBarcodeReference,
		barcodeSuggestion: barcode.barcodeSuggestion,
		onNameChange: barcode.setManualName,
		onBrandChange: (value) => (form.data.brandOwner = value),
		onCategoryChange: handleCategoryChange,
		onCategoryStatusChange: validation.handleCategoryPickerStatus,
		onBarcodeChange: barcode.setManualBarcode,
		onBarcodeBlur: barcode.checkManualBarcodeReference,
		onApplyBarcodeSuggestion: barcode.applyBarcodeReferenceSuggestion,
		onKeepManualBarcodeEntry: barcode.keepManualBarcodeEntry,
		onNameInput: (element) => (ingredientNameInput = element),
		onNext: goNext,
	});

	const servingsStep = $derived<ServingsStepProps>({
		servingWeightGrams: form.data.servingWeightGrams,
		useVolumeEquivalent: form.data.useVolumeEquivalent,
		volumeQuantity: form.data.volumeQuantity,
		volumeUnit: form.data.volumeUnit,
		volumeOptions,
		onServingWeightChange: handleServingWeightChange,
		onUseVolumeChange: handleUseVolumeChange,
		onVolumeQuantityChange: handleVolumeQuantityChange,
		onVolumeUnitChange: handleVolumeUnitChange,
		onBack: validation.goBack,
		onNext: goNext,
	});

	const macrosStep = $derived<NutrientStepProps>({
		groups: referenceData.state.nutrientGroups.macros,
		loading: referenceData.state.loadingNutrients,
		error: referenceData.state.nutrientError,
		helper:
			"Enter values from the nutrition label for the serving above. The app stores normalized per-100g values. Fields marked * are required.",
		hideUnavailableStatus: validation.hideMacroUnavailableStatus,
		validationItems: validation.getAttemptedValidationItems(
			validation.validationItems.filter((item) => item.step === "macros"),
		),
		labelOcrMappings: referenceData.state.nutritionLabelOcrMappings,
		labelOcrMappingError:
			referenceData.state.nutritionLabelOcrMappingError,
		nutritionPhoto: form.data.nutritionPhoto,
		onNutritionPhotoChange: (file) => (form.data.nutritionPhoto = file),
		onApplyNutritionLabelOcr: (payload) =>
			form.applyNutritionLabelOcr(payload, validation.nutrientFields),
		getValue: form.getNutrientValue,
		onValueChange: form.setNutrientValue,
		isRequired: (field) => field.requiredForManualEntry,
		onBack: validation.goBack,
		onNext: goNext,
	});

	const extendedStep = $derived<NutrientStepProps>({
		groups: referenceData.state.nutrientGroups.extended,
		loading: referenceData.state.loadingNutrients,
		error: referenceData.state.nutrientError,
		helper: "All fields on this step are optional. Fill what you know.",
		accordion: true,
		defaultOpenFirst: false,
		getValue: form.getNutrientValue,
		onValueChange: form.setNutrientValue,
		isRequired: (field) => field.requiredForManualEntry,
		onBack: validation.goBack,
		onNext: goNext,
	});

	const shareStep = $derived<ShareStepProps>({
		normalizedName: validation.normalizedName,
		brandOwner: form.data.brandOwner,
		activeCategory: form.data.category,
		summaryNutrients: form.getSummaryNutrients(
			validation.requiredNutrientFields,
		),
		optionalNutrientCount: form.getOptionalNutrientTotal(
			validation.nutrientFields,
			validation.requiredNutrientFields,
		),
		validationItems: validation.getAttemptedValidationItems(
			validation.validationItems,
		),
		barcodeMessage: form.data.barcodeMessage,
		canShareWithCatalog: barcode.canShareWithCatalog,
		shareUnavailableMessage: barcode.shareUnavailableMessage,
		shareHelpMessage: barcode.shareHelpMessage,
		shareWithCatalog: form.data.shareWithCatalog,
		barcodeShareMismatch: barcode.barcodeShareMismatch,
		validatingBarcodeShare: form.data.validatingBarcodeShare,
		requiresCatalogEvidence: barcode.requiresCatalogEvidence,
		showOptionalProductImageUpload:
			barcode.showOptionalProductImageUpload,
		trustedProductImage: barcode.trustedProductImage,
		frontPhoto: form.data.frontPhoto,
		nutritionPhoto: form.data.nutritionPhoto,
		barcodePhoto: form.data.barcodePhoto,
		imagePlacement: form.data.imagePlacement,
		saveDestination: outcome.state.saveDestination,
		error: submission.state.error,
		lastOutcome: outcome.state.lastOutcome,
		outcomeAction: outcome.state.outcomeAction,
		savedMessage: outcome.state.savedMessage,
		catalogMessage: submission.state.catalogMessage,
		saving: submission.state.saving,
		onShareChange: barcode.handleShareChange,
		onApplyVerifiedBarcode: barcode.applyVerifiedBarcodeForSharing,
		onDetachBarcodeForPrivateSave:
			barcode.detachMismatchedBarcodeForPrivateSave,
		onFrontPhotoChange: (file) => (form.data.frontPhoto = file),
		onImagePlacementChange: (value) => (form.data.imagePlacement = value),
		onNutritionPhotoChange: (file) => (form.data.nutritionPhoto = file),
		onBarcodePhotoChange: (file) => (form.data.barcodePhoto = file),
		onSaveDestinationChange: (destination) =>
			(outcome.state.saveDestination = destination),
		onSaveDestinationInput: (element) => (saveDestinationSelect = element),
		onMoveToShopping: outcome.moveLastOutcomeToShopping,
		onMoveToFridge: outcome.moveLastOutcomeToFridge,
		onUndo: outcome.undoLastOutcomeAdd,
		onBack: validation.goBack,
		onSubmit: submission.handleSubmit,
	});

	onMount(() => {
		const draft = readManualEntryDraft();
		if (draft) {
			form.restore(draft.form);
			outcome.state.saveDestination = draft.saveDestination;
		}
		draftRestored = true;
		void referenceData.load();
	});

	onDestroy(() => {
		referenceData.destroy();
		validation.destroy();
		barcode.destroy();
		outcome.destroy();
	});

	$effect(() => {
		if (lastCloseManualSignal === null) {
			lastCloseManualSignal = closeManualSignal;
			return;
		}
		if (closeManualSignal === lastCloseManualSignal) return;
		lastCloseManualSignal = closeManualSignal;
		collapseManualEntry();
	});

	$effect(() => {
		if (lastScanSignal === null) {
			lastScanSignal = scanSignal;
			if (scanSignal > 0) barcode.state.scannerOpen = true;
			return;
		}
		if (scanSignal === lastScanSignal) return;
		lastScanSignal = scanSignal;
		barcode.state.scannerOpen = true;
	});

	$effect(() => {
		if (!draftRestored) return;
		persistManualEntryDraft(form.data, outcome.state.saveDestination);
	});
</script>

<section class="custom-ingredient" aria-label="Add custom ingredient">
	<div class="custom-ingredient__options">
		{#if showScanButton}
			<ManualEntryScanOption
				scanning={barcode.state.lookingUpBarcode}
				disabled={submission.state.saving ||
					form.data.checkingBarcodeReference}
				onScan={barcode.openBarcodeScanner}
			/>
		{/if}

		<ManualEntryFormShell
			{inline}
			activeStep={form.data.activeStep}
			steps={manualEntrySteps}
			saving={submission.state.saving}
			lookingUpBarcode={barcode.state.lookingUpBarcode}
			stepWarningMessage={validation.state.stepWarningMessage}
			stepWarningStep={validation.state.stepWarningStep}
			onSelectStep={goToStep}
			onDetailsElement={(element) => (labelDetailsElement = element)}
			onBodyElement={(element) => (manualBodyElement = element)}
		>
			<ManualEntryStepContent
				activeStep={form.data.activeStep}
				identity={identityStep}
				servings={servingsStep}
				macros={macrosStep}
				extended={extendedStep}
				share={shareStep}
			/>
		</ManualEntryFormShell>
	</div>
</section>

<style lang="scss">
	@use "./CustomIngredientForm.scss";
</style>

{#if barcode.state.scannerOpen}
	<BarcodeScannerDialog
		open={barcode.state.scannerOpen}
		onDetected={handleBarcodeDetected}
		onClose={barcode.closeBarcodeScanner}
	/>
{/if}

<ConfirmationDialog
	open={Boolean(outcome.state.listMovePrompt)}
	title="Move ingredient?"
	description={outcome.state.listMovePrompt
		? `${outcome.state.listMovePrompt.food.description} is already in ${getDestinationLabel(outcome.state.listMovePrompt.source)}. Move it to ${getDestinationLabel(outcome.state.listMovePrompt.destination)}?`
		: ""}
	confirmLabel="Move"
	onConfirm={() => outcome.resolveListMovePrompt(true)}
	onCancel={() => outcome.resolveListMovePrompt(false)}
/>
