<script lang="ts">
	import { onMount } from "svelte";
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
		type CustomFoodNutritionInput,
	} from "$lib/utils/food/customFoods";
	import {
		addFoodToSmoothieList,
		removeFoodFromSmoothieList,
		type SmoothieListKey,
	} from "$lib/utils/storage/smoothieLists";
	import { NUTRIENT_IDS, type FdcFood, type FdcNutrient } from "$lib/utils/food/types";
	import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton.svelte";
	import BarcodeScannerDialog from "$lib/components/ingredients/barcode/BarcodeScannerDialog.svelte";
	import type { CustomIngredientOutcomeState } from "$lib/components/ingredients/manual-entry/CustomIngredientOutcome.svelte";
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
	import { lookupBarcodeProduct } from "$lib/utils/barcode/productLookup";
	import type { BarcodeScanResult } from "$lib/utils/barcode/types";
	import { submitSharedProduct } from "$lib/utils/products/catalog";
	import { getSupabaseBrowserClient } from "$lib/supabase/client";
	import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";

	type ManualEntryStepId = "identity" | "servings" | "macros" | "extended" | "share";
	type CoreNutritionKey = keyof CustomFoodNutritionInput;
	type StepValidationItem = ManualEntryValidationItem & {
		step: ManualEntryStepId;
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
	const coreNutritionKeysByNutrientId: Partial<Record<number, CoreNutritionKey>> = {
		[NUTRIENT_IDS.CALORIES]: "calories",
		[NUTRIENT_IDS.FAT]: "fat",
		[NUTRIENT_IDS.CARBS]: "carbs",
		[NUTRIENT_IDS.FIBER]: "fiber",
		[NUTRIENT_IDS.SUGAR]: "sugar",
		[NUTRIENT_IDS.PROTEIN]: "protein",
	};
	const coreNutritionEntries = Object.entries(coreNutritionKeysByNutrientId).map(
		([nutrientId, key]) => [Number(nutrientId), key] as [number, CoreNutritionKey],
	);
	const requiredManualNutrientIds = new Set<number>([
		NUTRIENT_IDS.CALORIES,
		NUTRIENT_IDS.FAT,
		NUTRIENT_IDS.CARBS,
		NUTRIENT_IDS.PROTEIN,
	]);

	let {
		onCreate,
		onClose,
		closeManualSignal = 0,
		scanSignal = 0,
		showScanButton = true,
		inline = true,
		onLookupStateChange = () => {},
	}: {
		onCreate: (food: FdcFood) => void | Promise<void>;
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
	let additionalNutrients = $state<FdcNutrient[]>([]);
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
	let labelDetailsElement = $state<HTMLDetailsElement | null>(null);
	let manualBodyElement = $state<HTMLFieldSetElement | null>(null);
	let ingredientNameInput = $state<HTMLInputElement | null>(null);
	let saveDestinationSelect = $state<HTMLSelectElement | null>(null);
	let lastCloseManualSignal = $state<number | null>(null);
	let lastScanSignal = $state<number | null>(null);

	let nutrition = $state<CustomFoodNutritionInput>({
		calories: 0,
		fat: 0,
		carbs: 0,
		fiber: 0,
		sugar: 0,
		protein: 0,
	});

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
				if (!category) category = options[0].label;
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
	const defaultCategory = $derived(categoryOptions[0]?.label ?? "");
	const activeCategory = $derived(category || categories[0] || defaultCategory);
	const normalizedName = $derived(name.trim());
	const hasValidBarcode = $derived(Boolean(normalizeBarcode(barcode)));
	const canShareWithCatalog = $derived(
		hasValidBarcode && barcodeSource !== "open-food-facts" && barcodeSource !== "community",
	);
	const requiresCatalogEvidence = $derived(
		shareWithCatalog && barcodeSource === "manual",
	);
	const hasMacro = $derived(
		nutrition.protein > 0 || nutrition.fat > 0 || nutrition.carbs > 0,
	);
	const resolvedServingLabel = $derived(
		buildCustomServingLabel({
			servingLabel,
			servingWeightGrams,
			volumeQuantity: useVolumeEquivalent ? volumeQuantity ?? undefined : undefined,
			volumeUnit: useVolumeEquivalent ? volumeUnit : undefined,
		}),
	);
	const getManualNutrientValuesById = () => {
		const values = new Map<number, number>();
		for (const [nutrientId, key] of coreNutritionEntries) {
			values.set(nutrientId, nutrition[key]);
		}
		for (const nutrient of additionalNutrients) {
			values.set(nutrient.nutrientId, nutrient.value);
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
			nutrition.calories <= 0
				? {
						message: "Calories are required",
						tone: "warning",
						step: "macros",
					}
				: null,
			!hasMacro
				? {
						message: "At least one macro (protein, fat, or carbs) is required",
						tone: "error",
						step: "macros",
					}
				: null,
			!activeCategory
				? {
						message: "Food categories are still loading. Try again in a moment.",
						tone: "error",
						step: "identity",
					}
				: null,
			nutrientRelationshipRuleError
				? {
						message: nutrientRelationshipRuleError,
						tone: "error",
						step: "macros",
					}
				: null,
			...nutrientRelationshipValidationItems,
		].filter(Boolean) as StepValidationItem[],
	);
	const blockingValidation = $derived(
		customIngredientValidationItems.find((item) => item.tone === "error") ?? null,
	);

	const getBarcodeReferenceKey = (normalizedBarcode: string) =>
		`${normalizedBarcode}:${normalizedName.toLocaleLowerCase()}`;

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

	const setManualBarcode = (value: string) => {
		barcode = value;
		barcodeSource = "manual";
		checkedBarcodeReferenceKey = "";
		if (!lookingUpBarcode) barcodeMessage = "";
	};

	const checkManualBarcodeReference = async () => {
		const trimmedBarcode = barcode.trim();
		if (!trimmedBarcode) {
			checkedBarcodeReferenceKey = "";
			if (!lookingUpBarcode) barcodeMessage = "";
			return;
		}

		const normalizedBarcode = normalizeBarcode(trimmedBarcode);
		if (!normalizedBarcode) return;

		const referenceKey = getBarcodeReferenceKey(normalizedBarcode);
		if (checkedBarcodeReferenceKey === referenceKey || checkingBarcodeReference) return;

		checkingBarcodeReference = true;
		barcodeMessage = "Checking barcode against available product sources…";
		try {
			const lookup = await lookupBarcodeProduct(normalizedBarcode);
			checkedBarcodeReferenceKey = referenceKey;
			barcodeSource = "manual";

			if (lookup.status === "found") {
				const mismatchCopy = namesLookDifferent(normalizedName, lookup.draft.name)
					? ` Lookup found “${lookup.draft.name}”, so reviewers can compare it with your typed label if you share this product.`
					: " Reviewers can use this source reference if you share this product.";
				barcodeMessage = `Barcode matched ${lookup.draft.sourceLabel}.${mismatchCopy}`;
				return;
			}

			barcodeMessage =
				lookup.status === "not-found"
					? "No source match found for this barcode yet. You can still save it; shared submissions will rely on label photos."
					: lookup.message;
		} finally {
			checkingBarcodeReference = false;
		}
	};

	const setNutritionValue = (
		key: keyof CustomFoodNutritionInput,
		value: string,
	) => {
		const numericValue = Number(value);
		nutrition = {
			...nutrition,
			[key]: Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0,
		};
	};

	const getAdditionalNutrientValue = (nutrientId: number) => {
		return (
			additionalNutrients.find((nutrient) => nutrient.nutrientId === nutrientId)
				?.value ?? 0
		);
	};

	const setAdditionalNutrientValue = (
		field: ManualEntryNutrientDefinition,
		value: string,
	) => {
		const numericValue = Number(value);
		const nextValue = Number.isFinite(numericValue)
			? Math.max(0, numericValue)
			: 0;
		const withoutCurrent = additionalNutrients.filter(
			(nutrient) => nutrient.nutrientId !== field.nutrientId,
		);

		if (nextValue <= 0) {
			additionalNutrients = withoutCurrent;
			return;
		}

		additionalNutrients = [
			...withoutCurrent,
			{
				nutrientId: field.nutrientId,
				nutrientName: field.nutrientName,
				nutrientNumber: field.nutrientNumber,
				unitName: field.unitName,
				value: nextValue,
				valueOrigin: "reported",
				source: "user-label",
				confidence: "user-reported",
			},
		];
	};

	const getCoreNutritionKey = (nutrientId: number) =>
		coreNutritionKeysByNutrientId[nutrientId] ?? null;

	const getManualNutrientValue = (field: ManualEntryNutrientDefinition) => {
		const coreKey = getCoreNutritionKey(field.nutrientId);
		return coreKey ? nutrition[coreKey] : getAdditionalNutrientValue(field.nutrientId);
	};

	const setManualNutrientValue = (
		field: ManualEntryNutrientDefinition,
		value: string,
	) => {
		const coreKey = getCoreNutritionKey(field.nutrientId);
		if (coreKey) {
			setNutritionValue(coreKey, value);
			return;
		}

		setAdditionalNutrientValue(field, value);
	};

	const isRequiredManualNutrient = (field: ManualEntryNutrientDefinition) =>
		requiredManualNutrientIds.has(field.nutrientId);

	const getSaveAdditionalNutrients = () => additionalNutrients;

	const resetForm = () => {
		activeStep = "identity";
		name = "";
		brandOwner = "";
		category = defaultCategory;
		servingLabel = "";
		servingWeightGrams = 30;
		volumeQuantity = null;
		volumeUnit = "tbsp";
		useVolumeEquivalent = false;
			additionalNutrients = [];
			barcode = "";
			barcodeSource = "manual";
			barcodeMessage = "";
			checkingBarcodeReference = false;
			checkedBarcodeReferenceKey = "";
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
		nutrition = {
			calories: 0,
			fat: 0,
			carbs: 0,
			fiber: 0,
			sugar: 0,
			protein: 0,
		};
	};

	const getDestinationLabel = () => {
		if (saveDestination === MIX_STORAGE_KEYS.fridge) return "Fridge";
		if (saveDestination === MIX_STORAGE_KEYS.shoppingList) return "Shopping List";
		return "Custom Ingredients";
	};

	const getListDestinationLabel = (destination: SmoothieListKey) => {
		return destination === MIX_STORAGE_KEYS.fridge ? "Fridge" : "Shopping List";
	};

	const goToStep = (step: string) => {
		activeStep = step as ManualEntryStepId;
	};

	const goNext = async () => {
		if (activeStep === "identity") await checkManualBarcodeReference();
		const nextStep = manualEntrySteps[activeStepIndex + 1];
		if (nextStep) activeStep = nextStep.id;
	};

	const goBack = () => {
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
			await onCreate(food);
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
		await onCreate(food);
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
		activeStep = "share";
		if (labelDetailsElement) labelDetailsElement.open = true;
		let nextFocusTarget: "name" | "destination" = "name";

		try {
			const lookup = await lookupBarcodeProduct(result.value);
			if (lookup.status === "found") {
				nextFocusTarget = "destination";
				name = lookup.draft.name;
				brandOwner = lookup.draft.brandOwner;
				category = lookup.draft.categories?.[0] ?? defaultCategory;
				servingLabel = lookup.draft.servingLabel;
				servingWeightGrams = lookup.draft.servingWeightGrams;
				nutrition = { ...lookup.draft.nutrition };
				additionalNutrients = [...lookup.draft.additionalNutrients];
				useVolumeEquivalent = Boolean(lookup.draft.volumeEquivalent);
				volumeQuantity = lookup.draft.volumeEquivalent?.quantity ?? null;
				volumeUnit = lookup.draft.volumeEquivalent?.unit ?? "tbsp";
				barcode = lookup.draft.barcode;
				barcodeSource = lookup.draft.source === "shared-catalog"
					? "community"
					: lookup.draft.source;
				reportedNutrientIds = [...lookup.draft.reportedNutrientIds];
				ingredients = lookup.draft.ingredients ?? "";
				ingredientList = [...(lookup.draft.ingredientList ?? [])];
				allergens = [...(lookup.draft.allergens ?? [])];
				traces = [...(lookup.draft.traces ?? [])];
				dietaryTags = [...(lookup.draft.dietaryTags ?? [])];
				labels = [...(lookup.draft.labels ?? [])];
				categories = [...(lookup.draft.categories ?? [])];
				const nutrientSummary = additionalNutrients.length > 0
					? ` ${additionalNutrients.length} additional reported nutrients were included.`
					: " No additional vitamin or mineral values were reported by this source.";
				const volumeSummary = lookup.draft.volumeEquivalent
					? " The package's volume-to-weight serving was also included."
					: "";
				barcodeMessage = `Label data imported from ${lookup.draft.sourceLabel}.${nutrientSummary}${volumeSummary} Review it before saving.`;
				return;
			}

			activeStep = "identity";
			barcodeSource = "manual";
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

		if (nutrition.calories <= 0) {
			error = "Calories are required.";
			activeStep = "macros";
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

		const saveAdditionalNutrients = getSaveAdditionalNutrients();
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
			nutrition,
			additionalNutrients: saveAdditionalNutrients,
			reportedNutrientIds: [
				...new Set([
					...reportedNutrientIds,
					...saveAdditionalNutrients.map((nutrient) => nutrient.nutrientId),
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
					const submission = await submitSharedProduct(food, {
						frontPhoto,
						nutritionPhoto,
						barcodePhoto,
					});
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

				{#if activeStep === "identity"}
					<IdentityStep
						{name}
						{brandOwner}
						{category}
						{barcode}
						{visibleCategoryOptions}
						{loadingCategoryOptions}
						{categoryOptionsError}
						{barcodeMessage}
						{checkingBarcodeReference}
						onNameChange={(value) => (name = value)}
						onBrandChange={(value) => (brandOwner = value)}
						onCategoryChange={(value) => (category = value)}
						onBarcodeChange={setManualBarcode}
						onBarcodeBlur={checkManualBarcodeReference}
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
						{nutrition}
						optionalNutrientCount={getSaveAdditionalNutrients().length}
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
