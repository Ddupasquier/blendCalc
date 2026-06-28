<script lang="ts">
	import { onMount } from "svelte";
	import {
		SERVING_MEASURE_OPTIONS,
		type ServingMeasureUnit,
	} from "../../../defaults/servingMeasureDefaults";
	import {
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
	import BarcodeScanButton from "$lib/components/ingredients/BarcodeScanButton.svelte";
	import BarcodeScannerDialog from "$lib/components/ingredients/BarcodeScannerDialog.svelte";
	import CustomIngredientOutcome, {
		type CustomIngredientOutcomeState,
	} from "$lib/components/ingredients/CustomIngredientOutcome.svelte";
	import ManualEntryToggle from "$lib/components/ingredients/ManualEntryToggle.svelte";
	import ManualEntryNutrientFields from "$lib/components/ingredients/manual-entry/ManualEntryNutrientFields.svelte";
	import {
		readCustomFoodCategoryOptions,
		type CustomFoodCategoryOption,
	} from "$lib/utils/food/categoryOptions";
	import {
		readManualEntryNutrientGroups,
		type ManualEntryNutrientDefinition,
		type ManualEntryNutrientGroupsByStep,
	} from "$lib/utils/food/nutrientDefinitions";
	import ManualEntryStepTabs from "$lib/components/ingredients/manual-entry/ManualEntryStepTabs.svelte";
	import ManualEntryValidationList, {
		type ManualEntryValidationItem,
	} from "$lib/components/ingredients/manual-entry/ManualEntryValidationList.svelte";
	import ToggleSwitch from "$lib/components/common/ToggleSwitch.svelte";
	import { normalizeBarcode } from "$lib/utils/barcode/barcode";
	import { lookupBarcodeProduct } from "$lib/utils/barcode/productLookup";
	import type { BarcodeScanResult } from "$lib/utils/barcode/types";
	import { submitSharedProduct } from "$lib/utils/products/catalog";
	import { MIX_STORAGE_KEYS } from "../../../defaults/mixDefaults";

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
	let error = $state("");
	let savedMessage = $state("");
	let saving = $state(false);
	let lookingUpBarcode = $state(false);
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

		void loadManualEntryNutrients();
		void loadCategoryOptions();

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
	const customIngredientValidationItems = $derived<StepValidationItem[]>(
		[
			normalizedName.length < 3
				? {
						message: "Name must be at least 3 characters",
						tone: "error",
						step: "identity",
					}
				: null,
			!servingLabel.trim() || !Number.isFinite(servingWeightGrams) || servingWeightGrams <= 0
				? {
						message: "At least one serving size is required",
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
			nutrition.fiber > nutrition.carbs
				? {
						message: "Dietary fiber cannot be greater than total carbohydrates",
						tone: "error",
						step: "macros",
					}
				: null,
			nutrition.sugar > nutrition.carbs
				? {
						message: "Total sugars cannot be greater than total carbohydrates",
						tone: "error",
						step: "macros",
					}
				: null,
		].filter(Boolean) as StepValidationItem[],
	);
	const blockingValidation = $derived(
		customIngredientValidationItems.find((item) => item.tone === "error") ?? null,
	);

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

	const goNext = () => {
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
		onLookupStateChange(lookingUpBarcode);
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
			servingLabel,
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
					disabled={saving}
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
				<header class="custom-ingredient__header">
					<button
						type="button"
						class="custom-ingredient__back"
						aria-label="Back"
						onclick={goBack}
					>
						←
					</button>
					<h2>Enter Manually</h2>
				</header>

				<ManualEntryStepTabs
					steps={manualEntrySteps}
					{activeStep}
					onSelect={goToStep}
				/>

				{#if activeStep === "identity"}
					<div class="custom-ingredient__step">
						<label>
							<span>Food name <em>*</em></span>
							<input
								bind:this={ingredientNameInput}
								id="custom-ingredient-name"
								name="custom-ingredient-name"
								type="text"
								placeholder="e.g. Almond Flour Protein Bar"
								maxlength="120"
								aria-required="true"
								bind:value={name}
							/>
						</label>

						<label>
							<span>Brand <small>optional</small></span>
							<input
								id="custom-ingredient-brand"
								name="custom-ingredient-brand"
								type="text"
								placeholder="e.g. KIND"
								maxlength="120"
								bind:value={brandOwner}
							/>
						</label>

						<label>
							<span>Category <em>*</em></span>
							<select
								id="custom-ingredient-category"
								name="custom-ingredient-category"
								bind:value={category}
								disabled={loadingCategoryOptions || visibleCategoryOptions.length === 0}
								aria-busy={loadingCategoryOptions}
							>
								{#if loadingCategoryOptions}
									<option value="">Loading categories…</option>
								{:else if visibleCategoryOptions.length === 0}
									<option value="">Categories unavailable</option>
								{:else}
									{#each visibleCategoryOptions as option}
										<option value={option}>{option}</option>
									{/each}
								{/if}
							</select>
							{#if categoryOptionsError}
								<small>{categoryOptionsError}</small>
							{/if}
						</label>

						<label>
							<span>UPC / Barcode <small>optional</small></span>
							<input
								id="custom-ingredient-barcode"
								name="custom-ingredient-barcode"
								type="text"
								inputmode="numeric"
								placeholder="12-digit number"
								maxlength="18"
								bind:value={barcode}
							/>
						</label>

						<label class="custom-ingredient__switch">
							<span>
								<strong>Liquid ingredient</strong>
								<small>Affects volume unit conversion warnings</small>
							</span>
							<ToggleSwitch
								id="custom-ingredient-use-volume"
								name="custom-ingredient-use-volume"
								ariaLabel="Allow volume measurements"
								bind:checked={useVolumeEquivalent}
							/>
						</label>

						<button type="button" class="custom-ingredient__primary" onclick={goNext}>
							Continue
						</button>
					</div>
				{:else if activeStep === "servings"}
					<div class="custom-ingredient__step">
						<p class="custom-ingredient__helper">
							All nutrition values are stored per 100g. Serving sizes let users see
							scaled values.
						</p>

						<section class="custom-ingredient__card" aria-label="Primary serving">
							<h3>Primary serving <em>*</em></h3>
							<label>
								<span>Description <em>*</em></span>
								<input
									id="custom-ingredient-serving-label"
									name="custom-ingredient-serving-label"
									type="text"
									placeholder="e.g. 1 cup, 1 bar, 2 tbsp"
									maxlength="80"
									bind:value={servingLabel}
								/>
							</label>
							<label>
								<span>Weight (g) <em>*</em></span>
								<input
									id="custom-ingredient-serving-weight"
									name="custom-ingredient-serving-weight"
									type="number"
									min="0.1"
									step="any"
									placeholder="e.g. 240"
									bind:value={servingWeightGrams}
								/>
							</label>

							{#if useVolumeEquivalent}
								<div class="custom-ingredient__inline-grid">
									<label>
										<span>Volume in this serving</span>
										<input
											id="custom-ingredient-volume-amount"
											name="custom-ingredient-volume-amount"
											type="number"
											min="0"
											step="any"
											placeholder="2"
											bind:value={volumeQuantity}
										/>
									</label>

									<label>
										<span>Volume unit</span>
										<select
											id="custom-ingredient-volume-unit"
											name="custom-ingredient-volume-unit"
											bind:value={volumeUnit}
										>
											{#each volumeOptions as option}
												<option value={option.value}>{option.label}</option>
											{/each}
										</select>
									</label>
								</div>
								<p class="custom-ingredient__helper">
									This records the entered volume as weighing
									<strong>{servingWeightGrams}g</strong>. Leave it off if the package
									does not provide both values.
								</p>
							{/if}
						</section>

						<button type="button" class="custom-ingredient__add-serving">
							+ Add another serving size
						</button>

						<div class="custom-ingredient__actions">
							<button type="button" class="custom-ingredient__secondary" onclick={goBack}>
								Back
							</button>
							<button type="button" class="custom-ingredient__primary" onclick={goNext}>
								Continue
							</button>
						</div>
					</div>
				{:else if activeStep === "macros"}
					<div class="custom-ingredient__step">
						<p class="custom-ingredient__helper">
							Enter values from the nutrition label for the serving above. The app
							stores normalized per-100g values. Fields marked <em>*</em> are required.
						</p>

						<ManualEntryNutrientFields
							groups={manualEntryNutrientGroups.macros}
							loading={loadingManualEntryNutrients}
							error={manualEntryNutrientError}
							getValue={getManualNutrientValue}
							onValueChange={setManualNutrientValue}
							isRequired={isRequiredManualNutrient}
						/>

						<div class="custom-ingredient__actions">
							<button type="button" class="custom-ingredient__secondary" onclick={goBack}>
								Back
							</button>
							<button type="button" class="custom-ingredient__primary" onclick={goNext}>
								Continue
							</button>
						</div>
					</div>
				{:else if activeStep === "extended"}
					<div class="custom-ingredient__step">
						<p class="custom-ingredient__helper">
							All fields on this step are optional. Fill what you know.
						</p>

						<ManualEntryNutrientFields
							groups={manualEntryNutrientGroups.extended}
							loading={loadingManualEntryNutrients}
							error={manualEntryNutrientError}
							accordion
							getValue={getManualNutrientValue}
							onValueChange={setManualNutrientValue}
							isRequired={isRequiredManualNutrient}
						/>

						<div class="custom-ingredient__actions">
							<button type="button" class="custom-ingredient__secondary" onclick={goBack}>
								Back
							</button>
							<button type="button" class="custom-ingredient__primary" onclick={goNext}>
								Continue
							</button>
						</div>
					</div>
				{:else}
					<div class="custom-ingredient__step">
						<section class="custom-ingredient__summary" aria-label="Ingredient summary">
							<div>
								<strong>{normalizedName || "Unnamed ingredient"}</strong>
								<span>{activeCategory}</span>
							</div>
							<div class="custom-ingredient__macro-row">
								<span><strong>{nutrition.calories.toFixed(1)}kcal</strong><small>Cal</small></span>
								<span><strong>{nutrition.protein.toFixed(1)}g</strong><small>Prot</small></span>
								<span><strong>{nutrition.fat.toFixed(1)}g</strong><small>Fat</small></span>
								<span><strong>{nutrition.carbs.toFixed(1)}g</strong><small>Carbs</small></span>
							</div>
							<p>{getSaveAdditionalNutrients().length} optional nutrients filled</p>
						</section>

						<ManualEntryValidationList items={customIngredientValidationItems} />

						{#if barcodeMessage}
							<p class="custom-ingredient__status" role="status">{barcodeMessage}</p>
						{/if}

						{#if hasValidBarcode && barcodeSource === "open-food-facts"}
							<p class="custom-ingredient__status">
								This product was found through Open Food Facts. Saving it also makes it
								available in shared search for other users.
							</p>
						{/if}

						<label
							class="custom-ingredient__share-toggle"
							class:custom-ingredient__share-toggle--disabled={!canShareWithCatalog}
						>
							<span>
								<strong>Share with community</strong>
								<small>
									{canShareWithCatalog
										? "Make this ingredient available to other users. All submissions are reviewed for accuracy."
										: "Add a valid UPC or barcode if you want to submit this ingredient for shared search."}
								</small>
							</span>
							<ToggleSwitch
								id="custom-ingredient-share-product"
								name="custom-ingredient-share-product"
								ariaLabel="Share with community"
								disabled={!canShareWithCatalog}
								bind:checked={shareWithCatalog}
							/>
						</label>
						{#if requiresCatalogEvidence}
							<section class="custom-ingredient__evidence" aria-labelledby="product-evidence-title">
								<div>
									<strong id="product-evidence-title">Photos for catalog review</strong>
									<p>
										These private photos let a moderator confirm the package, nutrition
										facts, and barcode before other users can find the product.
									</p>
								</div>
								<label>
									<span>Front of package</span>
									<input
										id="custom-product-front-photo"
										name="custom-product-front-photo"
										type="file"
										accept="image/jpeg,image/png,image/webp"
										aria-required="true"
										onchange={(event) => (frontPhoto = event.currentTarget.files?.[0] ?? null)}
									/>
								</label>
								<label>
									<span>Nutrition facts label</span>
									<input
										id="custom-product-nutrition-photo"
										name="custom-product-nutrition-photo"
										type="file"
										accept="image/jpeg,image/png,image/webp"
										aria-required="true"
										onchange={(event) => (nutritionPhoto = event.currentTarget.files?.[0] ?? null)}
									/>
								</label>
								<label>
									<span>Barcode</span>
									<input
										id="custom-product-barcode-photo"
										name="custom-product-barcode-photo"
										type="file"
										accept="image/jpeg,image/png,image/webp"
										aria-required="true"
										onchange={(event) => (barcodePhoto = event.currentTarget.files?.[0] ?? null)}
									/>
								</label>
							</section>
						{/if}

						<label class="custom-ingredient__destination">
							<span>Add after saving</span>
							<select
								bind:this={saveDestinationSelect}
								id="custom-ingredient-save-destination"
								name="custom-ingredient-save-destination"
								bind:value={saveDestination}
							>
								<option value={MIX_STORAGE_KEYS.fridge}>Fridge</option>
								<option value={MIX_STORAGE_KEYS.shoppingList}>Shopping List</option>
								<option value="custom-only">Save only</option>
							</select>
						</label>

						{#if error}
							<p class="custom-ingredient__error" role="alert">{error}</p>
						{/if}
						{#if lastOutcome}
							<CustomIngredientOutcome
								outcome={lastOutcome}
								action={outcomeAction}
								onMoveToShopping={() => moveLastOutcome(MIX_STORAGE_KEYS.shoppingList)}
								onMoveToFridge={() => moveLastOutcome(MIX_STORAGE_KEYS.fridge)}
								onUndo={undoLastOutcomeAdd}
							/>
						{:else if savedMessage}
							<p class="custom-ingredient__success" role="status">{savedMessage}</p>
						{/if}
						{#if catalogMessage}
							<p class="custom-ingredient__catalog-message" role="status">{catalogMessage}</p>
						{/if}

						<div class="custom-ingredient__actions">
							<button type="button" class="custom-ingredient__secondary" onclick={goBack}>
								Back
							</button>
							<button
								type="button"
								class="custom-ingredient__primary"
								onclick={handleSubmit}
								disabled={saving}
							>
								{saving ? "Saving…" : "Add Ingredient"}
							</button>
						</div>
					</div>
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
	@use "../../../styles/variables" as *;

	.custom-ingredient {
		display: grid;
		gap: $app-vertical-stack-gap;
	}

	.custom-ingredient__options,
	.custom-ingredient__step {
		display: grid;
		gap: $app-vertical-stack-gap;
	}

	.custom-ingredient__scan-option {
		display: grid;
		justify-items: end;
		gap: $app-gap-xs;

		small {
			color: $color-figma-muted;
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
		padding: $app-rebuild-card-padding-sm $app-rebuild-card-padding;
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
			color: $color-figma-ink;
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
		color: $color-figma-ink;
		background: transparent;
		border: 0;
		border-radius: $app-rebuild-radius-pill;
		font-size: 1.45rem;
		cursor: pointer;
	}

	label,
	.custom-ingredient__card,
	.custom-ingredient__summary,
	.custom-ingredient__share-toggle,
	.custom-ingredient__evidence {
		min-width: 0;
	}

	label {
		display: grid;
		gap: $app-gap-sm;
		color: $color-figma-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
		text-transform: uppercase;

		span {
			display: inline-flex;
			align-items: center;
			gap: $app-gap-xs;
			letter-spacing: 0.01em;
		}

		em {
			color: $color-figma-red;
			font-style: normal;
		}

		small {
			padding: $app-rebuild-badge-padding-y $app-rebuild-badge-padding-x;
			color: $color-figma-muted;
			background: $color-figma-control-surface;
			border-radius: $app-rebuild-radius-pill;
			font-size: $app-font-size-xs;
			font-weight: $app-font-weight-medium;
			text-transform: none;
		}
	}

	input,
	select {
		width: 100%;
		min-width: 0;
		min-height: $app-rebuild-control-height;
		padding: 0 $app-rebuild-control-padding-x;
		color: $color-figma-ink;
		background: $color-figma-soft-surface;
		border: 0;
		border-radius: $app-rebuild-radius-pill;
		font: inherit;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-medium;
		text-transform: none;
	}

	select {
		appearance: none;
		padding-right: 2.7rem;
		background-color: $color-figma-soft-surface;
		background-image:
			linear-gradient(45deg, transparent 50%, $color-figma-muted 50%),
			linear-gradient(135deg, $color-figma-muted 50%, transparent 50%);
		background-position:
			calc(100% - 1.35rem) 52%,
			calc(100% - 1.05rem) 52%;
		background-repeat: no-repeat;
		background-size:
			0.34rem 0.34rem,
			0.34rem 0.34rem;
	}

	input::placeholder {
		color: $color-figma-muted;
	}

	input[type="number"] {
		appearance: textfield;
	}

	input[type="number"]::-webkit-inner-spin-button,
	input[type="number"]::-webkit-outer-spin-button {
		margin: 0;
		appearance: none;
	}

	.custom-ingredient__helper {
		margin: 0;
		color: $color-figma-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-medium;
		line-height: 1.35;
	}

	.custom-ingredient__switch,
	.custom-ingredient__share-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $app-gap-md;
		padding: $app-rebuild-card-padding;
		background: $color-figma-soft-surface;
		border-radius: $app-rebuild-radius;
		text-transform: none;

		span {
			display: grid;
			gap: $app-gap-xs;
		}

		strong {
			color: $color-figma-ink;
			font-size: $app-font-size-md;
			font-weight: $app-font-weight-bold;
		}

		small {
			padding: 0;
			background: transparent;
			color: $color-figma-muted;
			line-height: 1.25;
		}
	}

	.custom-ingredient__share-toggle--disabled {
		opacity: 0.78;
	}

	.custom-ingredient__card,
	.custom-ingredient__summary {
		display: grid;
		gap: $app-gap-md;
		padding: $app-rebuild-card-padding;
		background: $color-figma-soft-surface;
		border-radius: $app-rebuild-radius;
	}

	.custom-ingredient__card h3,
	.custom-ingredient__summary strong {
		margin: 0;
		color: $color-figma-ink;
		font-size: $app-font-size-lg;
		font-weight: $app-font-weight-bold;
	}

	.custom-ingredient__card em {
		color: $color-figma-red;
		font-style: normal;
	}

	.custom-ingredient__inline-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $app-horizontal-control-gap;
	}

	.custom-ingredient__add-serving {
		min-height: $app-rebuild-control-height;
		color: $color-figma-green;
		background: transparent;
		border: 0.12rem dashed color-mix(in srgb, $color-figma-green 45%, white);
		border-radius: $app-rebuild-radius;
		font-family: $app-button-font-family;
		font-size: $app-font-size-lg;
		font-weight: $app-button-font-weight;
		cursor: pointer;
	}

	.custom-ingredient__macro-row {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: $app-gap-sm;

		span {
			display: grid;
			justify-items: center;
			gap: $app-gap-xs;
			padding: $app-gap-sm;
			background: $color-figma-card;
			border-radius: $app-rebuild-radius;
		}

		strong {
			font-size: $app-font-size-md;
			line-height: 1;
		}

		small {
			color: $color-figma-muted;
			font-size: $app-font-size-xs;
			font-weight: $app-font-weight-medium;
		}
	}

	.custom-ingredient__summary > div:first-child {
		display: grid;
		gap: $app-gap-xs;

		span {
			width: fit-content;
			padding: $app-rebuild-badge-padding-y $app-rebuild-badge-padding-x;
			color: $color-figma-ink;
			background: $color-figma-card;
			border-radius: $app-rebuild-radius-pill;
			font-size: $app-font-size-xs;
		}
	}

	.custom-ingredient__summary p {
		margin: 0;
		color: $color-figma-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-medium;
	}

	.custom-ingredient__destination {
		text-transform: none;
	}

	.custom-ingredient__evidence {
		display: grid;
		gap: $app-vertical-stack-gap;
		padding: $app-rebuild-card-padding;
		background: $color-figma-soft-surface;
		border-radius: $app-rebuild-radius;

		p {
			margin: $app-gap-xs 0 0;
			color: $color-figma-muted;
			font-size: $app-font-size-sm;
			line-height: 1.35;
		}
	}

	.custom-ingredient__error,
	.custom-ingredient__success,
	.custom-ingredient__catalog-message,
	.custom-ingredient__status {
		margin: 0;
		padding: $app-rebuild-status-padding-y $app-rebuild-status-padding-x;
		border-radius: $app-rebuild-radius;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
	}

	.custom-ingredient__error {
		color: $color-cinnamon-clay;
		background: color-mix(in srgb, $color-strawberry-cream 60%, white);
	}

	.custom-ingredient__success,
	.custom-ingredient__catalog-message {
		color: $color-dark-taupe;
		background: $color-pistachio-cream;
	}

	.custom-ingredient__status {
		color: $color-figma-muted;
		background: $color-figma-soft-surface;
	}

	.custom-ingredient__actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $app-horizontal-control-gap;
		margin-top: $app-gap-sm;
	}

	.custom-ingredient__primary,
	.custom-ingredient__secondary {
		min-height: $app-rebuild-control-height;
		border-radius: $app-rebuild-radius;
		font-family: $app-button-font-family;
		font-size: $app-font-size-md;
		font-weight: $app-button-font-weight;
		cursor: pointer;
	}

	.custom-ingredient__primary {
		color: $color-figma-card;
		background: $color-figma-green;
		border: 1px solid $color-figma-green;
	}

	.custom-ingredient__secondary {
		color: $color-figma-ink;
		background: $color-figma-card;
		border: 1px solid $color-figma-border;
	}

	.custom-ingredient__primary:disabled,
	.custom-ingredient__secondary:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	@media (max-width: $app-breakpoint-xs) {
		.custom-ingredient__inline-grid,
		.custom-ingredient__actions {
			grid-template-columns: 1fr;
		}
	}
</style>
