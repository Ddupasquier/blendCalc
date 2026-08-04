<script lang="ts">
	import FoodSymbol from "$lib/assets/icons/FoodSymbol/FoodSymbol.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import type {
		NutrientAdjustment,
		NutrientAdjustmentSuggestionsProps,
	} from "./types";

	let {
		foodSuggestions = [],
		reductionSuggestions = [],
		onAdd,
		onReduce,
		maxSuggestions = 3,
		open = false,
		onOpenChange,
	}: NutrientAdjustmentSuggestionsProps = $props();

	const formatAmount = (value: number) => {
		if (value >= 100) return value.toFixed(0);
		if (value >= 10) return value.toFixed(1);
		return value.toFixed(2).replace(/\.?0+$/, "");
	};

	const formatGrams = (value: number) => {
		if (value >= 100) return value.toFixed(0);
		if (value >= 10) return value.toFixed(1);
		return value.toFixed(1).replace(/\.0$/, "");
	};

	const getConflictCount = (adjustment: NutrientAdjustment) =>
		adjustment.suggestion.conflicts.length;

	const getAdjustmentPriority = (adjustment: NutrientAdjustment) => {
		if (getConflictCount(adjustment) > 0) return 2;
		return adjustment.type === "reduce" ? 0 : 1;
	};

	const adjustments = $derived(
		[
			...reductionSuggestions.map((suggestion) => ({
				type: "reduce" as const,
				suggestion,
			})),
			...foodSuggestions.map((suggestion) => ({
				type: "add" as const,
				suggestion,
			})),
		]
			.sort((a, b) => {
				const priorityDifference =
					getAdjustmentPriority(a) - getAdjustmentPriority(b);
				if (priorityDifference !== 0) return priorityDifference;
				return getConflictCount(a) - getConflictCount(b);
			})
			.slice(0, maxSuggestions),
	);
	const getActionLabel = (adjustment: NutrientAdjustment) => {
		if (adjustment.type === "reduce") return "Use less";
		return adjustment.suggestion.action === "increase" ? "Add more" : "Add";
	};

	const getImpactLabel = (adjustment: NutrientAdjustment) => {
		if (adjustment.type === "reduce") {
			return `Lower ${adjustment.suggestion.nutrientLabel}`;
		}

		return `Reach ${adjustment.suggestion.nutrientLabel}`;
	};

	const getPrimaryText = (adjustment: NutrientAdjustment) => {
		if (adjustment.type === "reduce") {
			return `Use ${formatGrams(adjustment.suggestion.reduceByGrams)}g less to lower ${adjustment.suggestion.nutrientLabel}.`;
		}

		const verb = adjustment.suggestion.action === "increase" ? "Add" : "Use";
		return `${verb} ${formatGrams(adjustment.suggestion.servingGramsToTarget)}g ${adjustment.suggestion.action === "increase" ? "more" : ""} to reach ${adjustment.suggestion.nutrientLabel}.`;
	};

	const getAmountText = (adjustment: NutrientAdjustment) => {
		if (adjustment.type === "reduce") {
			if (adjustment.suggestion.nextServingGrams < 1) {
				return "New amount: remove it";
			}
			return `New amount: ${formatGrams(adjustment.suggestion.nextServingGrams)}g`;
		}

		if (adjustment.suggestion.action === "increase") {
			return `New amount: ${formatGrams(adjustment.suggestion.nextServingGrams)}g`;
		}

		return `Amount to use: ${formatGrams(adjustment.suggestion.nextServingGrams)}g`;
	};

	const getHelpText = (adjustment: NutrientAdjustment) => {
		if (adjustment.type === "reduce") {
			return `Lowers ${adjustment.suggestion.nutrientLabel} by ${formatAmount(adjustment.suggestion.targetReducedAmount)}${adjustment.suggestion.unit}.`;
		}

		return `Adds ${formatAmount(adjustment.suggestion.targetAddedAmount)}${adjustment.suggestion.unit} ${adjustment.suggestion.nutrientLabel}.`;
	};

	const getWarningText = (adjustment: NutrientAdjustment) => {
		const conflict = adjustment.suggestion.conflicts[0];
		if (!conflict) return "";

		if (adjustment.type === "reduce") {
			return conflict.reason === "already-under"
				? `This may make ${conflict.label} even lower.`
				: `This may drop ${conflict.label} below goal.`;
		}

		return conflict.reason === "already-over"
			? `You are already over ${conflict.label}.`
			: `This may push ${conflict.label} over goal.`;
	};

	const applyAdjustment = (adjustment: NutrientAdjustment) => {
		if (adjustment.type === "reduce") {
			onReduce(adjustment.suggestion.food.fdcId, adjustment.suggestion.nextServingGrams);
			return;
		}

		onAdd(adjustment.suggestion.food.fdcId, adjustment.suggestion.nextServingGrams);
	};
</script>

{#if adjustments.length > 0}
	<section
		class="nutrient-adjustments"
		aria-label="Suggested ingredient adjustments"
	>
		<CollapsibleSection
			title="Suggested adjustments"
		badge={String(adjustments.length)}
		{open}
		{onOpenChange}
			surface="panel"
		>
			<div class="nutrient-adjustments__list">
				{#each adjustments as adjustment}
					<article
						class:has-warning={adjustment.suggestion.conflicts.length > 0}
						class="nutrient-adjustment"
					>
						<span class="nutrient-adjustment__symbol" aria-hidden="true">
							<FoodSymbol food={adjustment.suggestion.food} />
						</span>
						<div class="nutrient-adjustment__main">
							<div class="nutrient-adjustment__title-row">
								<div>
									<span class="nutrient-adjustment__source">
										{adjustment.suggestion.sourceLabel}
									</span>
									<strong>{adjustment.suggestion.food.description}</strong>
								</div>
								<span class:type-reduce={adjustment.type === "reduce"} class="nutrient-adjustment__impact">
									{getImpactLabel(adjustment)}
								</span>
							</div>

							<p class="nutrient-adjustment__action">
								<strong>{getActionLabel(adjustment)}:</strong>
								{getPrimaryText(adjustment)}
							</p>
							<p class="nutrient-adjustment__amount">
								{getAmountText(adjustment)}
							</p>
							<p class="nutrient-adjustment__help">
								{getHelpText(adjustment)}
							</p>

							{#if adjustment.suggestion.conflicts.length > 0}
								<p class="nutrient-adjustment__warning">
									<span>Watch out:</span>
									{getWarningText(adjustment)}
								</p>
							{/if}
						</div>

						<ActionButton size="small" variant="secondary" onclick={() => applyAdjustment(adjustment)}>
							Apply
						</ActionButton>
					</article>
				{/each}
			</div>
		</CollapsibleSection>
	</section>
{/if}

<style lang="scss">
	@use "./NutrientAdjustmentSuggestions.scss";
</style>
