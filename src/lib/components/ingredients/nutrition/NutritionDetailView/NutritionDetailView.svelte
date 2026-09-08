<script lang="ts">
	import { untrack } from "svelte";
	import Link from "$lib/assets/icons/Link/Link.svelte";
	import Minus from "$lib/assets/icons/Minus/Minus.svelte";
	import Plus from "$lib/assets/icons/Plus/Plus.svelte";
	import BackButton from "$lib/components/common/buttons/BackButton/BackButton.svelte";
	import AcceleratingStepButton from "$lib/components/common/buttons/AcceleratingStepButton/AcceleratingStepButton.svelte";
	import SegmentedControl from "$lib/components/common/buttons/SegmentedControl/SegmentedControl.svelte";
	import type { SegmentedControlButtonOption } from "$lib/components/common/buttons/SegmentedControl/types";
	import ViewBody from "$lib/components/common/view/ViewBody/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame/ViewFrame.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop/ViewTop.svelte";
	import {
		formatNutritionViewingSelection,
		getInitialNutritionViewingSelection,
		getNutritionViewingConversion,
		getNutritionViewingServing,
		stepNutritionViewingSelection,
		canViewFoodNutritionByMass,
		type NutritionViewingMode,
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

	type ServingViewingSelection = Extract<
		NutritionViewingSelection,
		{ kind: "serving" }
	>;
	const hasExactServingWeight = (selection: ServingViewingSelection | null) => {
		if (!selection || !canViewFoodNutritionByMass(food)) return false;
		const grams = getNutritionViewingConversion(food, {
			...selection,
			multiplier: 1,
		}).grams;
		return typeof grams === "number" && Number.isFinite(grams) && grams > 0;
	};
	const getDefaultViewingMode = (
		selection: NutritionViewingSelection,
	): NutritionViewingMode =>
		selection.kind === "serving" && !hasExactServingWeight(selection)
			? "servings"
			: "weight";
	const initialViewingSelection = untrack(() =>
		getInitialNutritionViewingSelection(food),
	);
	let viewingSelection = $state<NutritionViewingSelection>(
		initialViewingSelection,
	);
	let servingSelection = $state<ServingViewingSelection | null>(
		initialViewingSelection.kind === "serving" ? initialViewingSelection : null,
	);
	let viewingMode = $state<NutritionViewingMode>(
		untrack(() => getDefaultViewingMode(initialViewingSelection)),
	);
	let currentFoodId = $state(untrack(() => food.fdcId));
	const viewingModeOptions = [
		{ value: "weight", label: "Weight" },
		{ value: "servings", label: "Servings" },
	] satisfies SegmentedControlButtonOption[];
	const canSelectViewingMode = $derived(
		hasExactServingWeight(servingSelection),
	);
	const foodName = $derived(getCanonicalFoodDescription(food));
	const resolvedViewingSelection = $derived.by<NutritionViewingSelection>(
		() => {
			if (viewingMode !== "weight" || viewingSelection.kind !== "serving")
				return viewingSelection;
			const grams = getNutritionViewingConversion(food, viewingSelection).grams;
			return typeof grams === "number" && Number.isFinite(grams) && grams > 0
				? { kind: "mass", grams }
				: viewingSelection;
		},
	);
	const viewingServing = $derived(
		getNutritionViewingServing(food, resolvedViewingSelection),
	);
	const viewingConversion = $derived(
		getNutritionViewingConversion(food, resolvedViewingSelection),
	);
	const viewingLabel = $derived(
		formatNutritionViewingSelection(food, resolvedViewingSelection),
	);

	$effect(() => {
		if (food.fdcId === currentFoodId) return;
		currentFoodId = food.fdcId;
		const selection = getInitialNutritionViewingSelection(food);
		viewingSelection = selection;
		servingSelection = selection.kind === "serving" ? selection : null;
		viewingMode = getDefaultViewingMode(selection);
	});

	const decreaseViewingAmountLabel = $derived(
		viewingMode === "weight"
			? "Decrease viewing amount by 1g; press and hold to accelerate"
			: "Decrease viewing amount by 1 serving; press and hold to accelerate",
	);
	const increaseViewingAmountLabel = $derived(
		viewingMode === "weight"
			? "Increase viewing amount by 1g; press and hold to accelerate"
			: "Increase viewing amount by 1 serving; press and hold to accelerate",
	);

	const setViewingSelection = (selection: NutritionViewingSelection) => {
		viewingSelection = selection;
		if (selection.kind === "serving") servingSelection = selection;
	};

	const decreaseViewingAmount = (step: number) => {
		setViewingSelection(
			stepNutritionViewingSelection(
				food,
				viewingSelection,
				"decrease",
				step,
				viewingMode,
			),
		);
	};

	const increaseViewingAmount = (step: number) => {
		setViewingSelection(
			stepNutritionViewingSelection(
				food,
				viewingSelection,
				"increase",
				step,
				viewingMode,
			),
		);
	};

	const selectViewingMode = (value: string) => {
		if (
			(value !== "weight" && value !== "servings") ||
			value === viewingMode ||
			!servingSelection
		)
			return;
		if (value === "weight") {
			if (
				viewingSelection.kind === "serving" &&
				viewingSelection.multiplier > 1
			) {
				const grams = getNutritionViewingConversion(
					food,
					viewingSelection,
				).grams;
				if (typeof grams === "number" && Number.isFinite(grams))
					viewingSelection = { kind: "mass", grams };
			}
			viewingMode = "weight";
			return;
		}
		if (viewingSelection.kind === "mass") {
			const servingGrams = getNutritionViewingConversion(food, {
				...servingSelection,
				multiplier: 1,
			}).grams;
			if (
				typeof servingGrams === "number" &&
				Number.isFinite(servingGrams) &&
				servingGrams > 0
			) {
				servingSelection = {
					...servingSelection,
					multiplier: Math.max(
						1,
						Math.round(viewingSelection.grams / servingGrams),
					),
				};
			}
		}
		viewingSelection = servingSelection;
		viewingMode = "servings";
	};

	const selectServing = (selection: NutritionViewingSelection) => {
		viewingSelection = selection;
		servingSelection = selection.kind === "serving" ? selection : null;
		viewingMode = getDefaultViewingMode(selection);
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
				<div class="nutrition-detail-view__amount-heading">
					<h2>Viewing Amount</h2>
					{#if canSelectViewingMode}
						<div class="nutrition-detail-view__mode">
							<SegmentedControl
								label="Adjust viewing amount by"
								options={viewingModeOptions}
								value={viewingMode}
								onSelect={selectViewingMode}
							/>
						</div>
					{/if}
				</div>
				<div class="nutrition-detail-view__amount-controls">
					<AcceleratingStepButton
						label={decreaseViewingAmountLabel}
						variant="soft"
						size="small"
						disabled={viewingMode === "weight"
							? viewingSelection.kind === "mass"
								? viewingSelection.grams <= 1
								: false
							: viewingSelection.kind === "serving"
								? viewingSelection.multiplier <= 1
								: false}
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
				onSelect={selectServing}
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
