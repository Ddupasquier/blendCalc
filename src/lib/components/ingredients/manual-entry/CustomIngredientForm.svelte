<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import "./styles/customIngredientForm.scss";
	import {
		SERVING_MEASURE_OPTIONS,
		type ServingMeasureUnit,
	} from "../../../../defaults/servingMeasureDefaults";
	import {
		buildCustomServingLabel,
		findCustomFoodByBarcode,
		findCustomFoodByName,
		saveCustomFood,
	} from "$lib/utils/food/custom/customFoods";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
	import type { FdcFood, FdcNutrient } from "$lib/utils/food/types";
	import BarcodeScannerDialog from "$lib/components/ingredients/barcode/BarcodeScannerDialog.svelte";
	import type { CustomIngredientOutcomeState } from "$lib/components/ingredients/manual-entry/CustomIngredientOutcome.svelte";
	import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
	import {
		emptyManualEntryNutrientGroups,
		manualEntrySteps,
		volumeAmountRequiredMessage,
		type ManualEntryStepId,
		type ManualEntrySummaryItem,
		type NutrientValueState,
		type StepValidationItem,
	} from "$lib/components/ingredients/manual-entry/formTypes";
	import ManualEntryFormShell from "$lib/components/ingredients/manual-entry/ManualEntryFormShell.svelte";
	import ManualEntryScanOption from "$lib/components/ingredients/manual-entry/ManualEntryScanOption.svelte";
	import ManualEntryStepContent from "$lib/components/ingredients/manual-entry/ManualEntryStepContent.svelte";
	import type { CustomFoodCategoryOption } from "$lib/utils/food/nutrients/categoryOptions";
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
	import {
		lookupBarcodeProduct,
		type BarcodeProductDraft,
	} from "$lib/utils/barcode/productLookup";
	import { barcodeDraftHasEntryChanges } from "$lib/utils/barcode/barcodeDraftComparison";
	import {
		getBarcodeDraftState,
		getBarcodeImportMessage,
		getBarcodeReferenceReviewFlags as buildBarcodeReferenceReviewFlags,
		getKeepManualBarcodeMessage,
		getManualBarcodeReferencePlan,
		lookupManualBarcodeReference,
	} from "$lib/components/ingredients/manual-entry/utils/barcodeFlow";
	import {
		addManualEntryFoodToDestination,
		moveManualEntryOutcome,
		undoManualEntryOutcomeAdd,
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
		markAllValidationAttempted as markAllManualEntryValidationAttempted,
		markValidationAttemptedThroughStep as markManualEntryValidationAttemptedThroughStep,
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
	import { getManualEntrySubmitState } from "$lib/components/ingredients/manual-entry/utils/submitValidation";
	import type { BarcodeScanResult } from "$lib/utils/barcode/types";
	import { submitSharedProduct } from "$lib/utils/products/catalog";
	import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";

	let {
		onCreate,
		onClose,
		closeManualSignal = 0,
		scanSignal = 0,
		showScanButton = true,
		inline = true,
		onLookupStateChange = () => {},
	}: {
		onCreate: ManualEntryCreateHandler;
		onClose?: () => void;
		closeManualSignal?: number;
		scanSignal?: number;
		showScanButton?: boolean;
		inline?: boolean;
		onLookupStateChange?: (lookingUp: boolean) => void;
	} = $props();

	const volumeOptions = SERVING_MEASURE_OPTIONS.filter(
		(option) => option.dimension === "volume",
	);

	let activeStep = $state<ManualEntryStepId>("identity");
	let name = $state("");
	let brandOwner = $state("");
	let category = $state("");
	let servingLabel = $state("");
	let servingWeightGrams = $state<number | null>(null);
	let volumeQuantity = $state<number | null>(null);
	let volumeUnit = $state<ServingMeasureUnit>("tbsp");
	let useVolumeEquivalent = $state(false);
	let manualNutrientValues = $state<NutrientValueState>({});
	let manualTouchedNutrientIds = $state<Record<number, true>>({});
	let importedNutrients = $state<FdcNutrient[]>([]);
	let manualEntryNutrientGroups = $state<ManualEntryNutrientGroupsByStep>(
		emptyManualEntryNutrientGroups,
	);
	let categoryOptions = $state<CustomFoodCategoryOption[]>([]);
	let loadingCategoryOptions = $state(false);
	let categoryOptionsError = $state("");
	let loadingManualEntryNutrients = $state(false);
	let manualEntryNutrientError = $state("");
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
	let barcodeLookupDebounce = $state<ReturnType<typeof setTimeout> | null>(null);
	let scannerOpen = $state(false);
	let barcode = $state("");
	let barcodeSource = $state<FdcFood["barcodeSource"]>("manual");
	let barcodeMessage = $state("");
	let shareWithCatalog = $state(false);
	let catalogMessage = $state("");
	let outcomeAction = $state<"move" | "undo" | null>(null);
	let frontPhoto = $state<File | null>(null);
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
	let saveDestination = $state<SmoothieListKey | "custom-only">(
		MIX_STORAGE_KEYS.fridge,
	);
	let lastOutcome = $state<CustomIngredientOutcomeState | null>(null);
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
		loadingCategoryOptions = true;
		loadingNutrientRelationshipRules = true;
		manualEntryNutrientError = "";
		categoryOptionsError = "";
		nutrientRelationshipRuleError = "";

		void loadManualEntryReferenceData().then((referenceData) => {
			if (cancelled) return;

			manualEntryNutrientGroups =
				referenceData.nutrientGroups ?? emptyManualEntryNutrientGroups;
			manualEntryNutrientError = referenceData.nutrientGroupError;
			categoryOptions = referenceData.categoryOptions;
			categoryOptionsError = referenceData.categoryOptionsError;
			nutrientRelationshipRules = referenceData.nutrientRelationshipRules;
			nutrientRelationshipRuleError =
				referenceData.nutrientRelationshipRuleError;
			loadingManualEntryNutrients = false;
			loadingCategoryOptions = false;
			loadingNutrientRelationshipRules = false;
		});

		return () => {
			cancelled = true;
		};
	});

	const categoryOptionLabels = $derived(
		categoryOptions.map((option) => option.label),
	);
	const visibleCategoryOptions = $derived(
		category && !categoryOptionLabels.includes(category)
			? [category, ...categoryOptionLabels]
			: categoryOptionLabels,
	);
	const categoryPlaceholder = $derived(
		categoryOptionLabels.length > 0
			? `Example: ${categoryOptionLabels.slice(0, 3).join(", ")}`
			: "Choose a category",
	);
	const activeCategory = $derived(category || categories[0] || "");
	const normalizedName = $derived(name.trim());
	const barcodeValidationMessage = $derived(
		getBarcodeInputValidationMessage(barcode),
	);
	const hasValidBarcode = $derived(Boolean(normalizeBarcode(barcode)));
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

	const setManualBarcode = (value: string) => {
		barcode = value;
		barcodeSource = "manual";
		checkedBarcodeReferenceKey = "";
		barcodeReferenceDraft = null;
		barcodeReferenceSourceDraft = null;
		barcodeReferenceAcceptedBarcode = "";
		if (!lookingUpBarcode) barcodeMessage = "";
		scheduleManualBarcodeReferenceCheck();
	};

	const applyBarcodeProductDraft = (draft: BarcodeProductDraft) => {
		const draftState = getBarcodeDraftState(draft);
		name = draftState.name;
		brandOwner = draftState.brandOwner;
		category = draftState.category;
		servingLabel = draftState.servingLabel;
		servingWeightGrams = draftState.servingWeightGrams;
		importedNutrients = draftState.importedNutrients;
		manualNutrientValues = draftState.manualNutrientValues;
		manualTouchedNutrientIds = {};
		useVolumeEquivalent = draftState.useVolumeEquivalent;
		volumeQuantity = draftState.volumeQuantity;
		volumeUnit = draftState.volumeUnit;
		barcode = draftState.barcode;
		barcodeSource = draftState.barcodeSource;
		barcodeReferenceSourceDraft = draft;
		barcodeReferenceAcceptedBarcode = draftState.barcode;
		reportedNutrientIds = draftState.reportedNutrientIds;
		ingredients = draftState.ingredients;
		ingredientList = draftState.ingredientList;
		allergens = draftState.allergens;
		traces = draftState.traces;
		dietaryTags = draftState.dietaryTags;
		labels = draftState.labels;
		categories = draftState.categories;
		checkedBarcodeReferenceKey = draftState.checkedBarcodeReferenceKey;
	};

	const applyBarcodeReferenceSuggestion = () => {
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
	};

	const keepManualBarcodeEntry = () => {
		if (!barcodeReferenceDraft) return;
		barcodeReferenceAcceptedBarcode = "";
		barcodeSource = "manual";
		barcodeMessage = getKeepManualBarcodeMessage(barcodeReferenceDraft);
	};

	const getBarcodeReferenceReviewFlags = () =>
		buildBarcodeReferenceReviewFlags({
			shareWithCatalog,
			barcode,
			sourceDraft: barcodeReferenceSourceDraft,
			currentEntry: currentBarcodeReferenceEntry,
			barcodeSource,
			barcodeReferenceAcceptedBarcode,
		});

	onDestroy(() => {
		clearBarcodeLookupDebounce();
		if (stepWarningTimer) clearTimeout(stepWarningTimer);
	});

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
	};

	const getManualNutrientValue = (field: ManualEntryNutrientDefinition) =>
		getNutrientValue(field.nutrientId);

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
			loadingCategoryOptions,
			categoryOptionsError,
			visibleCategoryOptions,
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

	const markValidationAttemptedThroughStep = (targetStep: ManualEntryStepId) => {
		validationAttemptedSteps = markManualEntryValidationAttemptedThroughStep({
			steps: manualEntrySteps,
			attemptedSteps: validationAttemptedSteps,
			targetStep,
		});
	};

	const markAllValidationAttempted = () => {
		validationAttemptedSteps = markAllManualEntryValidationAttempted(
			manualEntrySteps,
		);
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
		hasValidBarcode &&
			barcodeSource !== "open-food-facts" &&
			!sharedCatalogMatchIsUnchanged,
	);
	const requiresCatalogEvidence = $derived(
		shareWithCatalog &&
			(barcodeSource === "manual" ||
				Boolean(hasSharedCatalogBarcodeReference && barcodeReferenceHasChanges)),
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

	const getOptionalNutrientCount = () =>
		countOptionalNutrients(getSaveNutrients(), requiredManualEntryNutrientFields);

	const getSummaryItems = (): ManualEntrySummaryItem[] =>
		buildSummaryItems({
			requiredFields: requiredManualEntryNutrientFields,
			getValue: getManualNutrientValue,
		});

	const resetForm = () => {
		activeStep = "identity";
		clearStepWarning();
		name = "";
		brandOwner = "";
		category = "";
		servingLabel = "";
		servingWeightGrams = null;
		volumeQuantity = null;
		volumeUnit = "tbsp";
		useVolumeEquivalent = false;
		manualNutrientValues = {};
		manualTouchedNutrientIds = {};
		validationAttemptedSteps = {};
		importedNutrients = [];
		barcode = "";
		barcodeSource = "manual";
		barcodeMessage = "";
		checkingBarcodeReference = false;
		checkedBarcodeReferenceKey = "";
		barcodeReferenceDraft = null;
		barcodeReferenceSourceDraft = null;
		barcodeReferenceAcceptedBarcode = "";
		clearBarcodeLookupDebounce();
		shareWithCatalog = false;
		frontPhoto = null;
		nutritionPhoto = null;
		barcodePhoto = null;
		reportedNutrientIds = [];
		ingredients = "";
		ingredientList = [];
		allergens = [];
		traces = [];
		dietaryTags = [];
		labels = [];
		categories = [];
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
			showStepWarning(result.warning.message, result.warning.step);
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
			showStepWarning(result.warning.message, result.warning.step);
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
		destination: SmoothieListKey | "custom-only",
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
			behavior: "smooth",
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
		onLookupStateChange(lookingUpBarcode || checkingBarcodeReference);
	});

	$effect(() => {
		if (!canShareWithCatalog) {
			shareWithCatalog = false;
		}
	});

	const useIngredient = async (food: FdcFood, alreadySaved = false) => {
		const result = await addManualEntryFoodToDestination({
			food,
			saveDestination,
			alreadySaved,
			onCreate,
		});
		if (!result.ok) {
			error = result.error;
			return false;
		}

		setOutcome(result.food, result.destination, result.addedToList, result.message);
		collapseManualEntry();
		onClose?.();
		return true;
	};

	const moveLastOutcome = async (destination: SmoothieListKey) => {
		if (
			!lastOutcome ||
			!lastOutcome.addedToList ||
			lastOutcome.destination === "custom-only" ||
			outcomeAction
		) {
			return;
		}

		outcomeAction = "move";
		error = "";
		try {
			const result = await moveManualEntryOutcome(lastOutcome, destination);
			if (!result.ok) {
				error = result.error;
				return;
			}
			setOutcome(result.food, result.destination, result.addedToList, result.message);
		} finally {
			outcomeAction = null;
		}
	};

	const undoLastOutcomeAdd = async () => {
		if (
			!lastOutcome ||
			!lastOutcome.addedToList ||
			lastOutcome.destination === "custom-only" ||
			outcomeAction
		) {
			return;
		}

		outcomeAction = "undo";
		error = "";
		try {
			const result = await undoManualEntryOutcomeAdd(lastOutcome);
			if (!result.ok) {
				error = result.error;
				return;
			}
			setOutcome(result.food, result.destination, result.addedToList, result.message);
		} finally {
			outcomeAction = null;
		}
	};

	const handleBarcodeDetected = async (result: BarcodeScanResult) => {
		scannerOpen = false;
		lookingUpBarcode = true;
		error = "";
		barcodeMessage = "Looking up this product…";
		barcode = result.canonicalValue;
		barcodeReferenceDraft = null;
		barcodeReferenceAcceptedBarcode = "";
		activeStep = "share";
		if (labelDetailsElement) labelDetailsElement.open = true;
		let nextFocusTarget: "name" | "destination" = "name";

		try {
			const lookup = await lookupBarcodeProduct(result.value);
			if (lookup.status === "found") {
				nextFocusTarget = "destination";
				barcodeReferenceDraft = lookup.draft;
				applyBarcodeProductDraft(lookup.draft);
				const optionalNutrientCount = getOptionalNutrientCount();
				barcodeMessage = getBarcodeImportMessage(
					lookup.draft,
					optionalNutrientCount,
					"scan",
				);
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
			barcodeMessage =
				lookup.status === "not-found"
					? "No matching product was found. The barcode is filled in so you can enter the label manually."
					: lookup.message;
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
			frontPhoto,
			nutritionPhoto,
			barcodePhoto,
		});
		if (submitState.block) {
			if (submitState.block.mark === "all") {
				markAllValidationAttempted();
			} else {
				markValidationAttemptedThroughStep("share");
			}
			error = submitState.block.message;
			activeStep = submitState.block.step;
			showStepWarning(submitState.block.message, submitState.block.step);
			return;
		}

		const { normalizedBarcode } = submitState;
		if (normalizedBarcode) await checkManualBarcodeReference();

		const food = createManualEntryCustomFood({
			name,
			brandOwner,
			servingLabel: resolvedServingLabel,
			servingWeightGrams,
			useVolumeEquivalent,
			volumeQuantity,
			volumeUnit,
			barcode: normalizedBarcode,
			barcodeSource,
			ingredients,
			ingredientList,
			allergens,
			traces,
			dietaryTags,
			labels,
			activeCategory,
			categories,
			reportedNutrientIds,
			importedNutrients,
			manualEntryNutrientFields,
			manualNutrientValues,
			manualTouchedNutrientIds,
		});

		saving = true;
		try {
			const result = await saveCustomFood(food);
			if (result === "duplicate-name") {
				const existingFood = findCustomFoodByName(name);
				if (existingFood) {
					await useIngredient(existingFood, true);
					resetForm();
					return;
				}
				error = "This ingredient is already saved to your account. Refresh and try again.";
				return;
			}
			if (result === "duplicate-barcode") {
				const existingFood = normalizedBarcode
					? findCustomFoodByBarcode(normalizedBarcode)
					: null;
				if (existingFood) {
					await useIngredient(existingFood, true);
					resetForm();
					return;
				}
				error = "An ingredient with this barcode is already saved to your account.";
				return;
			}
			if (result === "error") {
				error = "This ingredient could not be saved. Check your connection and try again.";
				return;
			}

			const addedToDestination = await useIngredient(food);
			if (
				normalizedBarcode &&
				addedToDestination &&
				(shareWithCatalog || barcodeSource === "open-food-facts")
			) {
				try {
					const submission = await submitSharedProduct(
						food,
						{
							frontPhoto,
							nutritionPhoto,
							barcodePhoto,
						},
						{ reviewFlags: getBarcodeReferenceReviewFlags() },
					);
					catalogMessage = submission.message;
				} catch {
					catalogMessage =
						"The ingredient was saved privately, but catalog review could not be started. You can try again later.";
				}
			}
			resetForm();
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
				onScan={() => (scannerOpen = true)}
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
			onBack={goBack}
			onSelectStep={goToStep}
			onDetailsElement={(element) => (labelDetailsElement = element)}
			onBodyElement={(element) => (manualBodyElement = element)}
		>
			<ManualEntryStepContent
				{activeStep}
				{name}
				{brandOwner}
				{category}
				{barcode}
				{categoryPlaceholder}
				{visibleCategoryOptions}
				{loadingCategoryOptions}
				{categoryOptionsError}
				{barcodeMessage}
				{barcodeValidationMessage}
				{checkingBarcodeReference}
				barcodeSuggestion={barcodeReferenceDraft
					? {
							name: barcodeReferenceDraft.name,
							brandOwner: barcodeReferenceDraft.brandOwner,
							sourceLabel: barcodeReferenceDraft.sourceLabel,
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
				{hideMacroUnavailableStatus}
				{customIngredientValidationItems}
				{normalizedName}
				{activeCategory}
				summaryNutrients={getSummaryItems()}
				optionalNutrientCount={getOptionalNutrientCount()}
				{hasValidBarcode}
				{barcodeSource}
				{canShareWithCatalog}
				{shareUnavailableMessage}
				{shareHelpMessage}
				{shareWithCatalog}
				{requiresCatalogEvidence}
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
				isRequired={isRequiredManualNutrient}
				onNameChange={(value) => (name = value)}
				onBrandChange={(value) => (brandOwner = value)}
				onCategoryChange={(value) => (category = value)}
				onBarcodeChange={setManualBarcode}
				onBarcodeBlur={checkManualBarcodeReference}
				onApplyBarcodeSuggestion={applyBarcodeReferenceSuggestion}
				onKeepManualBarcodeEntry={keepManualBarcodeEntry}
				onNameInput={(element) => (ingredientNameInput = element)}
				onServingLabelChange={(value) => (servingLabel = value)}
				onServingWeightChange={(value) =>
					(servingWeightGrams = Number.isFinite(value) ? value : null)}
				onUseVolumeChange={(value) => (useVolumeEquivalent = value)}
				onVolumeQuantityChange={(value) => (volumeQuantity = value)}
				onVolumeUnitChange={(value) => (volumeUnit = value)}
				onShareChange={(checked) => (shareWithCatalog = checked)}
				onFrontPhotoChange={(file) => (frontPhoto = file)}
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
		onClose={() => (scannerOpen = false)}
	/>
{/if}
