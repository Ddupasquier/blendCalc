<script lang="ts">
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch.svelte";
	import CustomIngredientOutcome, {
		type CustomIngredientOutcomeState,
	} from "$lib/components/ingredients/manual-entry/CustomIngredientOutcome.svelte";
	import ManualEntryValidationList, {
		type ManualEntryValidationItem,
	} from "$lib/components/ingredients/manual-entry/ManualEntryValidationList.svelte";
	import type { FdcFood } from "$lib/utils/food/types";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
	import { MIX_STORAGE_KEYS } from "../../../../../defaults/mixDefaults";

	type SummaryNutrient = {
		label: string;
		value: number;
		unitName: string;
	};

	let {
		normalizedName,
		activeCategory,
		summaryNutrients,
		optionalNutrientCount,
		validationItems,
		barcodeMessage,
		hasValidBarcode,
		barcodeSource,
		canShareWithCatalog,
		shareWithCatalog,
		requiresCatalogEvidence,
		saveDestination,
		error,
		lastOutcome,
		outcomeAction,
		savedMessage,
		catalogMessage,
		saving,
		onShareChange,
		onFrontPhotoChange,
		onNutritionPhotoChange,
		onBarcodePhotoChange,
		onSaveDestinationChange,
		onMoveToShopping,
		onMoveToFridge,
		onUndo,
		onBack,
		onSubmit,
		onSaveDestinationInput,
	}: {
		normalizedName: string;
		activeCategory: string;
		summaryNutrients: SummaryNutrient[];
		optionalNutrientCount: number;
		validationItems: ManualEntryValidationItem[];
		barcodeMessage: string;
		hasValidBarcode: boolean;
		barcodeSource: FdcFood["barcodeSource"];
		canShareWithCatalog: boolean;
		shareWithCatalog: boolean;
		requiresCatalogEvidence: boolean;
		saveDestination: SmoothieListKey | "custom-only";
		error: string;
		lastOutcome: CustomIngredientOutcomeState | null;
		outcomeAction: "move" | "undo" | null;
		savedMessage: string;
		catalogMessage: string;
		saving: boolean;
		onShareChange: (checked: boolean) => void;
		onFrontPhotoChange: (file: File | null) => void;
		onNutritionPhotoChange: (file: File | null) => void;
		onBarcodePhotoChange: (file: File | null) => void;
		onSaveDestinationChange: (destination: SmoothieListKey | "custom-only") => void;
		onMoveToShopping: () => void | Promise<void>;
		onMoveToFridge: () => void | Promise<void>;
		onUndo: () => void | Promise<void>;
		onBack: () => void;
		onSubmit: () => void | Promise<void>;
		onSaveDestinationInput?: (element: HTMLSelectElement) => void;
	} = $props();

	let saveDestinationSelect = $state<HTMLSelectElement | null>(null);

	$effect(() => {
		if (saveDestinationSelect) onSaveDestinationInput?.(saveDestinationSelect);
	});

	const formatUnit = (unitName: string) =>
		unitName.trim().toLowerCase() === "kcal" ? "kcal" : unitName.trim().toLowerCase();
</script>

<div class="custom-ingredient__step">
	<section class="custom-ingredient__summary" aria-label="Ingredient summary">
		<div>
			<strong>{normalizedName || "Unnamed ingredient"}</strong>
			<span>{activeCategory}</span>
		</div>
		<div class="custom-ingredient__macro-row">
			{#each summaryNutrients as nutrient}
				<span>
					<strong>{nutrient.value.toFixed(1)}{formatUnit(nutrient.unitName)}</strong>
					<small>{nutrient.label}</small>
				</span>
			{/each}
		</div>
		<p>{optionalNutrientCount} optional nutrients filled</p>
	</section>

	<ManualEntryValidationList items={validationItems} />

	{#if barcodeMessage}
		<p class="custom-ingredient__status" role="status">{barcodeMessage}</p>
	{/if}

	{#if hasValidBarcode && barcodeSource === "open-food-facts"}
		<p class="custom-ingredient__status">
			This product was found through Open Food Facts. Saving it also makes it available
			in shared search for other users.
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
			checked={shareWithCatalog}
			onChange={onShareChange}
		/>
	</label>

	{#if requiresCatalogEvidence}
		<section class="custom-ingredient__evidence" aria-labelledby="product-evidence-title">
			<div>
				<strong id="product-evidence-title">Photos for catalog review</strong>
				<p>
					These private photos let a moderator confirm the package, nutrition facts,
					and barcode before other users can find the product.
				</p>
			</div>
			<label class="custom-ingredient__field">
				<span>Front of package</span>
				<input
					id="custom-product-front-photo"
					name="custom-product-front-photo"
					type="file"
					accept="image/jpeg,image/png,image/webp"
					aria-required="true"
					onchange={(event) => onFrontPhotoChange(event.currentTarget.files?.[0] ?? null)}
				/>
			</label>
			<label class="custom-ingredient__field">
				<span>Nutrition facts label</span>
				<input
					id="custom-product-nutrition-photo"
					name="custom-product-nutrition-photo"
					type="file"
					accept="image/jpeg,image/png,image/webp"
					aria-required="true"
					onchange={(event) => onNutritionPhotoChange(event.currentTarget.files?.[0] ?? null)}
				/>
			</label>
			<label class="custom-ingredient__field">
				<span>Barcode</span>
				<input
					id="custom-product-barcode-photo"
					name="custom-product-barcode-photo"
					type="file"
					accept="image/jpeg,image/png,image/webp"
					aria-required="true"
					onchange={(event) => onBarcodePhotoChange(event.currentTarget.files?.[0] ?? null)}
				/>
			</label>
		</section>
	{/if}

	<label class="custom-ingredient__destination custom-ingredient__field">
		<span>Add after saving</span>
		<select
			bind:this={saveDestinationSelect}
			id="custom-ingredient-save-destination"
			name="custom-ingredient-save-destination"
			value={saveDestination}
			onchange={(event) =>
				onSaveDestinationChange(event.currentTarget.value as SmoothieListKey | "custom-only")}
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
			onMoveToShopping={onMoveToShopping}
			onMoveToFridge={onMoveToFridge}
			onUndo={onUndo}
		/>
	{:else if savedMessage}
		<p class="custom-ingredient__success" role="status">{savedMessage}</p>
	{/if}
	{#if catalogMessage}
		<p class="custom-ingredient__catalog-message" role="status">{catalogMessage}</p>
	{/if}

	<div class="custom-ingredient__actions">
		<button type="button" class="custom-ingredient__secondary" onclick={onBack}>
			Back
		</button>
		<button
			type="button"
			class="custom-ingredient__primary"
			onclick={onSubmit}
			disabled={saving}
		>
			{saving ? "Saving…" : "Add Ingredient"}
		</button>
	</div>
</div>
