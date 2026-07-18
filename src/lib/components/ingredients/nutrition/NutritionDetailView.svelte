<script lang="ts">
	import Link from "$lib/assets/icons/Link.svelte";
	import Minus from "$lib/assets/icons/Minus.svelte";
	import Plus from "$lib/assets/icons/Plus.svelte";
	import BackButton from "$lib/components/common/buttons/BackButton.svelte";
	import AcceleratingStepButton from "$lib/components/common/buttons/AcceleratingStepButton.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop.svelte";
	import {
		DEFAULT_NUTRITION_VIEWING_GRAMS,
		formatViewingGrams,
		MAX_NUTRITION_VIEWING_GRAMS,
		MIN_NUTRITION_VIEWING_GRAMS,
		NUTRITION_VIEWING_GRAM_STEP,
		stepNutritionViewingGrams,
	} from "$lib/utils/food/nutrients/nutritionDisplay";
	import NutritionPanel from "./NutritionPanel.svelte";
	import NutritionServingSelect from "./NutritionServingSelect.svelte";
	import type { NutritionDetailViewProps } from "./types";
	import {
		getFoodServingByGrams,
		getPrimaryFoodServing,
	} from "$lib/utils/food/servings/foodServings";

	let {
		food,
		onClose,
		showListActions = true,
		listMembership = { inFridge: false, inShoppingList: false },
		canAdjustImagePlacement = false,
		onImagePlacementSave,
	}: NutritionDetailViewProps = $props();

	let viewingGrams = $state(DEFAULT_NUTRITION_VIEWING_GRAMS);
	let currentFoodId = $state<number | null>(null);
	const viewingServing = $derived(getFoodServingByGrams(food, viewingGrams));

	$effect(() => {
		if (currentFoodId === null) {
			currentFoodId = food.fdcId;
			viewingGrams =
				getPrimaryFoodServing(food)?.gramWeight ?? DEFAULT_NUTRITION_VIEWING_GRAMS;
			return;
		}
		if (food.fdcId === currentFoodId) return;
		currentFoodId = food.fdcId;
		viewingGrams =
			getPrimaryFoodServing(food)?.gramWeight ?? DEFAULT_NUTRITION_VIEWING_GRAMS;
	});

	const decreaseViewingAmount = (step: number) => {
		viewingGrams = stepNutritionViewingGrams(viewingGrams, "decrease", step);
	};

	const increaseViewingAmount = (step: number) => {
		viewingGrams = stepNutritionViewingGrams(viewingGrams, "increase", step);
	};
</script>

<ViewFrame className="nutrition-detail-view">
	<ViewTop>
		<header class="nutrition-detail-view__header">
			<BackButton
				class="nutrition-detail-view__back"
					label="Back to ingredients"
					variant="soft"
					size="small"
					onclick={onClose}
				/>
			<h1 id="nutrition-detail-view-title">{food.description}</h1>
			<span class="nutrition-detail-view__source" aria-label="Linked source" title="Linked source">
				<Link size={16} strokeWidth={2.2} />
			</span>
		</header>

		<section class="nutrition-detail-view__amount" aria-label="Viewing amount">
			<h2>Viewing Amount</h2>
			<div class="nutrition-detail-view__amount-controls">
				<AcceleratingStepButton
					label={`Decrease viewing amount by ${NUTRITION_VIEWING_GRAM_STEP}g; press and hold to accelerate`}
					variant="soft"
					size="small"
					disabled={viewingGrams <= MIN_NUTRITION_VIEWING_GRAMS}
					onStep={decreaseViewingAmount}
				>
					<Minus size={18} strokeWidth={2.6} />
				</AcceleratingStepButton>
				<strong aria-live="polite">{formatViewingGrams(viewingGrams)}</strong>
				<AcceleratingStepButton
					label={`Increase viewing amount by ${NUTRITION_VIEWING_GRAM_STEP}g; press and hold to accelerate`}
					variant="primary"
					size="small"
					disabled={viewingGrams >= MAX_NUTRITION_VIEWING_GRAMS}
					onStep={increaseViewingAmount}
				>
					<Plus size={18} strokeWidth={2.6} />
				</AcceleratingStepButton>
			</div>
		</section>
		<NutritionServingSelect
			{food}
			{viewingGrams}
			onSelect={(gramWeight) => (viewingGrams = gramWeight)}
		/>
	</ViewTop>

	<ViewBody scroll>
		<div class="nutrition-detail-view__panel">
			<NutritionPanel
				{food}
				{showListActions}
				{viewingGrams}
				{viewingServing}
				{listMembership}
				{canAdjustImagePlacement}
				{onImagePlacementSave}
			/>
		</div>
	</ViewBody>
</ViewFrame>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.nutrition-detail-view__header {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: $app-gap-sm;
		min-height: $ingredient-control-height;
		padding: $app-gap-xs;
	}

	h1 {
		margin: 0;
		overflow: hidden;
		color: $ingredient-text-primary;
		font-family: $app-font-family-interface;
		font-size: $app-font-size-lg;
		font-weight: $app-font-weight-bold;
		line-height: 1.15;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nutrition-detail-view__source {
		display: inline-grid;
		place-items: center;
		color: $ingredient-accent-info;
	}

	.nutrition-detail-view__amount {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $app-gap-md;
		min-height: $ingredient-control-height;
		padding-block: $app-gap-sm;
		border-top: $app-border-divider;
		border-bottom: $app-border-divider;

		h2 {
			margin: 0;
			color: $ingredient-text-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-bold;
			letter-spacing: 0.04em;
			text-transform: uppercase;
		}
	}

	.nutrition-detail-view__amount-controls {
		display: inline-flex;
		align-items: center;
		gap: $app-gap-md;
		color: $ingredient-text-primary;

		strong {
			font-size: $app-font-size-md;
			font-weight: $app-font-weight-bold;
		}
	}

	.nutrition-detail-view__panel {
		display: grid;
		gap: $app-gap-md;
		padding-bottom: $app-gap-lg;
	}

	.nutrition-detail-view__panel :global(.nf-label) {
		margin-top: 0;
	}
</style>
