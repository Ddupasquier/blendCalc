<script lang="ts">
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
	import type { FdcFood, FdcNutrient } from "$lib/utils/food/types";
	import BarcodeScanButton from "$lib/components/ingredients/BarcodeScanButton.svelte";
	import BarcodeScannerDialog from "$lib/components/ingredients/BarcodeScannerDialog.svelte";
	import { normalizeBarcode } from "$lib/utils/barcode/barcode";
	import { lookupBarcodeProduct } from "$lib/utils/barcode/productLookup";
	import type { BarcodeScanResult } from "$lib/utils/barcode/types";
	import { submitSharedProduct } from "$lib/utils/products/catalog";
	import { MIX_STORAGE_KEYS } from "../../../defaults/mixDefaults";

	let {
		onCreate,
		closeManualSignal = 0,
		scanSignal = 0,
		showScanButton = true,
		onLookupStateChange = () => {},
	}: {
		onCreate: (food: FdcFood) => void | Promise<void>;
		closeManualSignal?: number;
		scanSignal?: number;
		showScanButton?: boolean;
		onLookupStateChange?: (lookingUp: boolean) => void;
	} = $props();

	const volumeOptions = SERVING_MEASURE_OPTIONS.filter(
		(option) => option.dimension === "volume",
	);

	let name = $state("");
	let brandOwner = $state("");
	let servingLabel = $state("");
	let servingWeightGrams = $state(30);
	let volumeQuantity = $state<number | null>(null);
	let volumeUnit = $state<ServingMeasureUnit>("tbsp");
	let useVolumeEquivalent = $state(false);
	let additionalNutrients = $state<FdcNutrient[]>([]);
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
	let saveDestination = $state<SmoothieListKey | "custom-only">(
		MIX_STORAGE_KEYS.fridge,
	);
	let lastOutcome = $state<null | {
		food: FdcFood;
		destination: SmoothieListKey | "custom-only";
		addedToList: boolean;
		message: string;
	}>(null);
	let labelDetailsElement: HTMLDetailsElement;
	let manualBodyElement = $state<HTMLFieldSetElement | null>(null);
	let ingredientNameInput = $state<HTMLInputElement | null>(null);
	let saveDestinationSelect = $state<HTMLSelectElement | null>(null);
	let lastCloseManualSignal = $state<number | null>(null);
	let lastScanSignal = $state<number | null>(null);
	let hasValidBarcode = $derived(Boolean(normalizeBarcode(barcode)));
	let canShareWithCatalog = $derived(
		hasValidBarcode && barcodeSource !== "open-food-facts" && barcodeSource !== "community",
	);
	let requiresCatalogEvidence = $derived(
		shareWithCatalog && barcodeSource === "manual",
	);

	let nutrition = $state<CustomFoodNutritionInput>({
		calories: 0,
		fat: 0,
		carbs: 0,
		fiber: 0,
		sugar: 0,
		protein: 0,
	});

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

	const formatNutrientValue = (nutrient: FdcNutrient) => {
		const value = nutrient.value < 1
			? nutrient.value.toLocaleString(undefined, { maximumFractionDigits: 3 })
			: nutrient.value.toLocaleString(undefined, { maximumFractionDigits: 1 });
		const unit = nutrient.unitName.toUpperCase() === "UG"
			? "µg"
			: nutrient.unitName.toLowerCase();
		return `${value} ${unit}`;
	};

	const resetForm = () => {
		name = "";
		brandOwner = "";
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
		if (saveDestination === MIX_STORAGE_KEYS.fridge) return "On Hand";
		if (saveDestination === MIX_STORAGE_KEYS.shoppingList) return "Shopping List";
		return "Custom Ingredients";
	};

	const getListDestinationLabel = (destination: SmoothieListKey) => {
		return destination === MIX_STORAGE_KEYS.fridge ? "On Hand" : "Shopping List";
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
			return;
		}
		if (scanSignal === lastScanSignal) return;
		lastScanSignal = scanSignal;
		scannerOpen = true;
	});

	$effect(() => {
		onLookupStateChange(lookingUpBarcode);
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
		labelDetailsElement.open = true;
		let nextFocusTarget: "name" | "destination" = "name";

		try {
			const lookup = await lookupBarcodeProduct(result.value);
			if (lookup.status === "found") {
				nextFocusTarget = "destination";
				name = lookup.draft.name;
				brandOwner = lookup.draft.brandOwner;
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
				const nutrientSummary = additionalNutrients.length > 0
					? ` ${additionalNutrients.length} additional reported nutrients were included.`
					: " No additional vitamin or mineral values were reported by this source.";
				const volumeSummary = lookup.draft.volumeEquivalent
					? " The package's volume-to-weight serving was also included."
					: "";
				barcodeMessage = `Label data imported from ${lookup.draft.sourceLabel}.${nutrientSummary}${volumeSummary} Review it before saving.`;
				return;
			}

			barcodeSource = "manual";
			reportedNutrientIds = [];
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

		if (!name.trim()) {
			error = "Add a name for this ingredient.";
			return;
		}

		if (!Number.isFinite(servingWeightGrams) || servingWeightGrams <= 0) {
			error = "Serving weight must be greater than 0g.";
			return;
		}

		if (
			useVolumeEquivalent &&
			(volumeQuantity === null || volumeQuantity <= 0)
		) {
			error = "Volume amount must be greater than 0 when volume measurements are enabled.";
			return;
		}

		if (nutrition.fiber > nutrition.carbs) {
			error = "Dietary fiber cannot be greater than total carbohydrates.";
			return;
		}

		if (nutrition.sugar > nutrition.carbs) {
			error = "Total sugars cannot be greater than total carbohydrates.";
			return;
		}

		const normalizedBarcode = barcode.trim() ? normalizeBarcode(barcode) : null;
		if (barcode.trim() && !normalizedBarcode) {
			error = "Enter a valid 8, 12, 13, or 14 digit UPC/EAN barcode.";
			return;
		}

		if (
			requiresCatalogEvidence &&
			(!frontPhoto || !nutritionPhoto || !barcodePhoto)
		) {
			error = "Add front package, nutrition label, and barcode photos before sharing this product.";
			return;
		}

		const food = createCustomFood({
			name,
			brandOwner,
			servingLabel,
			servingWeightGrams,
			volumeQuantity: useVolumeEquivalent ? volumeQuantity ?? undefined : undefined,
			volumeUnit: useVolumeEquivalent ? volumeUnit : undefined,
			barcode: normalizedBarcode ?? undefined,
			barcodeSource: normalizedBarcode ? barcodeSource : undefined,
			nutrition,
			additionalNutrients,
			reportedNutrientIds,
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
			bind:this={labelDetailsElement}
		>
			<summary class="custom-ingredient__manual-toggle">
				<span>Add manually</span>
				<svg class="custom-ingredient__manual-chevron" viewBox="0 0 24 24" aria-hidden="true">
					<path d="m6 9 6 6 6-6" />
				</svg>
			</summary>

	<fieldset
		bind:this={manualBodyElement}
		class="custom-ingredient__body"
		disabled={saving || lookingUpBarcode}
		aria-busy={saving || lookingUpBarcode}
	>
		<div class="custom-ingredient__grid">
			<label class="custom-ingredient__wide">
				<span>Ingredient name</span>
				<input
					bind:this={ingredientNameInput}
					id="custom-ingredient-name"
					name="custom-ingredient-name"
					type="text"
					placeholder="Oreos, homemade smoothie base..."
					maxlength="120"
					required
					bind:value={name}
				/>
			</label>

			<label>
				<span>Brand (optional)</span>
				<input
					id="custom-ingredient-brand"
					name="custom-ingredient-brand"
					type="text"
					placeholder="Brand name"
					maxlength="120"
					bind:value={brandOwner}
				/>
			</label>

			<label>
				<span>UPC / EAN barcode (optional)</span>
				<input
					id="custom-ingredient-barcode"
					name="custom-ingredient-barcode"
					type="text"
					inputmode="numeric"
					placeholder="Scan or enter the digits"
					maxlength="18"
					bind:value={barcode}
				/>
			</label>

			<label>
				<span>Serving label</span>
				<input
					id="custom-ingredient-serving-label"
					name="custom-ingredient-serving-label"
					type="text"
					placeholder="3 cookies, 1 scoop..."
					maxlength="80"
					bind:value={servingLabel}
				/>
			</label>

			<label>
				<span>Serving weight</span>
				<div class="custom-ingredient__inline-input">
					<input
						id="custom-ingredient-serving-weight"
						name="custom-ingredient-serving-weight"
						type="number"
						min="0.1"
						step="any"
						bind:value={servingWeightGrams}
					/>
					<em>g</em>
				</div>
			</label>
		</div>

		{#if barcodeMessage}
			<p class="custom-ingredient__barcode-message" role="status">{barcodeMessage}</p>
		{/if}

		{#if canShareWithCatalog}
			<label class="custom-ingredient__share-toggle">
				<input
					id="custom-ingredient-share-product"
					name="custom-ingredient-share-product"
					type="checkbox"
					bind:checked={shareWithCatalog}
				/>
				<span>
					<strong>Help other users find this product</strong>
					<small>
						Submit the barcode and nutrition label for verification. Your account
						information is not added to the public product.
					</small>
				</span>
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
					<div class="custom-ingredient__grid">
						<label>
							<span>Front of package</span>
							<input
								id="custom-product-front-photo"
								name="custom-product-front-photo"
								type="file"
								accept="image/jpeg,image/png,image/webp"
								required
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
								required
								onchange={(event) => (nutritionPhoto = event.currentTarget.files?.[0] ?? null)}
							/>
						</label>
						<label class="custom-ingredient__wide">
							<span>Barcode</span>
							<input
								id="custom-product-barcode-photo"
								name="custom-product-barcode-photo"
								type="file"
								accept="image/jpeg,image/png,image/webp"
								required
								onchange={(event) => (barcodePhoto = event.currentTarget.files?.[0] ?? null)}
							/>
						</label>
					</div>
				</section>
			{/if}
		{:else if hasValidBarcode && barcodeSource === "open-food-facts"}
			<p class="custom-ingredient__barcode-message">
				This product was found through Open Food Facts. Saving it also makes it
				available in shared search for other users.
			</p>
		{/if}

		<section class="custom-ingredient__volume">
			<label class="custom-ingredient__volume-toggle">
				<input
					id="custom-ingredient-use-volume"
					name="custom-ingredient-use-volume"
					type="checkbox"
					bind:checked={useVolumeEquivalent}
				/>
				<span>
					<strong>Allow volume measurements</strong>
					<small>
						Turn this on only when you know how much a volume of this specific
						ingredient weighs—for example, 2 tbsp weighs 32g. This lets the app
						convert cups, tablespoons, teaspoons, milliliters, and fluid ounces
						without assuming every food has the same density.
					</small>
				</span>
			</label>
			{#if useVolumeEquivalent}
			<div class="custom-ingredient__grid custom-ingredient__volume-fields">
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
			<p class="custom-ingredient__volume-note">
				This records <strong>{volumeQuantity || "the entered volume"}</strong>
				as weighing <strong>{servingWeightGrams}g</strong>. Leave it off if the
				package does not provide both values.
			</p>
			{/if}
		</section>

		<section class="custom-ingredient__nutrition">
			<div>
				<strong>Nutrition facts per serving</strong>
				<p>
					Enter the numbers from the label for the serving above. The app
					converts them to per-100g data automatically.
				</p>
			</div>

			<div class="custom-ingredient__nutrition-grid">
				<label>
					<span>Calories</span>
					<input
						id="custom-ingredient-calories"
						name="custom-ingredient-calories"
						type="number"
						min="0"
						step="any"
						value={nutrition.calories}
						oninput={(event) =>
							setNutritionValue("calories", event.currentTarget.value)}
					/>
				</label>
				<label>
					<span>Total Fat (g)</span>
					<input
						id="custom-ingredient-fat"
						name="custom-ingredient-fat"
						type="number"
						min="0"
						step="any"
						value={nutrition.fat}
						oninput={(event) =>
							setNutritionValue("fat", event.currentTarget.value)}
					/>
				</label>
				<label>
					<span>Total Carb. (g)</span>
					<input
						id="custom-ingredient-carbs"
						name="custom-ingredient-carbs"
						type="number"
						min="0"
						step="any"
						value={nutrition.carbs}
						oninput={(event) =>
							setNutritionValue("carbs", event.currentTarget.value)}
					/>
				</label>
				<label>
					<span>Dietary Fiber (g)</span>
					<input
						id="custom-ingredient-fiber"
						name="custom-ingredient-fiber"
						type="number"
						min="0"
						step="any"
						value={nutrition.fiber}
						oninput={(event) =>
							setNutritionValue("fiber", event.currentTarget.value)}
					/>
				</label>
				<label>
					<span>Total Sugars (g)</span>
					<input
						id="custom-ingredient-sugar"
						name="custom-ingredient-sugar"
						type="number"
						min="0"
						step="any"
						value={nutrition.sugar}
						oninput={(event) =>
							setNutritionValue("sugar", event.currentTarget.value)}
					/>
				</label>
				<label>
					<span>Protein (g)</span>
					<input
						id="custom-ingredient-protein"
						name="custom-ingredient-protein"
						type="number"
						min="0"
						step="any"
						value={nutrition.protein}
						oninput={(event) =>
							setNutritionValue("protein", event.currentTarget.value)}
					/>
				</label>
			</div>
		</section>

		{#if additionalNutrients.length > 0}
			<details class="custom-ingredient__imported-nutrients">
				<summary>
					<span>Additional nutrients imported ({additionalNutrients.length})</span>
					<small>Vitamins, minerals, and other values reported by the source.</small>
				</summary>
				<ul>
					{#each additionalNutrients as nutrient (nutrient.nutrientId)}
						<li>
							<span>{nutrient.nutrientName}</span>
							<strong>{formatNutrientValue(nutrient)}</strong>
						</li>
					{/each}
				</ul>
				<p>
					Values are per serving. Nutrients not reported by the source are left
					missing rather than counted as zero.
				</p>
			</details>
		{/if}

		<label class="custom-ingredient__destination">
			<span>Add after saving</span>
			<select
				bind:this={saveDestinationSelect}
				id="custom-ingredient-save-destination"
				name="custom-ingredient-save-destination"
				bind:value={saveDestination}
			>
				<option value={MIX_STORAGE_KEYS.fridge}>On Hand</option>
				<option value={MIX_STORAGE_KEYS.shoppingList}>Shopping List</option>
				<option value="custom-only">Save only</option>
			</select>
			<small>
				Choose where this ingredient should go next so you do not have to scroll
				back through the nutrition panel.
			</small>
		</label>

		{#if error}
			<p class="custom-ingredient__error" role="alert">{error}</p>
		{/if}
		{#if lastOutcome}
			<section
				class="custom-ingredient__outcome"
				role="status"
				aria-live="polite"
			>
				<div>
					<strong>{lastOutcome.message}</strong>
					<small>
						{#if lastOutcome.addedToList && lastOutcome.destination !== "custom-only"}
							Next: use it in Mix, move it, or undo the list add.
						{:else}
							Next: preview the nutrition or open Mix when you are ready.
						{/if}
					</small>
				</div>
				<div class="custom-ingredient__outcome-actions">
					<a href="/mix">Open Mix</a>
					{#if lastOutcome.addedToList && lastOutcome.destination === MIX_STORAGE_KEYS.fridge}
						<button
							type="button"
							class="custom-ingredient__secondary-action"
							onclick={() => moveLastOutcome(MIX_STORAGE_KEYS.shoppingList)}
							disabled={outcomeAction !== null}
						>
							{outcomeAction === "move" ? "Moving…" : "Move to Shopping"}
						</button>
					{:else if lastOutcome.addedToList && lastOutcome.destination === MIX_STORAGE_KEYS.shoppingList}
						<button
							type="button"
							class="custom-ingredient__secondary-action"
							onclick={() => moveLastOutcome(MIX_STORAGE_KEYS.fridge)}
							disabled={outcomeAction !== null}
						>
							{outcomeAction === "move" ? "Moving…" : "Move to On Hand"}
						</button>
					{/if}
					{#if lastOutcome.addedToList}
						<button
							type="button"
							class="custom-ingredient__secondary-action"
							onclick={undoLastOutcomeAdd}
							disabled={outcomeAction !== null}
						>
							{outcomeAction === "undo" ? "Undoing…" : "Undo"}
						</button>
					{/if}
				</div>
			</section>
		{:else if savedMessage}
			<p class="custom-ingredient__success" role="status">{savedMessage}</p>
		{/if}
		{#if catalogMessage}
			<p class="custom-ingredient__catalog-message" role="status">{catalogMessage}</p>
		{/if}

		<button type="button" onclick={handleSubmit} disabled={saving}>
			{saving ? "Saving ingredient…" : `Save + add to ${getDestinationLabel()}`}
		</button>
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
		gap: $app-gap-xs;
	}

	.custom-ingredient__options {
		display: grid;
		gap: $app-gap-xs;
	}

	.custom-ingredient__scan-option {
		display: grid;
		justify-items: end;
		gap: $app-gap-xs;

		small {
			color: $app-muted;
			font-size: $app-font-size-xs;
			font-weight: $app-font-weight-medium;
		}
	}

	.custom-ingredient__manual {
		overflow: hidden;
		background: transparent;
		border: 0;
		border-top: $app-border;
		border-radius: 0;
	}

	.custom-ingredient__manual-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $app-gap-sm;
		padding: $app-gap-sm 0 0;
		color: $app-muted;
		cursor: pointer;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-bold;
		letter-spacing: 0.08em;
		list-style: none;
		text-transform: uppercase;

		&::-webkit-details-marker {
			display: none;
		}

		&:hover {
			color: $app-primary;
		}

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: $app-gap-xs;
		}
	}

	.custom-ingredient__manual-chevron {
		width: 0.9rem;
		height: 0.9rem;
		flex: 0 0 auto;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2.25;
		transition: transform 180ms ease;
	}

	.custom-ingredient__manual[open] .custom-ingredient__manual-chevron {
		transform: rotate(180deg);
	}

	.custom-ingredient__imported-nutrients summary {
		display: grid;
		gap: 0.1rem;
		color: $app-primary;
		cursor: pointer;
		font-weight: $app-font-weight-bold;
		list-style-position: inside;

		small {
			color: $app-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-medium;
		}
	}

	.custom-ingredient__body {
		display: grid;
		gap: $app-gap-md;
		margin: 0;
		padding: $app-gap-md 0 0;
		border: 0;
		border-top: 0;
		min-inline-size: 0;
	}

	.custom-ingredient__grid,
	.custom-ingredient__nutrition-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $app-gap-sm;
	}

	.custom-ingredient__wide {
		grid-column: 1 / -1;
	}

	label {
		display: grid;
		gap: 0.22rem;
		min-width: 0;
		color: $app-muted;
		font-size: 0.76rem;
		font-weight: 800;
	}

	input,
	select {
		width: 100%;
		min-width: 0;
		padding: 0.5rem 0.6rem;
		color: $app-primary;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-radius;
	}

	.custom-ingredient__inline-input {
		display: flex;
		align-items: center;
		gap: 0.35rem;

		em {
			color: $app-muted;
			font-style: normal;
			font-weight: 800;
		}
	}

	.custom-ingredient__volume,
	.custom-ingredient__nutrition,
	.custom-ingredient__evidence {
		display: grid;
		gap: $app-gap-sm;
		padding-top: $app-gap-sm;
		border-top: $app-border;

		strong {
			color: $app-primary;
			font-size: 0.86rem;
		}

		p {
			color: $app-muted;
			font-size: 0.8rem;
			line-height: 1.35;
		}
	}

	.custom-ingredient__evidence > div:first-child {
		display: grid;
		gap: $app-gap-xs;

		p {
			color: $app-muted;
			font-size: $app-font-size-sm;
			line-height: 1.4;
		}
	}

	.custom-ingredient__volume-toggle,
	.custom-ingredient__share-toggle {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: $app-gap-sm;
		color: $app-primary;

		input {
			width: 1.1rem;
			height: 1.1rem;
			margin-top: 0.1rem;
			accent-color: $app-highlight;
		}

		span {
			display: grid;
			gap: 0.2rem;
		}

		small {
			color: $app-muted;
			font-size: 0.8rem;
			font-weight: 600;
			line-height: 1.4;
		}
	}

	.custom-ingredient__volume-note {
		padding: $app-gap-sm;
		background: $app-section-bg;
		border-radius: $app-radius;
	}

	.custom-ingredient__imported-nutrients {
		padding: $app-gap-sm;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-radius;

		ul {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.35rem $app-gap-md;
			margin: $app-gap-sm 0;
			padding: 0;
			list-style: none;
		}

		li {
			display: flex;
			justify-content: space-between;
			gap: $app-gap-sm;
			min-width: 0;
			color: $app-muted;
			font-size: $app-font-size-sm;

			span {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			strong {
				flex: 0 0 auto;
				color: $app-primary;
				font-size: inherit;
			}
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-sm;
			line-height: 1.4;
		}
	}

	.custom-ingredient__destination {
		display: grid;
		gap: $app-gap-xs;
		padding: $app-gap-sm;
		color: $app-primary;
		background:
			linear-gradient(135deg, color-mix(in srgb, $app-highlight 12%, transparent), transparent 70%),
			$app-section-bg;
		border: $app-border;
		border-radius: $app-radius;

		span {
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-bold;
		}

		small {
			color: $app-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-medium;
			line-height: 1.4;
		}
	}

	.custom-ingredient__outcome {
		display: grid;
		gap: $app-gap-sm;
		padding: $app-gap-sm;
		color: $app-primary;
		background: $app-success-bg;
		border: $app-border;
		border-radius: $app-radius;

		div:first-child {
			display: grid;
			gap: 0.15rem;
		}

		strong {
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-bold;
			line-height: 1.35;
		}

		small {
			color: $app-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-medium;
			line-height: 1.4;
		}
	}

	.custom-ingredient__outcome-actions {
		display: flex;
		flex-wrap: wrap;
		gap: $app-gap-xs;

		a,
		button {
			width: fit-content;
			min-height: 2.15rem;
			padding: 0.42rem 0.7rem;
			border-radius: $app-radius-pill;
			font-family: $app-button-font-family;
			font-size: $app-font-size-sm;
			font-weight: $app-button-font-weight;
			line-height: $app-button-line-height;
			text-decoration: none;
		}

		a {
			color: $app-highlight-text;
			background: $app-highlight;
		}
	}

	.custom-ingredient__secondary-action {
		color: $app-primary;
		background: $app-accent;
	}

	.custom-ingredient__error,
	.custom-ingredient__success,
	.custom-ingredient__catalog-message,
	.custom-ingredient__barcode-message {
		font-size: 0.84rem;
		font-weight: 800;
	}

	.custom-ingredient__barcode-message {
		padding: $app-gap-sm;
		color: $app-primary;
		background: $app-accent;
		border-radius: $app-radius;
	}

	.custom-ingredient__error {
		color: $app-warning-strong;
	}

	.custom-ingredient__success {
		color: $app-primary;
	}

	.custom-ingredient__catalog-message {
		padding: $app-gap-sm;
		color: $app-primary;
		background: $app-success-bg;
		border-radius: $app-radius;
	}

	button {
		justify-self: end;
		width: fit-content;
		padding: 0.55rem 0.9rem;
		color: $app-btn-text;
		background: $app-btn-bg;
		border-radius: $app-radius-pill;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;

		&:hover {
			background: $app-btn-bg-hover;
		}
	}

	@media (max-width: $app-breakpoint-sm) {
		.custom-ingredient {
			padding: $app-gap-sm;
		}

		.custom-ingredient__scan-option {
			grid-template-columns: 1fr;
			gap: $app-gap-sm;
			padding: $app-gap-sm;
		}

		.custom-ingredient__grid,
		.custom-ingredient__nutrition-grid {
			grid-template-columns: 1fr;
		}

		.custom-ingredient__imported-nutrients ul {
			grid-template-columns: 1fr;
		}

		.custom-ingredient__outcome-actions {
			display: grid;
			grid-template-columns: 1fr;

			a,
			button {
				width: 100%;
				text-align: center;
			}
		}

		button {
			width: 100%;
		}
	}
</style>
