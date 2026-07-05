<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import ArrowLeft from "$lib/assets/icons/ArrowLeft.svelte";
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
	} from "$lib/utils/food/customFoods";
	import {
		addFoodToSmoothieList,
		removeFoodFromSmoothieList,
		type SmoothieListKey,
	} from "$lib/utils/storage/smoothieLists";
	import type { FdcFood, FdcNutrient } from "$lib/utils/food/types";
	import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton.svelte";
	import BarcodeScannerDialog from "$lib/components/ingredients/barcode/BarcodeScannerDialog.svelte";
	import WarningPopup from "$lib/components/common/feedback/WarningPopup.svelte";
	import type { CustomIngredientOutcomeState } from "$lib/components/ingredients/manual-entry/CustomIngredientOutcome.svelte";
	import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
	import ManualEntryToggle from "$lib/components/ingredients/manual-entry/ManualEntryToggle.svelte";
	import IdentityStep from "$lib/components/ingredients/manual-entry/steps/IdentityStep.svelte";
	import NutrientStep from "$lib/components/ingredients/manual-entry/steps/NutrientStep.svelte";
	import ServingsStep from "$lib/components/ingredients/manual-entry/steps/ServingsStep.svelte";
	import ShareStep from "$lib/components/ingredients/manual-entry/steps/ShareStep.svelte";
	import {
		readCustomFoodCategoryOptions,
		type CustomFoodCategoryOption,
	} from "$lib/utils/food/categoryOptions";
	import {
		readManualEntryNutrientGroups,
		type ManualEntryNutrientDefinition,
		type ManualEntryNutrientGroupsByStep,
	} from "$lib/utils/food/nutrientDefinitions";
	import {
		readNutrientRelationshipRules,
		validateNutrientRelationshipRules,
		type NutrientRelationshipRule,
	} from "$lib/utils/food/nutrientRelationshipRules";
	import ManualEntryStepTabs from "$lib/components/ingredients/manual-entry/ManualEntryStepTabs.svelte";
	import type { ManualEntryValidationItem } from "$lib/components/ingredients/manual-entry/ManualEntryValidationList.svelte";
	import { normalizeBarcode } from "$lib/utils/barcode/barcode";
	import {
		lookupBarcodeProduct,
		type BarcodeProductDraft,
	} from "$lib/utils/barcode/productLookup";
	import type { BarcodeScanResult } from "$lib/utils/barcode/types";
	import { submitSharedProduct } from "$lib/utils/products/catalog";
	import { getSupabaseBrowserClient } from "$lib/supabase/client";
	import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";

	type ManualEntryStepId = "identity" | "servings" | "macros" | "extended" | "share";
	type NutrientValueState = Record<number, number>;
	type StepValidationItem = ManualEntryValidationItem & {
		step: ManualEntryStepId;
	};
	type ManualEntrySummaryItem = {
		label: string;
		value: number;
		unitName: string;
	};

	const manualEntrySteps: { id: ManualEntryStepId; label: string }[] = [
		{ id: "identity", label: "Identity" },
		{ id: "servings", label: "Servings" },
		{ id: "macros", label: "Macros" },
		{ id: "extended", label: "Extended" },
		{ id: "share", label: "Share" },
	];

	const emptyManualEntryNutrientGroups: ManualEntryNutrientGroupsByStep = {
		macros: [],
		extended: [],
	};

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
	let servingWeightGrams = $state(30);
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
	let labelDetailsElement = $state<HTMLDetailsElement | null>(null);
	let manualBodyElement = $state<HTMLFieldSetElement | null>(null);
	let ingredientNameInput = $state<HTMLInputElement | null>(null);
	let saveDestinationSelect = $state<HTMLSelectElement | null>(null);
	let lastCloseManualSignal = $state<number | null>(null);
	let lastScanSignal = $state<number | null>(null);


	onMount(() => {
		let cancelled = false;

		const loadManualEntryNutrients = async () => {
			loadingManualEntryNutrients = true;
			manualEntryNutrientError = "";
			const groups = await readManualEntryNutrientGroups();

			if (cancelled) return;

			if (!groups) {
				manualEntryNutrientGroups = emptyManualEntryNutrientGroups;
				manualEntryNutrientError =
					"Nutrient fields could not be loaded. Try again in a moment.";
			} else {
				manualEntryNutrientGroups = groups;
			}

			loadingManualEntryNutrients = false;
		};

		const loadCategoryOptions = async () => {
			loadingCategoryOptions = true;
			categoryOptionsError = "";
			const options = await readCustomFoodCategoryOptions();

			if (cancelled) return;

			if (!options?.length) {
				categoryOptions = [];
				categoryOptionsError =
					"Food categories are not available yet. Run the category seed script after database migrations.";
			} else {
				categoryOptions = options;
			}

			loadingCategoryOptions = false;
		};

		const loadNutrientRelationshipRules = async () => {
			loadingNutrientRelationshipRules = true;
			nutrientRelationshipRuleError = "";
			const rules = await readNutrientRelationshipRules(getSupabaseBrowserClient());

			if (cancelled) return;

			if (!rules?.length) {
				nutrientRelationshipRules = [];
				nutrientRelationshipRuleError =
					"Nutrition validation rules could not be loaded. Try again in a moment.";
			} else {
				nutrientRelationshipRules = rules;
			}

			loadingNutrientRelationshipRules = false;
		};

		void loadManualEntryNutrients();
		void loadCategoryOptions();
		void loadNutrientRelationshipRules();

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
	const hasValidBarcode = $derived(Boolean(normalizeBarcode(barcode)));
	const canShareWithCatalog = $derived(
		hasValidBarcode && barcodeSource !== "open-food-facts" && barcodeSource !== "community",
	);
	const requiresCatalogEvidence = $derived(
		shareWithCatalog && barcodeSource === "manual",
	);
	const resolvedServingLabel = $derived(
		buildCustomServingLabel({
			servingLabel,
			servingWeightGrams,
			volumeQuantity: useVolumeEquivalent ? volumeQuantity ?? undefined : undefined,
			volumeUnit: useVolumeEquivalent ? volumeUnit : undefined,
		}),
	);
	const getNutrientValue = (nutrientId: number) =>
		manualNutrientValues[nutrientId] ?? 0;
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
			barcodeReferenceAcceptedBarcode = "";
			if (!lookingUpBarcode) barcodeMessage = "";
			return;
		}

		const normalizedBarcode = normalizeBarcode(trimmedBarcode);
		if (!normalizedBarcode) {
			barcodeReferenceDraft = null;
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
				const mismatchCopy = namesLookDifferent(normalizedName, lookup.draft.name)
					? ` Lookup found “${lookup.draft.name}”, so reviewers can compare it with your typed label if you share this product.`
					: " Reviewers can use this source reference if you share this product.";
				barcodeMessage = `Barcode matched ${lookup.draft.sourceLabel}.${mismatchCopy} Autofill is available, but optional.`;
				return;
			}

			barcodeReferenceDraft = null;
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
		if (
			!shareWithCatalog ||
			!normalizedBarcode ||
			!barcodeReferenceDraft ||
			barcodeReferenceDraft.barcode !== normalizedBarcode ||
			barcodeReferenceAcceptedBarcode === normalizedBarcode ||
			barcodeSource !== "manual"
		) {
			return [];
		}

		const sourceReference = barcodeReferenceDraft.sourceReference
			? ` Reference: ${barcodeReferenceDraft.sourceReference}.`
			: "";
		return [
			`User chose to share manually entered product data instead of autofilling from ${barcodeReferenceDraft.sourceLabel}. Source product: “${barcodeReferenceDraft.name}”.${sourceReference} Compare user-entered data against active source/API data before approval.`,
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
		const numericValue = Number(value);
		const nextValue = Number.isFinite(numericValue)
			? Math.max(0, numericValue)
			: 0;
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
				return !Number.isFinite(value) || value <= 0;
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
					}
				: null,
			manualEntryNutrientError
				? {
						message: manualEntryNutrientError,
						tone: "error",
						step: "macros",
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
			!Number.isFinite(servingWeightGrams) || servingWeightGrams <= 0
				? {
						message: "Serving weight is required",
						tone: "error",
						step: "servings",
					}
				: null,
			useVolumeEquivalent &&
			(volumeQuantity === null || !Number.isFinite(volumeQuantity) || volumeQuantity <= 0)
				? {
						message:
							"Volume amount is required when volume measurements are enabled",
						tone: "error",
						step: "servings",
					}
				: null,
			!activeCategory
				? {
						message: "Food categories are still loading. Try again in a moment.",
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
					}
				: null,
			nutrientRelationshipRuleError
				? {
						message: nutrientRelationshipRuleError,
						tone: "error",
						step: "macros",
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
				wasEdited || !existing || field.requiredForManualEntry || value > 0;

			if (!shouldPersistManualValue || !Number.isFinite(value)) continue;
			if (value <= 0 && !field.requiredForManualEntry) continue;

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
			value: getManualNutrientValue(field),
			unitName: field.unitName,
		}));

	const resetForm = () => {
		activeStep = "identity";
		clearStepWarning();
		name = "";
		brandOwner = "";
		category = "";
		servingLabel = "";
		servingWeightGrams = 30;
		volumeQuantity = null;
		volumeUnit = "tbsp";
		useVolumeEquivalent = false;
		manualNutrientValues = {};
		manualTouchedNutrientIds = {};
		importedNutrients = [];
		barcode = "";
		barcodeSource = "manual";
		barcodeMessage = "";
		checkingBarcodeReference = false;
		checkedBarcodeReferenceKey = "";
		barcodeReferenceDraft = null;
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
		const blockingStepValidation =
			getFirstBlockingValidationThroughStep(
				manualEntrySteps[activeStepIndex + 1]?.id ?? activeStep,
			);
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
			error = "Nutrition validation rules are still loading. Try again in a moment.";
			activeStep = "macros";
			return;
		}

		if (blockingValidation) {
			error = blockingValidation.message;
			activeStep = blockingValidation.step;
			return;
		}

		if (
			useVolumeEquivalent &&
			(volumeQuantity === null || volumeQuantity <= 0)
		) {
			error = "Volume amount must be greater than 0 when volume measurements are enabled.";
			activeStep = "servings";
			return;
		}

		const normalizedBarcode = barcode.trim() ? normalizeBarcode(barcode) : null;
		if (barcode.trim() && !normalizedBarcode) {
			error = "Enter a valid 8, 12, 13, or 14 digit UPC/EAN barcode.";
			activeStep = "identity";
			return;
		}
		if (normalizedBarcode) await checkManualBarcodeReference();

		if (
			requiresCatalogEvidence &&
			(!frontPhoto || !nutritionPhoto || !barcodePhoto)
		) {
			error = "Add front package, nutrition label, and barcode photos before sharing this product.";
			activeStep = "share";
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
			servingWeightGrams,
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
			<section
				class="custom-ingredient__scan-option"
				aria-label="Scan a package barcode"
			>
				<BarcodeScanButton
					scanning={lookingUpBarcode}
					disabled={saving || checkingBarcodeReference}
					onclick={() => (scannerOpen = true)}
				/>
				<small>Scan a barcode for fastest entry</small>
			</section>
		{/if}

		<details
			class="custom-ingredient__manual"
			class:custom-ingredient__manual--sheet={!inline}
			open={!inline}
			bind:this={labelDetailsElement}
		>
			<summary
				class="custom-ingredient__manual-toggle"
				class:custom-ingredient__manual-toggle--sheet-hidden={!inline}
				aria-hidden={!inline}
			>
				<ManualEntryToggle />
			</summary>

			<fieldset
				bind:this={manualBodyElement}
				class="custom-ingredient__body"
				disabled={saving || lookingUpBarcode}
				aria-busy={saving || lookingUpBarcode}
			>
				{#if inline}
					<header class="custom-ingredient__header">
						<button
							type="button"
							class="custom-ingredient__back"
							aria-label="Back"
							onclick={goBack}
						>
							<ArrowLeft size={20} strokeWidth={2.4} />
						</button>
						<h2>Enter Manually</h2>
					</header>
				{/if}

				<ManualEntryStepTabs
					steps={manualEntrySteps}
					{activeStep}
					onSelect={goToStep}
				/>

				<WarningPopup
					open={Boolean(stepWarningMessage && stepWarningStep === activeStep)}
					message={stepWarningMessage}
				/>

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
							(servingWeightGrams = Number.isFinite(value) ? value : 0)}
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
						validationItems={customIngredientValidationItems.filter(
							(item) => item.step === "macros",
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
						validationItems={customIngredientValidationItems}
						{barcodeMessage}
						{hasValidBarcode}
						{barcodeSource}
						{canShareWithCatalog}
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
			</fieldset>
		</details>
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

	.custom-ingredient__scan-option {
		display: grid;
		justify-items: end;
		gap: $app-gap-xs;

		small {
			color: $ingredient-text-muted;
			font-size: $app-font-size-xs;
			font-weight: $app-font-weight-medium;
		}
	}

	.custom-ingredient__manual {
		overflow: hidden;
		background: transparent;
		border: 0;
		border-radius: 0;
	}

	.custom-ingredient__manual--sheet {
		display: block;
		overflow: visible;
	}

	.custom-ingredient__manual-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: $ingredient-card-padding-compact $ingredient-card-padding;
		list-style: none;
		cursor: pointer;

		&::-webkit-details-marker {
			display: none;
		}
	}

	.custom-ingredient__manual-toggle--sheet-hidden {
		display: none;
	}

	.custom-ingredient__body {
		display: grid;
		gap: $app-vertical-stack-gap;
		min-width: 0;
		padding: 0;
		margin: 0;
		background: transparent;
		border: 0;
	}

	.custom-ingredient__header {
		display: flex;
		align-items: center;
		gap: $app-gap-sm;

		h2 {
			margin: 0;
			color: $ingredient-text-primary;
			font-family: $app-font-family-interface;
			font-size: 1.15rem;
			font-weight: $app-font-weight-bold;
		}
	}

	.custom-ingredient__back {
		display: inline-grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		color: $ingredient-text-primary;
		background: transparent;
		border: 0;
		border-radius: $ingredient-radius-pill;
		cursor: pointer;
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
		padding-right: 2.7rem;
		background-color: $ingredient-surface-soft;
		background-image:
			linear-gradient(45deg, transparent 50%, $ingredient-text-muted 50%),
			linear-gradient(135deg, $ingredient-text-muted 50%, transparent 50%);
		background-position:
			calc(100% - 1.35rem) 52%,
			calc(100% - 1.05rem) 52%;
		background-repeat: no-repeat;
		background-size:
			0.34rem 0.34rem,
			0.34rem 0.34rem;
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
