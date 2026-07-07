<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import {
		SERVING_MEASURE_OPTIONS,
		type ServingMeasureUnit,
	} from "../../../../defaults/servingMeasureDefaults";
	import {
		buildCustomServingLabel,
		createCustomFood,
		findCustomFoodByBarcode,
		findCustomFoodByName,
		saveCustomFood,
	} from "$lib/utils/food/custom/customFoods";
	import {
		addFoodToSmoothieList,
		removeFoodFromSmoothieList,
		type SmoothieListKey,
	} from "$lib/utils/storage/client/smoothieLists";
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
	import IdentityStep from "$lib/components/ingredients/manual-entry/steps/IdentityStep.svelte";
	import NutrientStep from "$lib/components/ingredients/manual-entry/steps/NutrientStep.svelte";
	import ServingsStep from "$lib/components/ingredients/manual-entry/steps/ServingsStep.svelte";
	import ShareStep from "$lib/components/ingredients/manual-entry/steps/ShareStep.svelte";
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
	let validationAttemptedSteps = $state<Partial<Record<ManualEntryStepId, boolean>>>({});
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

	const activeStepIndex = $derived(
		Math.max(
			0,
			manualEntrySteps.findIndex((step) => step.id === activeStep),
		),
	);
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
	const getManualNutrientValuesById = () => {
		const values = new Map<number, number>();
		for (const [nutrientId, value] of Object.entries(manualNutrientValues)) {
			const numericId = Number(nutrientId);
			if (Number.isFinite(numericId) && Number.isFinite(value)) {
				values.set(numericId, value);
			}
		}
		return values;
	};
	const nutrientRelationshipValidationItems = $derived<StepValidationItem[]>(
		validateNutrientRelationshipRules(
			getManualNutrientValuesById(),
			nutrientRelationshipRules,
		).map((issue) => ({
			message: issue.message,
			tone: issue.severity,
			step: "macros",
		})),
	);

	const getBarcodeReferenceKey = (normalizedBarcode: string) =>
		`${normalizedBarcode}:${normalizedName.toLocaleLowerCase()}`;

	const clearBarcodeLookupDebounce = () => {
		if (!barcodeLookupDebounce) return;
		clearTimeout(barcodeLookupDebounce);
		barcodeLookupDebounce = null;
	};

	const namesLookDifferent = (enteredName: string, sourceName: string) => {
		const normalizeName = (value: string) =>
			value
				.toLocaleLowerCase()
				.replace(/[^a-z0-9]+/g, " ")
				.trim();
		const entered = normalizeName(enteredName);
		const source = normalizeName(sourceName);
		if (!entered || !source) return false;
		return !entered.includes(source) && !source.includes(entered);
	};

	const checkManualBarcodeReference = async () => {
		clearBarcodeLookupDebounce();
		const trimmedBarcode = barcode.trim();
		if (!trimmedBarcode) {
			checkedBarcodeReferenceKey = "";
			barcodeReferenceDraft = null;
			barcodeReferenceSourceDraft = null;
			barcodeReferenceAcceptedBarcode = "";
			if (!lookingUpBarcode) barcodeMessage = "";
			return;
		}

		const normalizedBarcode = normalizeBarcode(trimmedBarcode);
		if (!normalizedBarcode) {
			barcodeReferenceDraft = null;
			barcodeReferenceSourceDraft = null;
			barcodeReferenceAcceptedBarcode = "";
			return;
		}

		const referenceKey = getBarcodeReferenceKey(normalizedBarcode);
		if (checkedBarcodeReferenceKey === referenceKey || checkingBarcodeReference) return;

		checkingBarcodeReference = true;
		barcodeMessage = "Checking barcode against available product sources…";
		try {
			const lookup = await lookupBarcodeProduct(normalizedBarcode);
			checkedBarcodeReferenceKey = referenceKey;
			barcodeSource = "manual";

			if (lookup.status === "found") {
				barcodeReferenceDraft = lookup.draft;
				barcodeReferenceSourceDraft = lookup.draft;
				const mismatchCopy = namesLookDifferent(normalizedName, lookup.draft.name)
					? ` Lookup found “${lookup.draft.name}”, so reviewers can compare it with your typed label if you share this product.`
					: " Reviewers can use this source reference if you share this product.";
				barcodeMessage = `Barcode matched ${lookup.draft.sourceLabel}.${mismatchCopy} Autofill is available, but optional.`;
				return;
			}

			barcodeReferenceDraft = null;
			barcodeReferenceSourceDraft = null;
			barcodeReferenceAcceptedBarcode = "";
			barcodeMessage =
				lookup.status === "not-found"
					? "No source match found for this barcode yet. You can still save it; shared submissions will rely on label photos."
					: lookup.message;
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
		name = draft.name;
		brandOwner = draft.brandOwner;
		category = draft.categories?.[0] ?? "";
		servingLabel = draft.servingLabel;
		servingWeightGrams = draft.servingWeightGrams;
		importedNutrients = [...draft.nutrients];
		manualNutrientValues = Object.fromEntries(
			draft.nutrients.map((nutrient) => [
				nutrient.nutrientId,
				Number.isFinite(nutrient.value) ? Math.max(0, nutrient.value) : 0,
			]),
		);
		manualTouchedNutrientIds = {};
		useVolumeEquivalent = Boolean(draft.volumeEquivalent);
		volumeQuantity = draft.volumeEquivalent?.quantity ?? null;
		volumeUnit = draft.volumeEquivalent?.unit ?? "tbsp";
		barcode = draft.barcode;
		barcodeSource = draft.source === "shared-catalog" ? "community" : draft.source;
		barcodeReferenceSourceDraft = draft;
		barcodeReferenceAcceptedBarcode = draft.barcode;
		reportedNutrientIds = [...draft.reportedNutrientIds];
		ingredients = draft.ingredients ?? "";
		ingredientList = [...(draft.ingredientList ?? [])];
		allergens = [...(draft.allergens ?? [])];
		traces = [...(draft.traces ?? [])];
		dietaryTags = [...(draft.dietaryTags ?? [])];
		labels = [...(draft.labels ?? [])];
		categories = [...(draft.categories ?? [])];
		checkedBarcodeReferenceKey = getBarcodeReferenceKey(draft.barcode);
	};

	const applyBarcodeReferenceSuggestion = () => {
		const draft = barcodeReferenceDraft;
		if (!draft) return;
		applyBarcodeProductDraft(draft);
		const optionalNutrientCount = getOptionalNutrientCount();
		const nutrientSummary = optionalNutrientCount > 0
			? ` ${optionalNutrientCount} additional reported nutrients were included.`
			: " No additional vitamin or mineral values were reported by this source.";
		const volumeSummary = draft.volumeEquivalent
			? " The package's volume-to-weight serving was also included."
			: "";
		barcodeReferenceDraft = null;
		barcodeMessage = `Autofilled from ${draft.sourceLabel}.${nutrientSummary}${volumeSummary} Review it before saving.`;
	};

	const keepManualBarcodeEntry = () => {
		if (!barcodeReferenceDraft) return;
		barcodeReferenceAcceptedBarcode = "";
		barcodeSource = "manual";
		barcodeMessage = `Keeping your manually entered label. Reviewers will see that ${barcodeReferenceDraft.sourceLabel} has source data for this barcode if you share this product.`;
	};

	const getBarcodeReferenceReviewFlags = () => {
		const normalizedBarcode = normalizeBarcode(barcode);
		const sourceDraft = barcodeReferenceSourceDraft;
		if (
			!shareWithCatalog ||
			!normalizedBarcode ||
			!sourceDraft ||
			sourceDraft.barcode !== normalizedBarcode
		) {
			return [];
		}

		const hasChanges = barcodeDraftHasEntryChanges(
			sourceDraft,
			currentBarcodeReferenceEntry,
		);
		if (!hasChanges) return [];

		const sourceReference = sourceDraft.sourceReference
			? ` Reference: ${sourceDraft.sourceReference}.`
			: "";
		if (sourceDraft.source === "shared-catalog") {
			return [
				`User submitted changes for an existing blendCalc catalog product. Source product: “${sourceDraft.name}”.${sourceReference} Compare user-entered data against active source/API data before approval.`,
			];
		}

		if (
			barcodeSource !== "manual" &&
			barcodeReferenceAcceptedBarcode === normalizedBarcode
		) {
			return [];
		}
		return [
			`User chose to share manually entered product data instead of autofilling from ${sourceDraft.sourceLabel}. Source product: “${sourceDraft.name}”.${sourceReference} Compare user-entered data against active source/API data before approval.`,
		];
	};

	onDestroy(() => {
		clearBarcodeLookupDebounce();
		if (stepWarningTimer) clearTimeout(stepWarningTimer);
	});

	const setManualNutrientValue = (
		field: ManualEntryNutrientDefinition,
		value: string,
	) => {
		if (value.trim() === "") {
			const { [field.nutrientId]: _removedValue, ...nextValues } =
				manualNutrientValues;
			const { [field.nutrientId]: _removedTouched, ...nextTouched } =
				manualTouchedNutrientIds;
			manualNutrientValues = nextValues;
			manualTouchedNutrientIds = nextTouched;
			return;
		}

		const numericValue = Number(value);
		const nextValue = Number.isFinite(numericValue)
			? Math.max(0, numericValue)
			: null;
		if (nextValue === null) return;

		manualNutrientValues = {
			...manualNutrientValues,
			[field.nutrientId]: nextValue,
		};
		manualTouchedNutrientIds = {
			...manualTouchedNutrientIds,
			[field.nutrientId]: true,
		};
	};

	const getManualNutrientValue = (field: ManualEntryNutrientDefinition) =>
		getNutrientValue(field.nutrientId);

	const isRequiredManualNutrient = (field: ManualEntryNutrientDefinition) =>
		field.requiredForManualEntry;

	const stripUnitFromNutrientLabel = (label: string) =>
		label.replace(/\s*\([^)]*\)\s*$/u, "").trim();

	const manualEntryNutrientFields = $derived(
		[
			...manualEntryNutrientGroups.macros.flatMap((group) => group.fields),
			...manualEntryNutrientGroups.extended.flatMap((group) => group.fields),
		],
	);
	const requiredManualEntryNutrientFields = $derived(
		manualEntryNutrientFields.filter((field) => field.requiredForManualEntry),
	);
	const requiredManualNutrientValidationItems = $derived<StepValidationItem[]>(
		requiredManualEntryNutrientFields
			.filter((field) => {
				const value = getManualNutrientValue(field);
				return value === null || !Number.isFinite(value);
			})
			.map((field) => ({
				message: `${stripUnitFromNutrientLabel(field.label)} is required`,
				tone: "error",
				step: field.step,
			})),
	);
	const manualEntryNutrientAvailabilityItems = $derived<StepValidationItem[]>(
		[
			loadingManualEntryNutrients
				? {
						message: "Nutrient fields are still loading. Try again in a moment.",
						tone: "error",
						step: "macros",
						showImmediately: true,
					}
				: null,
			manualEntryNutrientError
				? {
						message: manualEntryNutrientError,
						tone: "error",
						step: "macros",
						showImmediately: true,
					}
				: null,
			!loadingManualEntryNutrients &&
			!manualEntryNutrientError &&
			requiredManualEntryNutrientFields.length === 0
				? {
						message:
							"Required nutrient fields are unavailable. Try again after nutrient metadata loads.",
						tone: "error",
						step: "macros",
						showImmediately: true,
					}
				: null,
		].filter(Boolean) as StepValidationItem[],
	);
	const customIngredientValidationItems = $derived<StepValidationItem[]>(
		[
			normalizedName.length < 3
				? {
						message: "Name must be at least 3 characters",
						tone: "error",
						step: "identity",
					}
				: null,
			!Number.isFinite(servingWeightGrams) || (servingWeightGrams ?? 0) <= 0
				? {
						message: "Serving weight is required",
						tone: "error",
						step: "servings",
					}
				: null,
			useVolumeEquivalent &&
			(volumeQuantity === null || !Number.isFinite(volumeQuantity) || volumeQuantity <= 0)
				? {
						message: volumeAmountRequiredMessage,
						tone: "error",
						step: "servings",
					}
				: null,
			!activeCategory
				? {
						message: loadingCategoryOptions
							? "Food categories are still loading. Try again in a moment."
							: categoryOptionsError || visibleCategoryOptions.length === 0
								? "Food categories are unavailable. Try again after categories finish syncing."
								: "Please select a category for this ingredient.",
						tone: "error",
						step: "identity",
					}
				: null,
			loadingNutrientRelationshipRules
				? {
						message:
							"Nutrition validation rules are still loading. Try again in a moment.",
						tone: "error",
						step: "macros",
						showImmediately: true,
					}
				: null,
			nutrientRelationshipRuleError
				? {
						message: nutrientRelationshipRuleError,
						tone: "error",
						step: "macros",
						showImmediately: true,
					}
				: null,
			...manualEntryNutrientAvailabilityItems,
			...requiredManualNutrientValidationItems,
			...nutrientRelationshipValidationItems,
		].filter(Boolean) as StepValidationItem[],
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
	const getVisibleValidationItems = (items: StepValidationItem[]) =>
		items.filter(
			(item) =>
				!(
					stepWarningStep === item.step &&
					stepWarningMessage &&
					item.message === stepWarningMessage
				),
		);
	const getAttemptedValidationItems = (items: StepValidationItem[]) =>
		getVisibleValidationItems(items).filter(
			(item) => item.showImmediately || validationAttemptedSteps[item.step],
		);

	const markValidationAttemptedThroughStep = (targetStep: ManualEntryStepId) => {
		const targetIndex = manualEntrySteps.findIndex((step) => step.id === targetStep);
		const nextAttemptedSteps = { ...validationAttemptedSteps };

		for (const step of manualEntrySteps.slice(0, Math.max(0, targetIndex))) {
			nextAttemptedSteps[step.id] = true;
		}

		validationAttemptedSteps = nextAttemptedSteps;
	};

	const markAllValidationAttempted = () => {
		validationAttemptedSteps = Object.fromEntries(
			manualEntrySteps.map((step) => [step.id, true]),
		) as Partial<Record<ManualEntryStepId, boolean>>;
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
		const warningStillApplies = customIngredientValidationItems.some(
			(item) =>
				item.step === stepWarningStep && item.message === stepWarningMessage,
		);
		if (!warningStillApplies) clearStepWarning();
	});

	const getFirstBlockingValidationThroughStep = (
		targetStep: ManualEntryStepId,
	) => {
		const targetIndex = manualEntrySteps.findIndex((step) => step.id === targetStep);
		const stepsToValidate = new Set(
			manualEntrySteps
				.slice(0, Math.max(0, targetIndex))
				.map((step) => step.id),
		);

		return (
			customIngredientValidationItems.find(
				(item) => item.tone === "error" && stepsToValidate.has(item.step),
			) ?? null
		);
	};

	const getSaveNutrients = () => {
		const nutrientsById = new Map<number, FdcNutrient>();

		for (const nutrient of importedNutrients) {
			const nutrientId = Number(nutrient.nutrientId);
			if (!Number.isFinite(nutrientId)) continue;
			nutrientsById.set(nutrientId, {
				...nutrient,
				nutrientId,
				value: Number.isFinite(nutrient.value) ? Math.max(0, nutrient.value) : 0,
			});
		}

		for (const field of manualEntryNutrientFields) {
			const value = getManualNutrientValue(field);
			const existing = nutrientsById.get(field.nutrientId);
			const wasEdited = Boolean(manualTouchedNutrientIds[field.nutrientId]);
			const shouldPersistManualValue =
				wasEdited ||
				!existing ||
				field.requiredForManualEntry ||
				(value !== null && value > 0);

			if (!shouldPersistManualValue || !Number.isFinite(value)) continue;
			if (value <= 0 && !field.requiredForManualEntry && !wasEdited) continue;

			const keepImportedMetadata = Boolean(existing && !wasEdited);

			nutrientsById.set(field.nutrientId, {
				nutrientId: field.nutrientId,
				nutrientName: field.nutrientName,
				nutrientNumber: field.nutrientNumber,
				unitName: field.unitName,
				value,
				valueOrigin: "reported",
				source: keepImportedMetadata ? existing?.source : "user-label",
				sourceReference: keepImportedMetadata
					? existing?.sourceReference
					: undefined,
				confidence: keepImportedMetadata
					? existing?.confidence
					: "user-reported",
			});
		}

		return [...nutrientsById.values()];
	};

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

	const getOptionalNutrientCount = () => {
		const requiredIds = new Set(
			requiredManualEntryNutrientFields.map((field) => field.nutrientId),
		);
		return getSaveNutrients().filter(
			(nutrient) => !requiredIds.has(nutrient.nutrientId),
		).length;
	};

	const getSummaryItems = (): ManualEntrySummaryItem[] =>
		requiredManualEntryNutrientFields.slice(0, 4).map((field) => ({
			label: stripUnitFromNutrientLabel(field.label),
			value: getManualNutrientValue(field) ?? 0,
			unitName: field.unitName,
		}));

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

	const getDestinationLabel = () => {
		if (saveDestination === MIX_STORAGE_KEYS.fridge) return "Fridge";
		if (saveDestination === MIX_STORAGE_KEYS.shoppingList) return "Shopping List";
		return "Custom Ingredients";
	};

	const getListDestinationLabel = (destination: SmoothieListKey) => {
		return destination === MIX_STORAGE_KEYS.fridge ? "Fridge" : "Shopping List";
	};

	const goToStep = async (step: string) => {
		const targetStep = step as ManualEntryStepId;
		const targetIndex = manualEntrySteps.findIndex(
			(manualStep) => manualStep.id === targetStep,
		);
		if (targetIndex < 0) return;

		if (targetIndex <= activeStepIndex) {
			clearStepWarning();
			activeStep = targetStep;
			return;
		}

		if (activeStep === "identity") await checkManualBarcodeReference();

		markValidationAttemptedThroughStep(targetStep);
		const blockingStepValidation =
			getFirstBlockingValidationThroughStep(targetStep);
		if (blockingStepValidation) {
			activeStep = blockingStepValidation.step;
			showStepWarning(blockingStepValidation.message, blockingStepValidation.step);
			return;
		}

		clearStepWarning();
		activeStep = targetStep;
	};

	const goNext = async () => {
		if (activeStep === "identity") await checkManualBarcodeReference();
		const targetStep = manualEntrySteps[activeStepIndex + 1]?.id ?? activeStep;
		markValidationAttemptedThroughStep(targetStep);
		const blockingStepValidation =
			getFirstBlockingValidationThroughStep(targetStep);
		if (blockingStepValidation) {
			showStepWarning(blockingStepValidation.message, blockingStepValidation.step);
			return;
		}

		const nextStep = manualEntrySteps[activeStepIndex + 1];
		if (nextStep) {
			clearStepWarning();
			activeStep = nextStep.id;
		}
	};

	const goBack = () => {
		clearStepWarning();
		const previousStep = manualEntrySteps[activeStepIndex - 1];
		if (previousStep) {
			activeStep = previousStep.id;
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
		const destinationLabel = getDestinationLabel();

		if (saveDestination === "custom-only") {
			await onCreate(food, {
				destination: "custom-only",
				addedToList: false,
				source: "manual-entry",
			});
			const message = alreadySaved
				? `${food.description} is already saved. Showing your existing ingredient.`
				: `${food.description} saved as a custom ingredient.`;
			setOutcome(food, "custom-only", false, message);
			collapseManualEntry();
			onClose?.();
			return true;
		}

		const listResult = await addFoodToSmoothieList(saveDestination, food);
		if (listResult === "error") {
			error = `${food.description} was saved, but could not be added to ${destinationLabel}. Try adding it again.`;
			return false;
		}

		const message =
			listResult === "duplicate"
				? `${food.description} is already in ${destinationLabel}.`
				: alreadySaved
					? `${food.description} is already saved and is now in ${destinationLabel}.`
					: `${food.description} saved and added to ${destinationLabel}.`;
		await onCreate(food, {
			destination: saveDestination,
			addedToList: true,
			source: "manual-entry",
		});
		setOutcome(food, saveDestination, true, message);
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
			const addResult = await addFoodToSmoothieList(destination, lastOutcome.food);
			if (addResult === "error") {
				error = `Could not move ${lastOutcome.food.description}. Try again.`;
				return;
			}

			const removeResult = await removeFoodFromSmoothieList(
				lastOutcome.destination,
				lastOutcome.food.fdcId,
			);
			if (removeResult === "error") {
				error = `${lastOutcome.food.description} was added to ${getListDestinationLabel(destination)}, but the old copy could not be removed.`;
				return;
			}

			const message = `${lastOutcome.food.description} moved to ${getListDestinationLabel(destination)}.`;
			setOutcome(lastOutcome.food, destination, true, message);
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
			const removeResult = await removeFoodFromSmoothieList(
				lastOutcome.destination,
				lastOutcome.food.fdcId,
			);
			if (removeResult === "error") {
				error = `Could not undo adding ${lastOutcome.food.description}. Try again.`;
				return;
			}

			const message = `${lastOutcome.food.description} removed from ${getListDestinationLabel(lastOutcome.destination)}. The custom ingredient is still saved.`;
			setOutcome(lastOutcome.food, "custom-only", false, message);
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
				const nutrientSummary = optionalNutrientCount > 0
					? ` ${optionalNutrientCount} additional reported nutrients were included.`
					: " No additional vitamin or mineral values were reported by this source.";
				const volumeSummary = lookup.draft.volumeEquivalent
					? " The package's volume-to-weight serving was also included."
					: "";
				barcodeMessage = `Label data imported from ${lookup.draft.sourceLabel}.${nutrientSummary}${volumeSummary} Review it before saving.`;
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

		if (loadingNutrientRelationshipRules) {
			markValidationAttemptedThroughStep("share");
			error = "Nutrition validation rules are still loading. Try again in a moment.";
			activeStep = "macros";
			showStepWarning(error, "macros");
			return;
		}

		if (blockingValidation) {
			markAllValidationAttempted();
			error = blockingValidation.message;
			activeStep = blockingValidation.step;
			showStepWarning(blockingValidation.message, blockingValidation.step);
			return;
		}

		if (
			useVolumeEquivalent &&
			(volumeQuantity === null || volumeQuantity <= 0)
		) {
			markValidationAttemptedThroughStep("share");
			error = volumeAmountRequiredMessage;
			activeStep = "servings";
			showStepWarning(error, "servings");
			return;
		}

		const normalizedBarcode = barcode.trim() ? normalizeBarcode(barcode) : null;
		if (barcode.trim() && !normalizedBarcode) {
			markValidationAttemptedThroughStep("share");
			error = "Enter a valid 8, 12, 13, or 14 digit UPC/EAN barcode.";
			activeStep = "identity";
			showStepWarning(error, "identity");
			return;
		}
		if (normalizedBarcode) await checkManualBarcodeReference();

		if (
			requiresCatalogEvidence &&
			(!frontPhoto || !nutritionPhoto || !barcodePhoto)
		) {
			markAllValidationAttempted();
			error = "Add front package, nutrition label, and barcode photos before sharing this product.";
			activeStep = "share";
			showStepWarning(error, "share");
			return;
		}

		const saveNutrients = getSaveNutrients();
		const saveCategories = [
			activeCategory,
			...categories.filter((item) => item !== activeCategory),
		].filter(Boolean);
		const food = createCustomFood({
			name,
			brandOwner,
			servingLabel: resolvedServingLabel,
			servingWeightGrams: servingWeightGrams ?? 0,
			volumeQuantity: useVolumeEquivalent ? volumeQuantity ?? undefined : undefined,
			volumeUnit: useVolumeEquivalent ? volumeUnit : undefined,
			barcode: normalizedBarcode ?? undefined,
			barcodeSource: normalizedBarcode ? barcodeSource : undefined,
			ingredients,
			ingredientList,
			allergens,
			traces,
			dietaryTags,
			labels,
			categories: saveCategories,
			nutrients: saveNutrients,
			reportedNutrientIds: [
				...new Set([
					...reportedNutrientIds,
					...saveNutrients.map((nutrient) => nutrient.nutrientId),
				]),
			],
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
					onNameChange={(value) => (name = value)}
					onBrandChange={(value) => (brandOwner = value)}
					onCategoryChange={(value) => (category = value)}
					onBarcodeChange={setManualBarcode}
					onBarcodeBlur={checkManualBarcodeReference}
					onApplyBarcodeSuggestion={applyBarcodeReferenceSuggestion}
					onKeepManualBarcodeEntry={keepManualBarcodeEntry}
					onNameInput={(element) => (ingredientNameInput = element)}
					onNext={goNext}
				/>
			{:else if activeStep === "servings"}
				<ServingsStep
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
					onServingLabelChange={(value) => (servingLabel = value)}
					onServingWeightChange={(value) =>
						(servingWeightGrams = Number.isFinite(value) ? value : null)}
					onUseVolumeChange={(value) => (useVolumeEquivalent = value)}
					onVolumeQuantityChange={(value) => (volumeQuantity = value)}
					onVolumeUnitChange={(value) => (volumeUnit = value)}
					onBack={goBack}
					onNext={goNext}
				/>
			{:else if activeStep === "macros"}
				<NutrientStep
					groups={manualEntryNutrientGroups.macros}
					loading={loadingManualEntryNutrients}
					error={manualEntryNutrientError}
					helper="Enter values from the nutrition label for the serving above. The app stores normalized per-100g values. Fields marked * are required."
					hideUnavailableStatus={hideMacroUnavailableStatus}
					validationItems={getAttemptedValidationItems(
						customIngredientValidationItems.filter(
							(item) => item.step === "macros",
						),
					)}
					getValue={getManualNutrientValue}
					onValueChange={setManualNutrientValue}
					isRequired={isRequiredManualNutrient}
					onBack={goBack}
					onNext={goNext}
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
					onValueChange={setManualNutrientValue}
					isRequired={isRequiredManualNutrient}
					onBack={goBack}
					onNext={goNext}
				/>
			{:else}
				<ShareStep
					{normalizedName}
					{activeCategory}
					summaryNutrients={getSummaryItems()}
					optionalNutrientCount={getOptionalNutrientCount()}
					validationItems={getAttemptedValidationItems(customIngredientValidationItems)}
					{barcodeMessage}
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
					onSubmit={handleSubmit}
				/>
			{/if}
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

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.custom-ingredient {
		display: grid;
		gap: $app-vertical-stack-gap;
	}

	.custom-ingredient__options {
		display: grid;
		gap: $app-vertical-stack-gap;
	}

	:global(.custom-ingredient__step) {
		display: grid;
		gap: $app-vertical-stack-gap;
	}

	:global(.custom-ingredient__field),
	:global(.custom-ingredient__card),
	:global(.custom-ingredient__summary),
	:global(.custom-ingredient__share-toggle),
	:global(.custom-ingredient__evidence) {
		min-width: 0;
	}

	:global(.custom-ingredient__field) {
		display: grid;
		gap: $app-gap-sm;
		color: $ingredient-text-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
		text-transform: uppercase;
	}

	:global(.custom-ingredient__field span) {
		display: inline-flex;
		align-items: center;
		gap: $app-gap-xs;
		letter-spacing: 0.01em;
	}

	:global(.custom-ingredient__field em),
	:global(.custom-ingredient__card em) {
		color: $ingredient-accent-danger;
		font-style: normal;
	}

	:global(.custom-ingredient__field small) {
		padding: $ingredient-badge-padding-y $ingredient-badge-padding-x;
		color: $ingredient-text-muted;
		background: $ingredient-surface-control;
		border-radius: $ingredient-radius-pill;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-medium;
		text-transform: none;
	}

	:global(.custom-ingredient__field-info),
	:global(.custom-ingredient__field-status) {
		display: block;
		padding: $ingredient-status-padding-y $ingredient-status-padding-x;
		background: $ingredient-surface-soft;
		border-radius: $ingredient-radius-card;
		font-size: $app-font-size-sm;
		line-height: 1.35;
	}

	:global(.custom-ingredient__field input),
	:global(.custom-ingredient__field select),
	:global(.custom-ingredient__destination select) {
		width: 100%;
		min-width: 0;
		min-height: $ingredient-control-height;
		padding: 0 $ingredient-control-padding-x;
		color: $ingredient-text-primary;
		background: $ingredient-surface-soft;
		border: 0;
		border-radius: $ingredient-radius-pill;
		font: inherit;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-medium;
		text-transform: none;
	}

	:global(.custom-ingredient__field select),
	:global(.custom-ingredient__destination select) {
		appearance: none;
		padding-right: $ingredient-select-chevron-padding-right;
		background-color: $ingredient-surface-soft;
		background-image:
			linear-gradient(45deg, transparent 50%, $ingredient-text-muted 50%),
			linear-gradient(135deg, $ingredient-text-muted 50%, transparent 50%);
		background-position:
			calc(100% - $ingredient-select-chevron-position-left) 52%,
			calc(100% - $ingredient-select-chevron-position-right) 52%;
		background-repeat: no-repeat;
		background-size:
			$ingredient-select-chevron-size $ingredient-select-chevron-size,
			$ingredient-select-chevron-size $ingredient-select-chevron-size;
	}

	:global(.custom-ingredient__field input::placeholder) {
		color: $ingredient-text-muted;
	}

	:global(.custom-ingredient__field input[type="number"]) {
		appearance: textfield;
	}

	:global(.custom-ingredient__field input[type="number"]::-webkit-inner-spin-button),
	:global(.custom-ingredient__field input[type="number"]::-webkit-outer-spin-button) {
		margin: 0;
		appearance: none;
	}

	:global(.custom-ingredient__helper) {
		margin: 0;
		color: $ingredient-text-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-medium;
		line-height: 1.35;
	}

	:global(.custom-ingredient__switch),
	:global(.custom-ingredient__share-toggle) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $app-gap-md;
		padding: $ingredient-card-padding;
		background: $ingredient-surface-soft;
		border-radius: $ingredient-radius-card;
		text-transform: none;
	}

	:global(.custom-ingredient__switch span),
	:global(.custom-ingredient__share-toggle span) {
		display: grid;
		gap: $app-gap-xs;
	}

	:global(.custom-ingredient__switch strong),
	:global(.custom-ingredient__share-toggle strong) {
		color: $ingredient-text-primary;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-bold;
	}

	:global(.custom-ingredient__switch small),
	:global(.custom-ingredient__share-toggle small) {
		padding: 0;
		background: transparent;
		color: $ingredient-text-muted;
		line-height: 1.25;
	}

	:global(.custom-ingredient__share-toggle--disabled) {
		opacity: 0.78;
	}

	:global(.custom-ingredient__card),
	:global(.custom-ingredient__summary) {
		display: grid;
		gap: $app-gap-md;
		padding: $ingredient-card-padding;
		background: $ingredient-surface-soft;
		border-radius: $ingredient-radius-card;
	}

	:global(.custom-ingredient__card h3),
	:global(.custom-ingredient__summary strong) {
		margin: 0;
		color: $ingredient-text-primary;
		font-size: $app-font-size-lg;
		font-weight: $app-font-weight-bold;
	}

	:global(.custom-ingredient__inline-grid) {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $app-horizontal-control-gap;
	}

	:global(.custom-ingredient__optional-details) {
		display: grid;
		gap: $app-gap-md;
	}

	:global(.custom-ingredient__optional-details summary) {
		color: $ingredient-text-primary;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-bold;
		cursor: pointer;
	}

	:global(.custom-ingredient__add-serving) {
		min-height: $ingredient-control-height;
		color: $ingredient-accent-primary;
		background: transparent;
		border: 0.12rem dashed color-mix(in srgb, $ingredient-accent-primary 45%, white);
		border-radius: $ingredient-radius-card;
		font-family: $app-button-font-family;
		font-size: $app-font-size-lg;
		font-weight: $app-button-font-weight;
		cursor: pointer;
	}

	:global(.custom-ingredient__macro-row) {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: $app-gap-sm;
	}

	:global(.custom-ingredient__macro-row span) {
		display: grid;
		justify-items: center;
		gap: $app-gap-xs;
		padding: $app-gap-sm;
		background: $ingredient-surface-card;
		border-radius: $ingredient-radius-card;
	}

	:global(.custom-ingredient__macro-row strong) {
		font-size: $app-font-size-md;
		line-height: 1;
	}

	:global(.custom-ingredient__macro-row small) {
		color: $ingredient-text-muted;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-medium;
	}

	:global(.custom-ingredient__summary > div:first-child) {
		display: grid;
		gap: $app-gap-xs;
	}

	:global(.custom-ingredient__summary > div:first-child span) {
		width: fit-content;
		padding: $ingredient-badge-padding-y $ingredient-badge-padding-x;
		color: $ingredient-text-primary;
		background: $ingredient-surface-card;
		border-radius: $ingredient-radius-pill;
		font-size: $app-font-size-xs;
	}

	:global(.custom-ingredient__summary p) {
		margin: 0;
		color: $ingredient-text-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-medium;
	}

	:global(.custom-ingredient__destination) {
		text-transform: none;
	}

	:global(.custom-ingredient__evidence) {
		display: grid;
		gap: $app-vertical-stack-gap;
		padding: $ingredient-card-padding;
		background: $ingredient-surface-soft;
		border-radius: $ingredient-radius-card;
	}

	:global(.custom-ingredient__evidence p) {
		margin: $app-gap-xs 0 0;
		color: $ingredient-text-muted;
		font-size: $app-font-size-sm;
		line-height: 1.35;
	}

	:global(.custom-ingredient__error),
	:global(.custom-ingredient__success),
	:global(.custom-ingredient__catalog-message),
	:global(.custom-ingredient__status) {
		margin: 0;
		padding: $ingredient-status-padding-y $ingredient-status-padding-x;
		border-radius: $ingredient-radius-card;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
	}

	:global(.custom-ingredient__error) {
		color: $ingredient-status-error-text;
		background: $ingredient-status-error-bg;
	}

	:global(.custom-ingredient__success),
	:global(.custom-ingredient__catalog-message) {
		color: $ingredient-status-success-text;
		background: $ingredient-status-success-bg;
	}

	:global(.custom-ingredient__status) {
		color: $ingredient-text-muted;
		background: $ingredient-surface-soft;
	}

	:global(.custom-ingredient__actions) {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $app-horizontal-control-gap;
		margin-top: $app-gap-sm;
	}

	:global(.custom-ingredient__primary),
	:global(.custom-ingredient__secondary) {
		min-height: $ingredient-control-height;
		border-radius: $ingredient-radius-card;
		font-family: $app-button-font-family;
		font-size: $app-font-size-md;
		font-weight: $app-button-font-weight;
		cursor: pointer;
	}

	:global(.custom-ingredient__primary) {
		color: $ingredient-surface-card;
		background: $ingredient-accent-primary;
		border: 1px solid $ingredient-accent-primary;
	}

	:global(.custom-ingredient__secondary) {
		color: $ingredient-text-primary;
		background: $ingredient-surface-card;
		border: 1px solid $ingredient-border-subtle;
	}

	:global(.custom-ingredient__primary:disabled),
	:global(.custom-ingredient__secondary:disabled) {
		cursor: not-allowed;
		opacity: 0.6;
	}

	@media (max-width: $app-breakpoint-xs) {
		:global(.custom-ingredient__inline-grid),
		:global(.custom-ingredient__actions) {
			grid-template-columns: 1fr;
		}
	}
</style>
