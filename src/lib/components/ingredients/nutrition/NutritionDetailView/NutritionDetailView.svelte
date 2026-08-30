<script lang="ts">
	import { untrack } from "svelte";
	import Link from "$lib/assets/icons/Link/Link.svelte";
	import Minus from "$lib/assets/icons/Minus/Minus.svelte";
	import Plus from "$lib/assets/icons/Plus/Plus.svelte";
	import BackButton from "$lib/components/common/buttons/BackButton/BackButton.svelte";
	import AcceleratingStepButton from "$lib/components/common/buttons/AcceleratingStepButton/AcceleratingStepButton.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame/ViewFrame.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop/ViewTop.svelte";
	import {
		formatNutritionViewingSelection,
		getInitialNutritionViewingSelection,
		getNutritionViewingConversion,
		getNutritionViewingServing,
		stepNutritionViewingSelection,
		type NutritionViewingSelection,
	} from "$lib/utils/food/nutrients/nutritionViewingAmount";
	import NutritionPanel from "../NutritionPanel/NutritionPanel.svelte";
	import NutritionServingSelect from "../NutritionServingSelect/NutritionServingSelect.svelte";
	import type { NutritionDetailViewProps } from "./types";
	import { getCanonicalFoodDescription } from "$lib/utils/food/records/foodRecords";

	let {
		food,
		onClose,
		showListActions = true,
		listMembership = { inFridge: false, inShoppingList: false },
		canAdjustImagePlacement = false,
		onImagePlacementSave,
		provenanceOptions = [],
		onReportIncorrectInformation,
	}: NutritionDetailViewProps = $props();

	let viewingSelection = $state<NutritionViewingSelection>(
		untrack(() => getInitialNutritionViewingSelection(food)),
	);
	let currentFoodId = $state(untrack(() => food.fdcId));
	const foodName = $derived(getCanonicalFoodDescription(food));
	const viewingServing = $derived(
		getNutritionViewingServing(food, viewingSelection),
	);
	const viewingConversion = $derived(
		getNutritionViewingConversion(food, viewingSelection),
	);
	const viewingLabel = $derived(
		formatNutritionViewingSelection(food, viewingSelection),
	);

	$effect(() => {
		if (food.fdcId === currentFoodId) return;
		currentFoodId = food.fdcId;
		viewingSelection = getInitialNutritionViewingSelection(food);
	});

	const decreaseViewingAmountLabel = $derived(
		viewingSelection.kind === "mass"
			? "Decrease viewing amount by 1g; press and hold to accelerate"
			: "Decrease viewing amount by 1 serving; press and hold to accelerate",
	);
	const increaseViewingAmountLabel = $derived(
		viewingSelection.kind === "mass"
			? "Increase viewing amount by 1g; press and hold to accelerate"
			: "Increase viewing amount by 1 serving; press and hold to accelerate",
	);

	const decreaseViewingAmount = (step: number) => {
		viewingSelection = stepNutritionViewingSelection(
			viewingSelection,
			"decrease",
			step,
		);
	};

	const increaseViewingAmount = (step: number) => {
		viewingSelection = stepNutritionViewingSelection(
			viewingSelection,
			"increase",
			step,
		);
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
			<span
				class="nutrition-detail-view__source"
				role="img"
				aria-label="Linked source"
				title="Linked source"
			>
				<Link size={16} strokeWidth={2.2} />
			</span>
		</header>

		<div class="nutrition-detail-view__measurement-controls">
			<section
				class="nutrition-detail-view__amount"
				aria-label="Viewing amount"
			>
				<h2>Viewing Amount</h2>
				<div class="nutrition-detail-view__amount-controls">
					<AcceleratingStepButton
						label={decreaseViewingAmountLabel}
						variant="soft"
						size="small"
						disabled={viewingSelection.kind === "mass"
							? viewingSelection.grams <= 1
							: viewingSelection.multiplier <= 1}
						onStep={decreaseViewingAmount}
					>
						<Minus size={18} strokeWidth={2.6} />
					</AcceleratingStepButton>
					<strong aria-live="polite">{viewingLabel}</strong>
					<AcceleratingStepButton
						label={increaseViewingAmountLabel}
						variant="primary"
						size="small"
						disabled={false}
						onStep={increaseViewingAmount}
					>
						<Plus size={18} strokeWidth={2.6} />
					</AcceleratingStepButton>
				</div>
			</section>
			<NutritionServingSelect
				{food}
				selection={viewingSelection}
				onSelect={(selection) => (viewingSelection = selection)}
			/>
		</div>
	</ViewTop>

	<ViewBody className="nutrition-detail-view__body" scroll>
		<div class="nutrition-detail-view__panel">
			<NutritionPanel
				{food}
				{showListActions}
				{viewingConversion}
				{viewingLabel}
				{viewingServing}
				{listMembership}
				{canAdjustImagePlacement}
				{onImagePlacementSave}
				{provenanceOptions}
				{onReportIncorrectInformation}
			/>
		</div>
	</ViewBody>
</ViewFrame>

<style lang="scss">
	@use "./NutritionDetailView.scss";
</style>
