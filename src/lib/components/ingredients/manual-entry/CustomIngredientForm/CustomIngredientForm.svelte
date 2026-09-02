<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import {
		SERVING_MEASURE_OPTIONS,
		type ServingMeasureUnit,
	} from "$lib/utils/serving/servingMeasureCatalog";
	import { getMotionSafeScrollBehavior } from "$lib/utils/animation/motion";
	import { setAnimatedDetailsOpen } from "$lib/utils/animation/animatedDetails";
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
	import { getManualEntryFormStateFromFood } from "$lib/components/ingredients/manual-entry/utils/formState";
	import {
		getManualEntryBarcodeIdentityKey,
		getManualEntryDestinationAction,
		resolveManualEntryListIdentity,
		type ManualEntryListIdentityState,
	} from "$lib/components/ingredients/manual-entry/utils/listMembership";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
	import type { CloudIngredientListIndex } from "$lib/utils/storage/supabase/lists";
	import {
		moveIngredientListItemById,
		type IngredientListKey,
	} from "$lib/utils/storage/client/ingredientLists";

	const emptyIngredientListIndex: CloudIngredientListIndex = {
		[MIX_STORAGE_KEYS.fridge]: { foodIds: [], foodIdentityKeys: [] },
		[MIX_STORAGE_KEYS.shoppingList]: {
			foodIds: [],
			foodIdentityKeys: [],
		},
	};

	let {
		onCreate,
		onClose,
		closeManualSignal = 0,
		scanSignal = 0,
		showScanButton = true,
		inline = true,
		onScannerOpen,
		onScannerClose,
		moveConfirmationRouteOpen = false,
		onMoveConfirmationOpen,
		onMoveConfirmationClose,
		onLookupStateChange = () => {},
		initialFood,
		submissionIntent = "catalog_share",
		catalogSubmissionOnly = false,
		ingredientListIndex = emptyIngredientListIndex,
	}: CustomIngredientFormProps = $props();

	const servingMeasureOptions = SERVING_MEASURE_OPTIONS.filter(
		(option) => option.dimension === "volume" || option.dimension === "count",
	).map((option) => ({
		value: option.value,
		label: option.label,
	}));
	const form = createManualEntryFormState();
	const referenceData = createManualEntryReferenceDataController();

	let labelDetailsElement: HTMLDetailsElement | null = null;
	let manualBodyElement: HTMLFieldSetElement | null = null;
	let ingredientNameInput: HTMLInputElement | null = null;
	let saveDestinationControl: HTMLButtonElement | null = null;
	let lastCloseManualSignal: number | null = null;
	let lastScanSignal: number | null = null;
	let lastMovePromptOpen: boolean | null = null;
	let draftRestored = $state(false);
	let listIdentityState = $state<ManualEntryListIdentityState>({
		status: "idle",
	});
	let listIdentityRequestId = 0;
	let preflightMovePrompt = $state<{
		source: IngredientListKey;
		destination: IngredientListKey;
		foodId: number;
	} | null>(null);
	let preflightMoveBusy = $state(false);

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
	const destinationAction = $derived(
		getManualEntryDestinationAction({
			identityState: listIdentityState,
			listIndex: ingredientListIndex,
			destination: outcome.state.saveDestination,
		}),
	);

	const refreshListIdentity = async (name: string, barcodeValue: string) => {
		const requestId = ++listIdentityRequestId;
		listIdentityState = { status: "checking" };
		try {
			const identityKey = await resolveManualEntryListIdentity({
				name,
				barcode: barcodeValue,
				initialFood,
			});
			if (requestId !== listIdentityRequestId) return;
			listIdentityState = { status: "ready", identityKey };
		} catch {
			if (requestId !== listIdentityRequestId) return;
			listIdentityState = { status: "error" };
		}
	};

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
		getCatalogSubmissionOnly: () => catalogSubmissionOnly,
		getDestinationAction: () => destinationAction,
	});

	const handleDestinationSubmit = async () => {
		if (destinationAction.kind !== "move") {
			await submission.handleSubmit();
			return;
		}
		const existingSource = destinationAction.source;
		const existingFoodId = destinationAction.foodId;
		if (
			!existingSource ||
			typeof existingFoodId !== "number" ||
			!Number.isSafeInteger(existingFoodId)
		) {
			setSubmissionError(
				"The existing ingredient could not be identified safely. Refresh before moving it.",
			);
			return;
		}
		preflightMovePrompt = {
			destination: outcome.state.saveDestination,
			source: existingSource,
			foodId: existingFoodId,
		};
	};

	const resolvePreflightMovePrompt = async (confirmed: boolean) => {
		if (!preflightMovePrompt || preflightMoveBusy) return;
		const prompt = preflightMovePrompt;
		if (!confirmed) {
			preflightMovePrompt = null;
			return;
		}

		preflightMoveBusy = true;
		submission.setError("");
		try {
			const result = await moveIngredientListItemById(
				prompt.source,
				prompt.destination,
				prompt.foodId,
			);
			if (result !== "moved") {
				setSubmissionError(
					"The existing ingredient could not be moved. Refresh and try again.",
				);
				return;
			}
			onClose?.();
		} finally {
			preflightMoveBusy = false;
			preflightMovePrompt = null;
		}
	};

	const goToStep = async (step: string) => {
		await validation.goToStep(step, barcode.checkManualBarcodeReference);
	};
	const goNext = async () => {
		await validation.goNext(barcode.checkManualBarcodeReference);
	};

	const scrollToManualReview = async (
		focusTarget: "name" | "destination" = "destination",
	) => {
		await new Promise((resolve) => requestAnimationFrame(resolve));
		const target =
			focusTarget === "name" ? ingredientNameInput : saveDestinationControl;
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

	const handleBrandChange = (value: string) => {
		form.data.brandOwner = value;
		form.markFieldAsUserEntered("brandOwner");
	};

	const handleServingWeightChange = (value: number) => {
		if (Number.isFinite(value) && value > 0) {
			form.data.servingWeightGrams = value;
			form.markFieldAsUserEntered("serving");
			return;
		}
		if (validation.disclosurePolicy.allowsMissingServingWeight) {
			form.data.servingWeightGrams = 100;
			form.data.servingLabel = "";
			form.data.serving = undefined;
			form.data.usesInternal100GramBasis = true;
			return;
		}
		form.data.servingWeightGrams = null;
		form.markFieldAsUserEntered("serving");
	};

	const handleUseServingMeasureChange = (value: boolean) => {
		if (value && form.data.usesInternal100GramBasis) {
			form.data.servingWeightGrams = null;
			form.data.servingLabel = "";
		}
		form.data.useServingMeasure = value;
		form.markFieldAsUserEntered("serving");
	};

	const handleServingMeasureQuantityChange = (value: number | null) => {
		form.data.servingMeasureQuantity = value;
		form.markFieldAsUserEntered("serving");
	};

	const handleServingMeasureUnitChange = (value: ServingMeasureUnit) => {
		form.data.servingMeasureUnit = value;
		form.markFieldAsUserEntered("serving");
	};

	const handleServingLabelChange = (value: string) => {
		form.data.servingLabel = value;
		form.markFieldAsUserEntered("serving");
	};

	const handleRegulatoryDisclosureChange = (profileKey: string) => {
		const selectedProfile =
			referenceData.state.regulatoryDisclosureProfiles.find(
				(profile) => profile.key === profileKey,
			);
		if (!selectedProfile) {
			form.data.regulatoryDisclosure = undefined;
			if (form.data.usesInternal100GramBasis) {
				form.data.servingWeightGrams = null;
				form.data.usesInternal100GramBasis = false;
			}
			if (form.data.fieldProvenance) {
				const fieldProvenance = { ...form.data.fieldProvenance };
				delete fieldProvenance.regulatoryDisclosure;
				form.data.fieldProvenance = fieldProvenance;
			}
			return;
		}

		form.data.regulatoryDisclosure = {
			profileKey,
			evidenceStatus: "user-reported",
		};
		form.markFieldAsUserEntered("regulatoryDisclosure");
		if (selectedProfile.nutritionEvaluationMode === "profile") {
			if (form.data.usesInternal100GramBasis) {
				form.data.servingWeightGrams = null;
				form.data.servingLabel = "";
				form.data.serving = undefined;
				form.data.usesInternal100GramBasis = false;
			}
			return;
		}
		if (
			form.data.usesInternal100GramBasis ||
			!Number.isFinite(form.data.servingWeightGrams) ||
			(form.data.servingWeightGrams ?? 0) <= 0
		) {
			form.data.servingWeightGrams = 100;
			form.data.servingLabel = "";
			form.data.serving = undefined;
			form.data.useServingMeasure = false;
			form.data.servingMeasureQuantity = null;
			form.data.usesInternal100GramBasis = true;
		}
	};

	const handleAlcoholByVolumeChange = (percent: number | null) => {
		if (percent === null || percent < 0 || percent > 100) {
			form.data.alcoholByVolume = undefined;
			return;
		}
		form.data.alcoholByVolume = {
			percent,
			valueStatus: percent === 0 ? "reported-zero" : "reported",
			basis: "volume-percent",
			sourceUnit: "% vol",
		};
		form.markFieldAsUserEntered("alcoholByVolume");
	};

	const identityStep = $derived<IdentityStepProps>({
		name: form.data.name,
		brandOwner: form.data.brandOwner,
		category: form.data.category,
		categoryOptionId: form.data.categoryOptionId,
		barcode: form.data.barcode,
		categoryWarningMessage: validation.categoryWarningMessage,
		categorySourceValues:
			form.data.barcodeReferenceSourceDraft?.categories ?? form.data.categories,
		barcodeMessage: form.data.barcodeMessage,
		barcodeSafetyAlerts: form.data.barcodeSafetyAlerts,
		barcodeValidationMessage: barcode.barcodeValidationMessage,
		checkingBarcodeReference: barcode.barcodeReferenceLookupPending,
		barcodeSuggestion: barcode.barcodeSuggestion,
		onNameChange: barcode.setManualName,
		onBrandChange: handleBrandChange,
		onCategoryChange: handleCategoryChange,
		onCategoryStatusChange: validation.handleCategoryPickerStatus,
		onBarcodeChange: barcode.setManualBarcode,
		onBarcodeBlur: barcode.checkManualBarcodeReference,
		onApplyBarcodeSuggestion: barcode.applyBarcodeReferenceSuggestion,
		onKeepManualBarcodeEntry: barcode.keepManualBarcodeEntry,
		onReportBarcodeIssue: barcode.beginBarcodeCorrection,
		onNameInput: (element) => (ingredientNameInput = element),
		onNext: goNext,
	});

	const servingsStep = $derived<ServingsStepProps>({
		servingWeightGrams: form.data.servingWeightGrams,
		usesInternal100GramBasis: form.data.usesInternal100GramBasis,
		requiresServingMeasurement: validation.requiresServingMeasurement,
		useServingMeasure: form.data.useServingMeasure,
		servingLabel: form.data.servingLabel,
		servingMeasureQuantity: form.data.servingMeasureQuantity,
		servingMeasureUnit: form.data.servingMeasureUnit,
		servingMeasureOptions,
		regulatoryDisclosureProfiles:
			referenceData.state.regulatoryDisclosureProfiles,
		regulatoryDisclosureProfileError:
			referenceData.state.regulatoryDisclosureProfileError,
		regulatoryDisclosureProfileKey:
			form.data.regulatoryDisclosure?.profileKey ?? "",
		alcoholByVolumePercent: form.data.alcoholByVolume?.percent ?? null,
		requiresAlcoholByVolume:
			validation.disclosurePolicy.requiresAlcoholByVolume,
		onServingWeightChange: handleServingWeightChange,
		onServingLabelChange: handleServingLabelChange,
		onUseServingMeasureChange: handleUseServingMeasureChange,
		onServingMeasureQuantityChange: handleServingMeasureQuantityChange,
		onServingMeasureUnitChange: handleServingMeasureUnitChange,
		onRegulatoryDisclosureChange: handleRegulatoryDisclosureChange,
		onAlcoholByVolumeChange: handleAlcoholByVolumeChange,
		onBack: validation.goBack,
		onNext: goNext,
	});

	const macrosStep = $derived<NutrientStepProps>({
		groups: referenceData.state.nutrientGroups.macros,
		loading: referenceData.state.loadingNutrients,
		error: referenceData.state.nutrientError,
		helper: validation.disclosurePolicy.requiresStandardNutrition
			? "Enter values from the nutrition label for the serving above. blendCalc keeps the package's exact weight, volume, or item basis. Fields marked * are required."
			: form.data.usesInternal100GramBasis
				? "This label may legally omit standard nutrition. Imported values stay on their reported per-100g basis. Add package values only after entering the package's exact gram serving; everything else stays unknown."
				: "This label may legally omit standard nutrition. Enter only values the package actually reports; everything else stays unknown.",
		hideUnavailableStatus: validation.hideMacroUnavailableStatus,
		validationItems: validation.getAttemptedValidationItems(
			validation.validationItems.filter((item) => item.step === "macros"),
		),
		labelOcrMappings: referenceData.state.nutritionLabelOcrMappings,
		labelOcrMappingError: referenceData.state.nutritionLabelOcrMappingError,
		nutritionPhoto: form.data.nutritionPhoto,
		onNutritionPhotoChange: (file) => {
			form.clearAutomaticCatalogSharing();
			form.data.nutritionPhoto = file;
		},
		onApplyNutritionLabelOcr: (payload) =>
			form.applyNutritionLabelOcr(payload, validation.nutrientFields),
		getValue: form.getNutrientValue,
		onValueChange: form.setNutrientValue,
		isRequired: (field) =>
			form.data.shareWithCatalog &&
			validation.disclosurePolicy.requiresStandardNutrition &&
			field.requiredForManualEntry,
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
		isRequired: (field) =>
			form.data.shareWithCatalog &&
			validation.disclosurePolicy.requiresStandardNutrition &&
			field.requiredForManualEntry,
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
		barcodeSafetyAlerts: form.data.barcodeSafetyAlerts,
		canShareWithCatalog: barcode.canShareWithCatalog,
		shareUnavailableMessage: barcode.shareUnavailableMessage,
		shareHelpMessage: barcode.shareHelpMessage,
		shareWithCatalog: form.data.shareWithCatalog,
		barcodeShareMismatch: barcode.barcodeShareMismatch,
		lookingUpBarcode: barcode.state.lookingUpBarcode,
		validatingBarcodeShare: form.data.validatingBarcodeShare,
		requiresCatalogEvidence: barcode.requiresCatalogEvidence,
		showOptionalProductImageUpload: barcode.showOptionalProductImageUpload,
		trustedProductImage: barcode.trustedProductImage,
		frontPhoto: form.data.frontPhoto,
		nutritionPhoto: form.data.nutritionPhoto,
		barcodePhoto: form.data.barcodePhoto,
		imagePlacement: form.data.imagePlacement,
		regulatoryDisclosureProfile: validation.disclosurePolicy.profile,
		alcoholByVolumePercent: form.data.alcoholByVolume?.percent ?? null,
		packageQuantityLabel: form.data.packageQuantity?.label ?? "",
		usesNonstandardNutritionDisclosure:
			!validation.disclosurePolicy.requiresStandardNutrition,
		saveDestination: outcome.state.saveDestination,
		destinationAction,
		error: submission.state.error,
		placementMessage: outcome.state.placementMessage,
		catalogMessage: submission.state.catalogMessage,
		catalogMessageTone: submission.state.catalogMessageTone,
		saving: submission.state.saving,
		catalogSubmissionOnly,
		onShareChange: barcode.handleShareChange,
		onApplyVerifiedBarcode: barcode.applyVerifiedBarcodeForSharing,
		onDetachBarcodeForPrivateSave:
			barcode.detachMismatchedBarcodeForPrivateSave,
		onSubmitBarcodeCorrection: barcode.beginBarcodeCorrectionForSharing,
		onFrontPhotoChange: (file) => {
			form.clearAutomaticCatalogSharing();
			form.data.frontPhoto = file;
		},
		onImagePlacementChange: (value) => {
			form.data.imagePlacement = value;
		},
		onNutritionPhotoChange: (file) => {
			form.clearAutomaticCatalogSharing();
			form.data.nutritionPhoto = file;
		},
		onBarcodePhotoChange: (file) => {
			form.clearAutomaticCatalogSharing();
			form.data.barcodePhoto = file;
		},
		onSaveDestinationChange: (destination) => {
			outcome.state.saveDestination = destination;
		},
		onSaveDestinationControl: (element) => {
			saveDestinationControl = element;
		},
		onBack: validation.goBack,
		onSubmit: handleDestinationSubmit,
		onCatalogSubmissionComplete: () => onClose?.(),
	});

	onMount(() => {
		if (initialFood) {
			form.restore(
				getManualEntryFormStateFromFood(initialFood, submissionIntent),
			);
		} else {
			const draft = readManualEntryDraft();
			if (draft) {
				form.restore(draft.form);
				outcome.state.saveDestination = draft.saveDestination;
			}
		}
		draftRestored = true;
		void referenceData.load();
	});

	$effect(() => {
		const activeStep = form.data.activeStep;
		const name = form.data.name;
		const barcodeValue = form.data.barcode;
		if (activeStep !== "share" || catalogSubmissionOnly) {
			listIdentityRequestId += 1;
			listIdentityState = { status: "idle" };
			return;
		}
		const hasSavedIngredients =
			ingredientListIndex[MIX_STORAGE_KEYS.fridge].foodIdentityKeys.length >
				0 ||
			ingredientListIndex[MIX_STORAGE_KEYS.shoppingList].foodIdentityKeys
				.length > 0;
		if (!hasSavedIngredients) {
			listIdentityRequestId += 1;
			listIdentityState = { status: "ready", identityKey: null };
			return;
		}
		const barcodeIdentityKey = getManualEntryBarcodeIdentityKey(barcodeValue);
		if (barcodeIdentityKey) {
			listIdentityRequestId += 1;
			listIdentityState = {
				status: "ready",
				identityKey: barcodeIdentityKey,
			};
			return;
		}
		void refreshListIdentity(name, barcodeValue);
	});

	onDestroy(() => {
		listIdentityRequestId += 1;
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
		barcode.state.scannerOpen = scanSignal > 0;
	});

	$effect(() => {
		if (!draftRestored || initialFood) return;
		persistManualEntryDraft(form.data, outcome.state.saveDestination);
	});

	$effect(() => {
		const movePromptOpen = Boolean(
			outcome.state.listMovePrompt || preflightMovePrompt,
		);
		if (movePromptOpen === lastMovePromptOpen) return;
		lastMovePromptOpen = movePromptOpen;

		if (movePromptOpen) {
			onMoveConfirmationOpen?.();
			return;
		}
		onMoveConfirmationClose?.();
	});
</script>

<section
	class="custom-ingredient"
	aria-label={catalogSubmissionOnly
		? "Correct product information"
		: "Add custom ingredient"}
>
	<div class="custom-ingredient__options">
		{#if showScanButton}
			<ManualEntryScanOption
				scanning={barcode.state.lookingUpBarcode}
				disabled={submission.state.saving ||
					barcode.barcodeReferenceLookupPending}
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

{#if barcode.state.scannerOpen}
	<BarcodeScannerDialog
		open={barcode.state.scannerOpen}
		onDetected={handleBarcodeDetected}
		onClose={barcode.closeBarcodeScanner}
	/>
{/if}

<ConfirmationDialog
	open={Boolean(outcome.state.listMovePrompt || preflightMovePrompt) &&
		moveConfirmationRouteOpen}
	busy={preflightMoveBusy}
	title="Move ingredient?"
	description={preflightMovePrompt
		? `${validation.normalizedName} is already in ${getDestinationLabel(preflightMovePrompt.source)}. Move it to ${getDestinationLabel(preflightMovePrompt.destination)}?`
		: outcome.state.listMovePrompt
			? `${outcome.state.listMovePrompt.food.description} is already in ${getDestinationLabel(outcome.state.listMovePrompt.source)}. Move it to ${getDestinationLabel(outcome.state.listMovePrompt.destination)}?`
			: ""}
	confirmLabel="Move"
	onConfirm={() =>
		preflightMovePrompt
			? resolvePreflightMovePrompt(true)
			: outcome.resolveListMovePrompt(true)}
	onCancel={() =>
		preflightMovePrompt
			? resolvePreflightMovePrompt(false)
			: outcome.resolveListMovePrompt(false)}
/>

<style lang="scss">
	@use "./CustomIngredientForm.scss";
</style>
