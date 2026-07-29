<script lang="ts">
	import Link from "$lib/assets/icons/Link/Link.svelte";
	import Minus from "$lib/assets/icons/Minus/Minus.svelte";
	import Plus from "$lib/assets/icons/Plus/Plus.svelte";
	import BackButton from "$lib/components/common/buttons/BackButton/BackButton.svelte";
	import AcceleratingStepButton from "$lib/components/common/buttons/AcceleratingStepButton/AcceleratingStepButton.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame/ViewFrame.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop/ViewTop.svelte";
	import {
		DEFAULT_NUTRITION_VIEWING_GRAMS,
		formatViewingGrams,
		MAX_NUTRITION_VIEWING_GRAMS,
		MIN_NUTRITION_VIEWING_GRAMS,
		NUTRITION_VIEWING_GRAM_STEP,
		stepNutritionViewingGrams,
	} from "$lib/utils/food/nutrients/nutritionDisplay";
	import NutritionPanel from "../NutritionPanel/NutritionPanel.svelte";
	import NutritionServingSelect from "../NutritionServingSelect/NutritionServingSelect.svelte";
	import type { NutritionDetailViewProps } from "./types";
	import {
		getFoodServingByGrams,
		getPrimaryFoodServing,
	} from "$lib/utils/food/servings/foodServings";
	import { getCanonicalFoodDescription } from "$lib/utils/food/records/foodRecords";

	let {
		food,
		onClose,
		showListActions = true,
		listMembership = { inFridge: false, inShoppingList: false },
		canAdjustImagePlacement = false,
		onImagePlacementSave,
		provenanceOptions = [],
	}: NutritionDetailViewProps = $props();

	let viewingGrams = $state(DEFAULT_NUTRITION_VIEWING_GRAMS);
	let currentFoodId = $state<number | null>(null);
	const foodName = $derived(getCanonicalFoodDescription(food));
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
			<h1 id="nutrition-detail-view-title">{foodName}</h1>
			<span class="nutrition-detail-view__source" aria-label="Linked source" title="Linked source">
				<Link size={16} strokeWidth={2.2} />
			</span>
		</header>

		<div class="nutrition-detail-view__measurement-controls">
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
		</div>
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
				{provenanceOptions}
			/>
		</div>
	</ViewBody>
</ViewFrame>

<style lang="scss">
	@use "./NutritionDetailView.scss";
</style>
