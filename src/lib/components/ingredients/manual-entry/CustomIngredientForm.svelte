<script lang="ts">
	import { onDestroy, onMount, tick } from "svelte";
	import "./styles/customIngredientForm.scss";
	import {
		SERVING_MEASURE_OPTIONS,
		getDefaultServingMeasureUnit,
		type ServingMeasureUnit,
	} from "$lib/utils/serving/servingMeasureCatalog";
	import { buildCustomServingLabel } from "$lib/utils/food/custom/customFoods";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
	import { getMotionSafeScrollBehavior } from "$lib/utils/accessibility/motion";
	import type {
		FdcFood,
		FdcNutrient,
		FoodFieldProvenance,
		FoodImageAsset,
		FoodTrackedField,
		FoodBarcodeProvenance,
	} from "$lib/utils/food/types";
	import BarcodeScannerDialog from "$lib/components/ingredients/barcode/BarcodeScannerDialog.svelte";
	import ConfirmationDialog from "$lib/components/common/dialogs/ConfirmationDialog.svelte";
	import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
	import {
			type CustomIngredientOutcomeState,
			type ManualEntryListMovePromptState,
		emptyManualEntryNutrientGroups,
		manualEntrySteps,
		volumeAmountRequiredMessage,
		type ManualEntryStepId,
		type ManualEntrySummaryItem,
		type NutrientValueState,
		type NutritionLabelOcrApplyPayload,
		type StepValidationItem,
		type FoodCategoryPickerStatus,
	} from "$lib/components/ingredients/manual-entry/formTypes";
	import ManualEntryFormShell from "$lib/components/ingredients/manual-entry/ManualEntryFormShell.svelte";
	import ManualEntryScanOption from "$lib/components/ingredients/manual-entry/ManualEntryScanOption.svelte";
	import ManualEntryStepContent from "$lib/components/ingredients/manual-entry/ManualEntryStepContent.svelte";
	import {
		type ManualEntryNutrientDefinition,
		type ManualEntryNutrientGroupsByStep,
	} from "$lib/utils/food/nutrients/nutrientDefinitions";
	import { loadManualEntryReferenceData } from "$lib/utils/food/nutrients/manualEntryReferenceData";
	import {
		validateNutrientRelationshipRules,
		type NutrientRelationshipRule,
	} from "$lib/utils/food/nutrients/nutrientRelationshipRules";
	import {
		getBarcodeInputValidationMessage,
		normalizeBarcode,
	} from "$lib/utils/barcode/barcode";
	import { pickFoodFullImageUrl } from "$lib/utils/food/images/foodImages";
	import {
		type BarcodeProductDraft,
		getBarcodeProductSourceDisplayLabel,
	} from "$lib/utils/barcode/productLookup";
	import { barcodeDraftHasEntryChanges } from "$lib/utils/barcode/barcodeDraftComparison";
	import {
		getBarcodeCategoryWarningMessage,
		getBarcodeDraftState,
		getBarcodeImportMessage,
		getBarcodeReferenceReviewFlags as buildBarcodeReferenceReviewFlags,
		getKeepManualBarcodeMessage,
		getManualBarcodeReferencePlan,
		lookupManualBarcodeReference,
	} from "$lib/components/ingredients/manual-entry/utils/barcodeFlow";
	import {
		addManualEntryFoodToDestination,
		canChangeManualEntryOutcome,
		getDestinationLabel,
		runManualEntryOutcomeAction,
		type ManualEntryDestinationResult,
		type ManualEntryOutcomeAction,
	} from "$lib/components/ingredients/manual-entry/utils/listOutcome";
	import {
		getManualEntryNutrientFields,
		getManualNutrientValuesById,
		getOptionalNutrientCount as countOptionalNutrients,
		getRequiredManualEntryNutrientFields,
		getSummaryItems as buildSummaryItems,
		setManualNutrientState,
	} from "$lib/components/ingredients/manual-entry/utils/nutrientValues";
	import {
		buildManualEntryNutrientAvailabilityItems,
		buildManualEntryValidationItems,
		buildRequiredManualNutrientValidationItems,
		getAttemptedValidationItems as getAttemptedManualEntryValidationItems,
		markValidationAttemptedStep as markManualEntryValidationAttemptedStep,
		warningStillApplies,
		type ValidationAttemptState,
	} from "$lib/components/ingredients/manual-entry/utils/validationItems";
	import {
		resolveManualEntryBackStep,
		resolveManualEntryNextStep,
		resolveManualEntryStepSelection,
	} from "$lib/components/ingredients/manual-entry/utils/stepNavigation";
	import {
		buildManualEntrySaveNutrients,
		createManualEntryCustomFood,
	} from "$lib/components/ingredients/manual-entry/utils/customFoodPayload";
	import {
		getInitialSaveDestination,
		getManualEntryFormResetState,
	} from "$lib/components/ingredients/manual-entry/utils/formState";
	import { resolveManualEntryBarcodeScan } from "$lib/components/ingredients/manual-entry/utils/barcodeScanFlow";
	import { saveManualEntryCustomFood } from "$lib/components/ingredients/manual-entry/utils/submitFlow";
	import { getManualEntrySubmitState } from "$lib/components/ingredients/manual-entry/utils/submitValidation";
	import type { BarcodeScanResult } from "$lib/utils/barcode/types";
	import { createFullImagePlacement } from "$lib/utils/food/images/imagePlacement";
	import type { ImagePlacementValue } from "$lib/utils/food/images/types";
	import {
		type BarcodeShareValidationResult,
		validateBarcodeProductForSharing,
	} from "$lib/utils/products/catalog";
	import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";
	import type { NutritionLabelOcrMapping } from "$lib/utils/food/ocr/nutritionLabelOcr";

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
	}: {
		onCreate: ManualEntryCreateHandler;
		onClose?: () => void;
		closeManualSignal?: number;
		scanSignal?: number;
		showScanButton?: boolean;
		inline?: boolean;
		onScannerOpen?: () => void;
		onScannerClose?: () => void;
		onLookupStateChange?: (lookingUp: boolean) => void;
	} = $props();

	const volumeOptions = SERVING_MEASURE_OPTIONS.filter(
		(option) => option.dimension === "volume",
	);

	let activeStep = $state<ManualEntryStepId>("identity");
	let name = $state("");
	let nameProvenance = $state<NonNullable<FdcFood["nameProvenance"]>>("user");
	let brandOwner = $state("");
	let category = $state("");
	let categoryOptionId = $state("");
	let servingLabel = $state("");
	let servingWeightGrams = $state<number | null>(null);
	let volumeQuantity = $state<number | null>(null);
	let volumeUnit = $state<ServingMeasureUnit>(
		getDefaultServingMeasureUnit("volume") ?? "",
	);
	let useVolumeEquivalent = $state(false);
	let manualNutrientValues = $state<NutrientValueState>({});
	let manualTouchedNutrientIds = $state<Record<number, true>>({});
	let importedNutrients = $state<FdcNutrient[]>([]);
	let manualEntryNutrientGroups = $state<ManualEntryNutrientGroupsByStep>(
		emptyManualEntryNutrientGroups,
	);
	let loadingCategoryOptions = $state(true);
	let categoryOptionsAvailable = $state(false);
	let categoryOptionsError = $state("");
	let loadingManualEntryNutrients = $state(false);
	let manualEntryNutrientError = $state("");
	let nutritionLabelOcrMappings = $state<NutritionLabelOcrMapping[]>([]);
	let nutritionLabelOcrMappingError = $state("");
	let nutrientRelationshipRules = $state<NutrientRelationshipRule[]>([]);
	let loadingNutrientRelationshipRules = $state(false);
	let nutrientRelationshipRuleError = $state("");
	let error = $state("");
	let savedMessage = $state("");
	let saving = $state(false);
	let lookingUpBarcode = $state(false);
	let checkingBarcodeReference = $state(false);
	let checkedBarcodeReferenceKey = $state("");
	let barcodeReferenceDraft = $state<BarcodeProductDraft | null>(null);
	let barcodeReferenceSourceDraft = $state<BarcodeProductDraft | null>(null);
	let barcodeReferenceAcceptedBarcode = $state("");
	let barcodeShareValidation = $state<BarcodeShareValidationResult | null>(null);
	let validatingBarcodeShare = $state(false);
	let barcodeLookupDebounce = $state<ReturnType<typeof setTimeout> | null>(null);
	let scannerOpen = $state(false);
	let barcode = $state("");
	let barcodeSource = $state<FdcFood["barcodeSource"]>("manual");
	let barcodeProvenance = $state<FoodBarcodeProvenance | undefined>();
	let barcodeMessage = $state("");
	let shareWithCatalog = $state(false);
	let catalogMessage = $state("");
	let outcomeAction = $state<ManualEntryOutcomeAction | null>(null);
	let frontPhoto = $state<File | null>(null);
	let imagePlacement = $state<ImagePlacementValue>(createFullImagePlacement());
	let nutritionPhoto = $state<File | null>(null);
	let barcodePhoto = $state<File | null>(null);
	let reportedNutrientIds = $state<number[]>([]);
	let ingredients = $state("");
	let ingredientList = $state<string[]>([]);
	let allergens = $state<string[]>([]);
	let traces = $state<string[]>([]);
	let dietaryTags = $state<string[]>([]);
	let labels = $state<string[]>([]);
	let categories = $state<string[]>([]);
	let image = $state<FoodImageAsset | undefined>(undefined);
	let fieldProvenance = $state<FoodFieldProvenance | undefined>(undefined);
	let saveDestination = $state<SmoothieListKey>(getInitialSaveDestination());
	let lastOutcome = $state<CustomIngredientOutcomeState | null>(null);
	let listMovePrompt = $state<ManualEntryListMovePromptState | null>(null);
	let stepWarningMessage = $state("");
	let stepWarningStep = $state<ManualEntryStepId | null>(null);
	let stepWarningTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let validationAttemptedSteps = $state<ValidationAttemptState>({});
	let labelDetailsElement = $state<HTMLDetailsElement | null>(null);
	let manualBodyElement = $state<HTMLFieldSetElement | null>(null);
	let ingredientNameInput = $state<HTMLInputElement | null>(null);
	let saveDestinationSelect = $state<HTMLSelectElement | null>(null);
	let lastCloseManualSignal = $state<number | null>(null);
	let lastScanSignal = $state<number | null>(null);

	onMount(() => {
		let cancelled = false;

		loadingManualEntryNutrients = true;
		loadingNutrientRelationshipRules = true;
		manualEntryNutrientError = "";
		nutrientRelationshipRuleError = "";

		void loadManualEntryReferenceData().then((referenceData) => {
			if (cancelled) return;

			manualEntryNutrientGroups =
				referenceData.nutrientGroups ?? emptyManualEntryNutrientGroups;
			manualEntryNutrientError = referenceData.nutrientGroupError;
			nutrientRelationshipRules = referenceData.nutrientRelationshipRules;
			nutrientRelationshipRuleError =
				referenceData.nutrientRelationshipRuleError;
			nutritionLabelOcrMappings = referenceData.nutritionLabelOcrMappings;
			nutritionLabelOcrMappingError = referenceData.nutritionLabelOcrMappingError;
			loadingManualEntryNutrients = false;
			loadingNutrientRelationshipRules = false;
		});

		return () => {
			cancelled = true;
		};
	});

	const activeCategory = $derived(category);
	const activeCategoryOptionId = $derived(categoryOptionId);
	const normalizedName = $derived(name.trim());
	const barcodeValidationMessage = $derived(
		getBarcodeInputValidationMessage(barcode),
	);
	const hasValidBarcode = $derived(Boolean(normalizeBarcode(barcode)));
	const categoryWarningMessage = $derived(
		getBarcodeCategoryWarningMessage({
			barcode,
			sourceDraft: barcodeReferenceSourceDraft,
			selectedCategory: category,
		}),
	);
	const handleCategoryPickerStatus = (status: FoodCategoryPickerStatus) => {
		loadingCategoryOptions = status.loading;
		categoryOptionsAvailable = status.hasOptions;
		categoryOptionsError = status.error;
	};
	const resolvedServingLabel = $derived(
		buildCustomServingLabel({
			servingLabel,
			servingWeightGrams:
				Number.isFinite(servingWeightGrams) && (servingWeightGrams ?? 0) > 0
					? servingWeightGrams ?? 0
					: 0,
			volumeQuantity: useVolumeEquivalent ? volumeQuantity ?? undefined : undefined,
			volumeUnit: useVolumeEquivalent ? volumeUnit : undefined,
		}),
	);
	const getNutrientValue = (nutrientId: number) =>
		manualNutrientValues[nutrientId] ?? null;
	const nutrientRelationshipValidationItems = $derived<StepValidationItem[]>(
		validateNutrientRelationshipRules(
			getManualNutrientValuesById(manualNutrientValues),
			nutrientRelationshipRules,
		).map((issue) => ({
			message: issue.message,
			tone: issue.severity,
			step: "macros",
		})),
	);

	const clearBarcodeLookupDebounce = () => {
		if (!barcodeLookupDebounce) return;
		clearTimeout(barcodeLookupDebounce);
		barcodeLookupDebounce = null;
	};

	const checkManualBarcodeReference = async () => {
		clearBarcodeLookupDebounce();
		const lookupPlan = getManualBarcodeReferencePlan({
			barcode,
			normalizedName,
			checkedBarcodeReferenceKey,
			checkingBarcodeReference,
		});

		if (lookupPlan.action === "clear") {
			checkedBarcodeReferenceKey = "";
			barcodeReferenceDraft = null;
			barcodeReferenceSourceDraft = null;
			barcodeReferenceAcceptedBarcode = "";
			if (!lookingUpBarcode) barcodeMessage = "";
			return;
		}

		if (lookupPlan.action === "invalid") {
			barcodeReferenceDraft = null;
			barcodeReferenceSourceDraft = null;
			barcodeReferenceAcceptedBarcode = "";
			return;
		}

		if (lookupPlan.action === "skip") return;

		checkingBarcodeReference = true;
		barcodeMessage = "Checking barcode against available product sources…";
		try {
			const lookup = await lookupManualBarcodeReference({
				normalizedBarcode: lookupPlan.normalizedBarcode,
				referenceKey: lookupPlan.referenceKey,
				normalizedName,
			});
			checkedBarcodeReferenceKey = lookup.referenceKey;
			barcodeSource = "manual";

			if (lookup.status === "found") {
				barcodeReferenceDraft = lookup.draft;
				barcodeReferenceSourceDraft = lookup.draft;
				barcodeMessage = lookup.message;
				return;
			}

			barcodeReferenceDraft = null;
			barcodeReferenceSourceDraft = null;
			barcodeReferenceAcceptedBarcode = "";
			barcodeMessage = lookup.message;
		} finally {
			checkingBarcodeReference = false;
		}
	};

	const scheduleManualBarcodeReferenceCheck = () => {
		clearBarcodeLookupDebounce();
		const normalizedBarcode = normalizeBarcode(barcode.trim());
		if (!normalizedBarcode) return;
		barcodeLookupDebounce = setTimeout(() => {
			void checkManualBarcodeReference();
		}, 650);
	};

	const clearBarcodeShareValidation = () => {
		barcodeShareValidation = null;
		validatingBarcodeShare = false;
		shareWithCatalog = false;
	};

	const setManualName = (value: string) => {
		name = value;
		nameProvenance = normalizeBarcode(barcode) ? "barcode" : "user";
		clearBarcodeShareValidation();
	};

	const setManualBarcode = (value: string) => {
		barcode = value;
		barcodeProvenance = value.trim()
			? { captureMethod: "manual-entry" }
			: undefined;
		nameProvenance = normalizeBarcode(value) ? "barcode" : "user";
		clearBarcodeShareValidation();
		barcodeSource = "manual";
		checkedBarcodeReferenceKey = "";
		barcodeReferenceDraft = null;
		barcodeReferenceSourceDraft = null;
		barcodeReferenceAcceptedBarcode = "";
		if (!lookingUpBarcode) barcodeMessage = "";
		scheduleManualBarcodeReferenceCheck();
	};

	const openBarcodeScanner = () => {
		scannerOpen = true;
		onScannerOpen?.();
	};

	const closeBarcodeScanner = () => {
		scannerOpen = false;
		onScannerClose?.();
	};

	const applyBarcodeProductDraft = (draft: BarcodeProductDraft) => {
		clearBarcodeShareValidation();
		const draftState = getBarcodeDraftState(draft);
		({
			name,
			nameProvenance,
			brandOwner,
			category,
			categoryOptionId,
			servingLabel,
			servingWeightGrams,
			importedNutrients,
			manualNutrientValues,
			useVolumeEquivalent,
			volumeQuantity,
			volumeUnit,
			barcode,
			barcodeSource,
			reportedNutrientIds,
			ingredients,
			ingredientList,
			allergens,
			traces,
			dietaryTags,
			labels,
			categories,
			image,
			fieldProvenance,
			checkedBarcodeReferenceKey,
		} = draftState);
		manualTouchedNutrientIds = {};
		barcodeReferenceSourceDraft = draft;
		barcodeReferenceAcceptedBarcode = draftState.barcode;
	};

	const applyBarcodeReferenceSuggestion = async () => {
		const draft = barcodeReferenceDraft;
		if (!draft) return;
		applyBarcodeProductDraft(draft);
		const optionalNutrientCount = getOptionalNutrientCount();
		barcodeReferenceDraft = null;
		barcodeMessage = getBarcodeImportMessage(
			draft,
			optionalNutrientCount,
			"autofill",
		);

		await tick();
		const result = resolveManualEntryStepSelection({
			steps: manualEntrySteps,
			activeStep: "identity",
			targetStep: "share",
			attemptedSteps: validationAttemptedSteps,
			validationItems: customIngredientValidationItems,
		});
		if (!result) return;

		validationAttemptedSteps = result.attemptedSteps;
		activeStep = result.activeStep;
		if (result.warning) {
			showNavigationStepWarning(result.warning.message, result.warning.step);
			return;
		}

		clearStepWarning();
	};

	const keepManualBarcodeEntry = () => {
		if (!barcodeReferenceDraft) return;
		clearBarcodeShareValidation();
		barcodeReferenceAcceptedBarcode = "";
		barcodeSource = "manual";
		barcodeMessage = getKeepManualBarcodeMessage(barcodeReferenceDraft);
	};

	const getBarcodeReferenceReviewFlags = () => [
		...buildBarcodeReferenceReviewFlags({
			shareWithCatalog,
			barcode,
			sourceDraft: barcodeReferenceSourceDraft,
			currentEntry: currentBarcodeReferenceEntry,
			barcodeSource,
			barcodeReferenceAcceptedBarcode,
		}),
		...(shouldSubmitOptionalProductImageReview
			? [
					"User provided an optional product image because no trusted DB/API image exists for this barcode. Review the package image and crop before publishing it.",
				]
			: []),
	];

	onDestroy(() => {
		clearBarcodeLookupDebounce();
		if (stepWarningTimer) clearTimeout(stepWarningTimer);
		listMovePrompt?.resolve(false);
	});

	const markFieldAsUserEntered = (field: FoodTrackedField) => {
		fieldProvenance = {
			...fieldProvenance,
			[field]: {
				source: "user-label",
				confidence: "user-reported",
			},
		};
	};

	const setManualNutrientValue = (
		field: ManualEntryNutrientDefinition,
		value: string,
	) => {
		const nextState = setManualNutrientState({
			field,
			value,
			values: manualNutrientValues,
			touched: manualTouchedNutrientIds,
		});
		manualNutrientValues = nextState.values;
		manualTouchedNutrientIds = nextState.touched;
		markFieldAsUserEntered("nutrition");
	};

	const getManualNutrientValue = (field: ManualEntryNutrientDefinition) =>
		getNutrientValue(field.nutrientId);

	const applyNutritionLabelOcr = ({
		candidates,
		serving,
	}: NutritionLabelOcrApplyPayload) => {
		for (const candidate of candidates) {
			const field = manualEntryNutrientFields.find(
				(item) => item.nutrientId === candidate.nutrientId,
			);
			if (!field) continue;
			setManualNutrientValue(field, String(candidate.value));
		}
		if (serving) {
			servingWeightGrams = serving.gramWeight;
			servingLabel = serving.label;
			markFieldAsUserEntered("serving");
		}
	};

	const isRequiredManualNutrient = (field: ManualEntryNutrientDefinition) =>
		field.requiredForManualEntry;

	const manualEntryNutrientFields = $derived(
		getManualEntryNutrientFields(manualEntryNutrientGroups),
	);
	const requiredManualEntryNutrientFields = $derived(
		getRequiredManualEntryNutrientFields(manualEntryNutrientFields),
	);
	const requiredManualNutrientValidationItems = $derived<StepValidationItem[]>(
		buildRequiredManualNutrientValidationItems({
			requiredFields: requiredManualEntryNutrientFields,
			getValue: getManualNutrientValue,
		}),
	);
	const manualEntryNutrientAvailabilityItems = $derived<StepValidationItem[]>(
		buildManualEntryNutrientAvailabilityItems({
			loadingManualEntryNutrients,
			manualEntryNutrientError,
			requiredFieldCount: requiredManualEntryNutrientFields.length,
		}),
	);
	const customIngredientValidationItems = $derived<StepValidationItem[]>(
		buildManualEntryValidationItems({
			normalizedName,
			servingWeightGrams,
			useVolumeEquivalent,
			volumeQuantity,
			volumeAmountRequiredMessage,
			activeCategory,
			activeCategoryOptionId,
			loadingCategoryOptions,
			categoryOptionsError,
			categoryOptionsAvailable,
			loadingNutrientRelationshipRules,
			nutrientRelationshipRuleError,
			manualEntryNutrientAvailabilityItems,
			requiredManualNutrientValidationItems,
			nutrientRelationshipValidationItems,
		}),
	);
	const blockingValidation = $derived(
		customIngredientValidationItems.find((item) => item.tone === "error") ?? null,
	);
	const hideMacroUnavailableStatus = $derived(
		Boolean(manualEntryNutrientError) ||
			(!loadingManualEntryNutrients &&
				!manualEntryNutrientError &&
				requiredManualEntryNutrientFields.length === 0),
	);
	const getAttemptedValidationItems = (items: StepValidationItem[]) =>
		getAttemptedManualEntryValidationItems({
			items,
			attemptedSteps: validationAttemptedSteps,
			stepWarningStep,
			stepWarningMessage,
		});

	const markValidationAttempted = (step: ManualEntryStepId) => {
		validationAttemptedSteps = markManualEntryValidationAttemptedStep({
			attemptedSteps: validationAttemptedSteps,
			step,
		});
	};

	const clearStepWarning = () => {
		stepWarningMessage = "";
		stepWarningStep = null;
		if (stepWarningTimer) {
			clearTimeout(stepWarningTimer);
			stepWarningTimer = null;
		}
	};

	const showStepWarning = (message: string, step: ManualEntryStepId) => {
		clearStepWarning();
		stepWarningMessage = message;
		stepWarningStep = step;
		stepWarningTimer = setTimeout(() => {
			stepWarningMessage = "";
			stepWarningStep = null;
			stepWarningTimer = null;
		}, 3200);
	};

	const showNavigationStepWarning = (message: string, step: ManualEntryStepId) => {
		if (step === "identity" && !activeCategoryOptionId && categoryWarningMessage) {
			clearStepWarning();
			return;
		}
		showStepWarning(message, step);
	};

	$effect(() => {
		if (!stepWarningMessage || !stepWarningStep) return;
		const currentWarningStillApplies = warningStillApplies({
			items: customIngredientValidationItems,
			stepWarningStep,
			stepWarningMessage,
		});
		if (!currentWarningStillApplies) clearStepWarning();
	});

	const getSaveNutrients = () =>
		buildManualEntrySaveNutrients({
			importedNutrients,
			manualEntryNutrientFields,
			manualNutrientValues,
			manualTouchedNutrientIds,
		});

	const currentBarcodeReferenceEntry = $derived({
		name: normalizedName,
		brandOwner,
		category: activeCategory,
		servingLabel,
		servingWeightGrams,
		volumeEquivalent:
			useVolumeEquivalent && volumeQuantity
				? {
						quantity: volumeQuantity,
						unit: volumeUnit,
					}
				: null,
		nutrients: getSaveNutrients(),
		ingredients,
		ingredientList,
		allergens,
		traces,
		dietaryTags,
		labels,
		categories,
	});
	const hasSharedCatalogBarcodeReference = $derived(
		barcodeReferenceSourceDraft?.source === "shared-catalog" &&
			normalizeBarcode(barcode) === barcodeReferenceSourceDraft.barcode,
	);
	const barcodeReferenceHasChanges = $derived(
		barcodeDraftHasEntryChanges(
			barcodeReferenceSourceDraft,
			currentBarcodeReferenceEntry,
		),
	);
	const sharedCatalogMatchIsUnchanged = $derived(
		Boolean(hasSharedCatalogBarcodeReference && !barcodeReferenceHasChanges),
	);
	const canShareWithCatalog = $derived(
		hasValidBarcode && !sharedCatalogMatchIsUnchanged,
	);
	const requiresCatalogEvidence = $derived(
		shareWithCatalog &&
			(barcodeSource === "manual" ||
				Boolean(hasSharedCatalogBarcodeReference && barcodeReferenceHasChanges)),
	);
	const trustedProductImage = $derived(
		pickFoodFullImageUrl(image) ? image : undefined,
	);
	const hasTrustedProductImage = $derived(Boolean(trustedProductImage));
	const hasAcceptedSourceBarcode = $derived.by(() => {
		const normalizedBarcode = normalizeBarcode(barcode);
		return Boolean(
			normalizedBarcode &&
				barcodeReferenceAcceptedBarcode === normalizedBarcode &&
				barcodeReferenceSourceDraft?.barcode === normalizedBarcode,
		);
	});
	const showOptionalProductImageUpload = $derived(
		hasValidBarcode &&
			hasAcceptedSourceBarcode &&
			!hasTrustedProductImage &&
			(barcodeSource === "open-food-facts" || barcodeSource === "usda"),
	);
	const shouldSubmitOptionalProductImageReview = $derived(
		showOptionalProductImageUpload && Boolean(frontPhoto),
	);
	const shareUnavailableMessage = $derived(
		sharedCatalogMatchIsUnchanged
			? "This barcode already exists in blendCalc with matching data, so it cannot be shared again. You can still save it to your own profile."
			: "",
	);
	const shareHelpMessage = $derived(
		hasSharedCatalogBarcodeReference && barcodeReferenceHasChanges
			? "Submit your edits for moderator review. Your private ingredient can still be saved now."
			: canShareWithCatalog
				? "Make this ingredient available to other users. All submissions are reviewed for accuracy."
				: "Add a valid UPC or barcode if you want to submit this ingredient for shared search.",
	);
	const barcodeShareMismatch = $derived.by(() => {
		if (barcodeShareValidation?.status !== "name-mismatch") return null;
		return {
			name: barcodeShareValidation.draft.name,
			brandOwner: barcodeShareValidation.draft.brandOwner,
			sourceLabel: getBarcodeProductSourceDisplayLabel(
				barcodeShareValidation.draft,
			),
			message:
				barcodeShareValidation.message ??
				"Use the verified information to share this product, or remove the barcode and save your current entry only to your account.",
		};
	});

	const handleShareChange = async (checked: boolean) => {
		if (!checked) {
			shareWithCatalog = false;
			barcodeShareValidation = null;
			return;
		}

		const normalizedBarcode = normalizeBarcode(barcode);
		if (!normalizedBarcode || !canShareWithCatalog) {
			shareWithCatalog = false;
			return;
		}

		shareWithCatalog = false;
		barcodeShareValidation = null;
		validatingBarcodeShare = true;
		error = "";
		try {
			const validation = await validateBarcodeProductForSharing(
				normalizedBarcode,
				normalizedName,
			);
			barcodeShareValidation = validation;

			if (validation.status === "name-mismatch") {
				barcodeReferenceDraft = validation.draft;
				barcodeReferenceSourceDraft = validation.draft;
				return;
			}

			if (validation.status === "matched") {
				barcodeReferenceSourceDraft = validation.draft;
			}
			shareWithCatalog = true;
		} catch (validationError) {
			error = validationError instanceof Error
				? validationError.message
				: "The barcode could not be verified for sharing. You can still save it privately.";
		} finally {
			validatingBarcodeShare = false;
		}
	};

	const applyVerifiedBarcodeForSharing = async () => {
		if (barcodeShareValidation?.status !== "name-mismatch") return;
		const draft = barcodeShareValidation.draft;
		barcodeReferenceDraft = draft;
		await applyBarcodeReferenceSuggestion();
		barcodeShareValidation = null;
		shareWithCatalog = draft.source !== "shared-catalog" && activeStep === "share";
	};

	const detachMismatchedBarcodeForPrivateSave = () => {
		if (barcodeShareValidation?.status !== "name-mismatch") return;
		const verifiedName = barcodeShareValidation.draft.name;
		setManualBarcode("");
		frontPhoto = null;
		nutritionPhoto = null;
		barcodePhoto = null;
		image = undefined;
		barcodeMessage = `Barcode removed. “${verifiedName}” remains the verified product, while your current entry can be saved privately to your account.`;
	};

	const getOptionalNutrientCount = () =>
		countOptionalNutrients(getSaveNutrients(), requiredManualEntryNutrientFields);

	const getSummaryItems = (): ManualEntrySummaryItem[] =>
		buildSummaryItems({
			requiredFields: requiredManualEntryNutrientFields,
			getValue: getManualNutrientValue,
		});

	const resetForm = () => {
		clearStepWarning();
		clearBarcodeLookupDebounce();
		({
			activeStep,
			name,
			nameProvenance,
			brandOwner,
			category,
			categoryOptionId,
			servingLabel,
			servingWeightGrams,
			volumeQuantity,
			volumeUnit,
			useVolumeEquivalent,
			manualNutrientValues,
			manualTouchedNutrientIds,
			validationAttemptedSteps,
			importedNutrients,
			barcode,
			barcodeSource,
			barcodeProvenance,
			barcodeMessage,
			checkingBarcodeReference,
			checkedBarcodeReferenceKey,
			barcodeReferenceDraft,
			barcodeReferenceSourceDraft,
			barcodeReferenceAcceptedBarcode,
			barcodeShareValidation,
			validatingBarcodeShare,
			shareWithCatalog,
			frontPhoto,
			imagePlacement,
			nutritionPhoto,
			barcodePhoto,
			reportedNutrientIds,
			ingredients,
			ingredientList,
			allergens,
			traces,
			dietaryTags,
			labels,
			categories,
			image,
			fieldProvenance,
		} = getManualEntryFormResetState());
	};

	const goToStep = async (step: string) => {
		const targetStep = step as ManualEntryStepId;
		if (activeStep === "identity") await checkManualBarcodeReference();
		const result = resolveManualEntryStepSelection({
			steps: manualEntrySteps,
			activeStep,
			targetStep,
			attemptedSteps: validationAttemptedSteps,
			validationItems: customIngredientValidationItems,
		});
		if (!result) return;

		validationAttemptedSteps = result.attemptedSteps;
		activeStep = result.activeStep;
		if (result.warning) {
			showNavigationStepWarning(result.warning.message, result.warning.step);
			return;
		}

		clearStepWarning();
	};

	const goNext = async () => {
		if (activeStep === "identity") await checkManualBarcodeReference();
		const result = resolveManualEntryNextStep({
			steps: manualEntrySteps,
			activeStep,
			attemptedSteps: validationAttemptedSteps,
			validationItems: customIngredientValidationItems,
		});

		validationAttemptedSteps = result.attemptedSteps;
		activeStep = result.activeStep;
		if (result.warning) {
			showNavigationStepWarning(result.warning.message, result.warning.step);
			return;
		}

		clearStepWarning();
	};

	const goBack = () => {
		clearStepWarning();
		const result = resolveManualEntryBackStep({
			steps: manualEntrySteps,
			activeStep,
			attemptedSteps: validationAttemptedSteps,
		});
		validationAttemptedSteps = result.attemptedSteps;
		activeStep = result.activeStep;
		if (!result.close) {
			return;
		}
		onClose?.();
	};

	const setOutcome = (
		food: FdcFood,
		destination: SmoothieListKey,
		addedToList: boolean,
		message: string,
	) => {
		savedMessage = message;
		lastOutcome = {
			food,
			destination,
			addedToList,
			message,
		};
	};

	const applyDestinationResult = (result: ManualEntryDestinationResult) => {
		if (!result.ok) {
			if (!result.moveRequired) error = result.error;
			return false;
		}

		setOutcome(result.food, result.destination, result.addedToList, result.message);
		return true;
	};

	const collapseManualEntry = () => {
		if (labelDetailsElement) labelDetailsElement.open = false;
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
			if (scanSignal > 0) scannerOpen = true;
			return;
		}
		if (scanSignal === lastScanSignal) return;
		lastScanSignal = scanSignal;
		scannerOpen = true;
	});

	$effect(() => {
		onLookupStateChange(
			lookingUpBarcode || checkingBarcodeReference || validatingBarcodeShare,
		);
	});

	$effect(() => {
		if (!canShareWithCatalog) {
			shareWithCatalog = false;
		}
	});

	const requestListMoveConfirmation = (
		result: Extract<ManualEntryDestinationResult, { moveRequired: true }>,
	) =>
		new Promise<boolean>((resolve) => {
			listMovePrompt = {
				food: result.food,
				source: result.source,
				destination: result.destination,
				resolve,
			};
		});

	const resolveListMovePrompt = (confirmed: boolean) => {
		const currentPrompt = listMovePrompt;
		if (!currentPrompt) return;
		listMovePrompt = null;
		if (!confirmed) {
			savedMessage = `${currentPrompt.food.description} remains in ${getDestinationLabel(currentPrompt.source)}.`;
		}
		currentPrompt.resolve(confirmed);
	};

	const useIngredient = async (food: FdcFood, alreadySaved = false) => {
		let result = await addManualEntryFoodToDestination({
			food,
			saveDestination,
			alreadySaved,
			onCreate,
		});
		if (!result.ok && result.moveRequired) {
			const confirmed = await requestListMoveConfirmation(result);
			if (!confirmed) return false;
			result = await addManualEntryFoodToDestination({
				food,
				saveDestination,
				alreadySaved,
				onCreate,
				allowMove: true,
			});
		}
		if (!applyDestinationResult(result)) {
			return false;
		}

		collapseManualEntry();
		return true;
	};

	const runLastOutcomeAction = async (
		action: ManualEntryOutcomeAction,
		destination?: SmoothieListKey,
	) => {
		const currentOutcome = lastOutcome;
		if (
			!currentOutcome ||
			!canChangeManualEntryOutcome(currentOutcome, outcomeAction)
		) {
			return;
		}
		if (action === "move" && !destination) {
			return;
		}

		outcomeAction = action;
		error = "";
		try {
			if (action === "move") {
				const moveDestination = destination;
				if (!moveDestination) return;
				const result = await runManualEntryOutcomeAction({
					action,
					lastOutcome: currentOutcome,
					destination: moveDestination,
				});
				applyDestinationResult(result);
				return;
			}

			const result = await runManualEntryOutcomeAction({
				action,
				lastOutcome: currentOutcome,
			});
			applyDestinationResult(result);
		} finally {
			outcomeAction = null;
		}
	};

	const moveLastOutcome = (destination: SmoothieListKey) =>
		runLastOutcomeAction("move", destination);

	const undoLastOutcomeAdd = () => runLastOutcomeAction("undo");

	const handleBarcodeDetected = async (result: BarcodeScanResult) => {
		closeBarcodeScanner();
		lookingUpBarcode = true;
		error = "";
		barcodeMessage = "Looking up this product…";
		barcode = result.canonicalValue;
		barcodeProvenance = {
			captureMethod: result.captureMethod,
			sourceReference: result.sourceReference,
			format: result.format,
		};
		barcodeReferenceDraft = null;
		barcodeReferenceAcceptedBarcode = "";
		activeStep = "share";
		if (labelDetailsElement) labelDetailsElement.open = true;
		let nextFocusTarget: "name" | "destination" = "name";

		try {
			const outcome = await resolveManualEntryBarcodeScan({
				result,
				getOptionalNutrientCount,
			});
			nextFocusTarget = outcome.focusTarget;
			barcodeMessage = outcome.message;

			if (outcome.status === "found") {
				barcodeReferenceDraft = outcome.draft;
				applyBarcodeProductDraft(outcome.draft);
				return;
			}

			activeStep = "identity";
			barcodeSource = "manual";
			barcodeReferenceDraft = null;
			barcodeReferenceAcceptedBarcode = "";
			reportedNutrientIds = [];
			ingredients = "";
			ingredientList = [];
			allergens = [];
			traces = [];
			dietaryTags = [];
			labels = [];
			categories = [];
		} finally {
			lookingUpBarcode = false;
			await scrollToManualReview(nextFocusTarget);
		}
	};

	const handleSubmit = async () => {
		if (saving) return;
		error = "";
		savedMessage = "";
		catalogMessage = "";
		lastOutcome = null;

		const submitState = getManualEntrySubmitState({
			loadingNutrientRelationshipRules,
			blockingValidation,
			useVolumeEquivalent,
			volumeQuantity,
			volumeAmountRequiredMessage,
			barcode,
			requiresCatalogEvidence,
			hasTrustedProductImage,
			frontPhoto,
			nutritionPhoto,
			barcodePhoto,
		});
		if (submitState.block) {
			markValidationAttempted(submitState.block.step);
			error = submitState.block.message;
			activeStep = submitState.block.step;
			showNavigationStepWarning(
				submitState.block.message,
				submitState.block.step,
			);
			return;
		}

		const { normalizedBarcode } = submitState;
		if (normalizedBarcode) await checkManualBarcodeReference();

		const food = createManualEntryCustomFood({
			name,
			nameProvenance,
			brandOwner,
			servingLabel: resolvedServingLabel,
			servingWeightGrams,
			useVolumeEquivalent,
			volumeQuantity,
			volumeUnit,
			barcode: normalizedBarcode,
			barcodeSource,
			barcodeProvenance,
			sourceKey: barcodeSource !== "manual"
				? barcodeReferenceSourceDraft?.sourceKey
				: undefined,
			sourceLabel: barcodeSource !== "manual"
				? barcodeReferenceSourceDraft?.sourceLabel
				: undefined,
			sourceDataType: barcodeSource !== "manual"
				? barcodeReferenceSourceDraft?.sourceDataType
				: undefined,
			sourcePublishedDate: barcodeSource !== "manual"
				? barcodeReferenceSourceDraft?.sourcePublishedDate
				: undefined,
			sourceModifiedDate: barcodeSource !== "manual"
				? barcodeReferenceSourceDraft?.sourceModifiedDate
				: undefined,
			ingredients,
			ingredientList,
			allergens,
			traces,
			dietaryTags,
			labels,
			activeCategory,
			categoryOptionId: activeCategoryOptionId,
			categories,
			image,
			fieldProvenance,
			reportedNutrientIds,
			hasSourceServing: barcodeSource === "manual"
				? true
				: barcodeReferenceSourceDraft?.hasSourceServing,
			importedNutrients,
			manualEntryNutrientFields,
			manualNutrientValues,
			manualTouchedNutrientIds,
		});

		saving = true;
		try {
			const result = await saveManualEntryCustomFood({
				food,
				name,
				normalizedBarcode,
				shareWithCatalog,
				submitForCatalog: shouldSubmitOptionalProductImageReview,
				photos: {
					frontPhoto,
					frontImageCrop: frontPhoto ? imagePlacement : null,
					nutritionPhoto,
					barcodePhoto,
				},
				reviewFlags: getBarcodeReferenceReviewFlags(),
				useIngredient,
			});

				if (result.status === "error") {
				error = result.error;
					return;
				}
				if (result.status === "cancelled") return;

			catalogMessage = result.catalogMessage;
			if (result.resetForm) resetForm();
		} finally {
			saving = false;
		}
	};
</script>

<section class="custom-ingredient" aria-label="Add custom ingredient">
	<div class="custom-ingredient__options">
		{#if showScanButton}
			<ManualEntryScanOption
				scanning={lookingUpBarcode}
				disabled={saving || checkingBarcodeReference}
				onScan={openBarcodeScanner}
			/>
		{/if}

		<ManualEntryFormShell
			{inline}
			{activeStep}
			steps={manualEntrySteps}
			{saving}
			{lookingUpBarcode}
			{stepWarningMessage}
			{stepWarningStep}
				onSelectStep={goToStep}
			onDetailsElement={(element) => (labelDetailsElement = element)}
			onBodyElement={(element) => (manualBodyElement = element)}
		>
			<ManualEntryStepContent
				{activeStep}
				{name}
				{brandOwner}
				{category}
				{categoryOptionId}
				{barcode}
				{categoryWarningMessage}
				categorySourceValues={barcodeReferenceSourceDraft?.categories ?? categories}
				{barcodeMessage}
				{barcodeValidationMessage}
				{checkingBarcodeReference}
				barcodeSuggestion={barcodeReferenceDraft
					? {
							name: barcodeReferenceDraft.name,
							brandOwner: barcodeReferenceDraft.brandOwner,
							sourceLabel: getBarcodeProductSourceDisplayLabel(
								barcodeReferenceDraft,
							),
						}
					: null}
				{servingLabel}
				{resolvedServingLabel}
				{servingWeightGrams}
				{useVolumeEquivalent}
				{volumeQuantity}
				{volumeUnit}
				volumeOptions={volumeOptions.map((option) => ({
					value: option.value,
					label: option.label,
				}))}
				{manualEntryNutrientGroups}
				{loadingManualEntryNutrients}
				{manualEntryNutrientError}
				{nutritionLabelOcrMappings}
				{nutritionLabelOcrMappingError}
				{nutritionPhoto}
				{hideMacroUnavailableStatus}
				{customIngredientValidationItems}
				{normalizedName}
				{activeCategory}
				summaryNutrients={getSummaryItems()}
				optionalNutrientCount={getOptionalNutrientCount()}
				{canShareWithCatalog}
				{shareUnavailableMessage}
				{shareHelpMessage}
				{shareWithCatalog}
				{barcodeShareMismatch}
				{validatingBarcodeShare}
				{requiresCatalogEvidence}
				{showOptionalProductImageUpload}
				{trustedProductImage}
				{frontPhoto}
				{imagePlacement}
				{saveDestination}
				{error}
				{lastOutcome}
				{outcomeAction}
				{savedMessage}
				{catalogMessage}
				{saving}
				{getAttemptedValidationItems}
				getManualNutrientValue={getManualNutrientValue}
				onValueChange={setManualNutrientValue}
				onApplyNutritionLabelOcr={applyNutritionLabelOcr}
				isRequired={isRequiredManualNutrient}
				onNameChange={setManualName}
				onBrandChange={(value) => (brandOwner = value)}
				onCategoryChange={(option) => {
					category = option.label;
					categoryOptionId = option.id;
					markFieldAsUserEntered("categories");
				}}
				onCategoryStatusChange={handleCategoryPickerStatus}
				onBarcodeChange={setManualBarcode}
				onBarcodeBlur={checkManualBarcodeReference}
				onApplyBarcodeSuggestion={applyBarcodeReferenceSuggestion}
				onKeepManualBarcodeEntry={keepManualBarcodeEntry}
				onNameInput={(element) => (ingredientNameInput = element)}
				onServingLabelChange={(value) => {
					servingLabel = value;
					markFieldAsUserEntered("serving");
				}}
				onServingWeightChange={(value) => {
					servingWeightGrams = Number.isFinite(value) ? value : null;
					markFieldAsUserEntered("serving");
				}}
				onUseVolumeChange={(value) => {
					useVolumeEquivalent = value;
					markFieldAsUserEntered("serving");
				}}
				onVolumeQuantityChange={(value) => {
					volumeQuantity = value;
					markFieldAsUserEntered("serving");
				}}
				onVolumeUnitChange={(value) => {
					volumeUnit = value;
					markFieldAsUserEntered("serving");
				}}
				onShareChange={handleShareChange}
				onApplyVerifiedBarcode={applyVerifiedBarcodeForSharing}
				onDetachBarcodeForPrivateSave={detachMismatchedBarcodeForPrivateSave}
				onFrontPhotoChange={(file) => (frontPhoto = file)}
				onImagePlacementChange={(value) => (imagePlacement = value)}
				onNutritionPhotoChange={(file) => (nutritionPhoto = file)}
				onBarcodePhotoChange={(file) => (barcodePhoto = file)}
				onSaveDestinationChange={(destination) => (saveDestination = destination)}
				onSaveDestinationInput={(element) => (saveDestinationSelect = element)}
				onMoveToShopping={() => moveLastOutcome(MIX_STORAGE_KEYS.shoppingList)}
				onMoveToFridge={() => moveLastOutcome(MIX_STORAGE_KEYS.fridge)}
				onUndo={undoLastOutcomeAdd}
				onBack={goBack}
				onNext={goNext}
				onSubmit={handleSubmit}
			/>
		</ManualEntryFormShell>
	</div>
</section>

{#if scannerOpen}
	<BarcodeScannerDialog
		open={scannerOpen}
		onDetected={handleBarcodeDetected}
		onClose={closeBarcodeScanner}
	/>
{/if}

<ConfirmationDialog
	open={Boolean(listMovePrompt)}
	title="Move ingredient?"
	description={listMovePrompt
		? `${listMovePrompt.food.description} is already in ${getDestinationLabel(listMovePrompt.source)}. Move it to ${getDestinationLabel(listMovePrompt.destination)}?`
		: ""}
	confirmLabel="Move"
	onConfirm={() => resolveListMovePrompt(true)}
	onCancel={() => resolveListMovePrompt(false)}
/>
