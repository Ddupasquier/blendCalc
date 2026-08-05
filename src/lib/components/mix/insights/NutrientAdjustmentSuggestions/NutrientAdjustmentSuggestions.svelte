<script lang="ts">
	import FoodSymbol from "$lib/assets/icons/FoodSymbol/FoodSymbol.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import type { NutrientAdjustmentImpact } from "$lib/utils/mix/calculations";
	import type { NutrientAdjustmentSuggestionsProps } from "./types";

	let {
		suggestions = [],
		onApply,
		open = false,
		onOpenChange,
	}: NutrientAdjustmentSuggestionsProps = $props();

	const formatAmount = (value: number) => {
		const absoluteValue = Math.abs(value);
		if (absoluteValue >= 100) return absoluteValue.toFixed(0);
		if (absoluteValue >= 10) return absoluteValue.toFixed(1);
		return absoluteValue.toFixed(2).replace(/\.?0+$/, "");
	};

	const formatGrams = (value: number) =>
		value >= 100
			? value.toFixed(0)
			: value.toFixed(1).replace(/\.0$/, "");

	const getActionText = (
		direction: "increase" | "decrease",
		nextServingGrams: number,
	) => {
		if (nextServingGrams <= 0) return "Remove from this mix";
		return `${direction === "increase" ? "Increase" : "Reduce"} to ${formatGrams(nextServingGrams)}g`;
	};

	const getIncrementText = (
		incrementSource: "source-serving" | "configured-default",
		incrementLabel: string,
	) => incrementSource === "source-serving"
		? `Uses one reported serving: ${incrementLabel}`
		: `Uses the standard Mix step: ${incrementLabel}`;

	const getImpactText = (impact: NutrientAdjustmentImpact) => {
		const sign = impact.amountChange >= 0 ? "+" : "−";
		return `${impact.label} ${sign}${formatAmount(impact.amountChange)}${impact.unit}`;
	};
</script>

{#if suggestions.length > 0}
	<section
		class="nutrient-adjustments"
		aria-label="Suggested ingredient adjustments"
	>
		<CollapsibleSection
			title="Suggested adjustments"
			badge={String(suggestions.length)}
			{open}
			{onOpenChange}
			surface="panel"
		>
			<div class="nutrient-adjustments__content">
				<p class="nutrient-adjustments__intro">
					Small, goal-safe changes to ingredients already in this mix.
				</p>
				<div class="nutrient-adjustments__list">
					{#each suggestions as suggestion}
						<article class="nutrient-adjustment">
							<span class="nutrient-adjustment__symbol" aria-hidden="true">
								<FoodSymbol food={suggestion.food} />
							</span>
							<div class="nutrient-adjustment__main">
								<strong title={suggestion.food.description}>
									{suggestion.food.description}
								</strong>
								<p class="nutrient-adjustment__action">
									{getActionText(suggestion.direction, suggestion.nextServingGrams)}
								</p>
								<div class="nutrient-adjustment__impacts" aria-label="Goal improvements">
									{#each suggestion.impacts.slice(0, 3) as impact}
										<MetadataPill label={getImpactText(impact)} tone="success" />
									{/each}
								</div>
								<p class="nutrient-adjustment__basis">
									{getIncrementText(suggestion.incrementSource, suggestion.incrementLabel)}
								</p>
							</div>

							<ActionButton
								size="small"
								variant="secondary"
								onclick={() => onApply(suggestion.food.fdcId, suggestion.nextServingGrams)}
							>
								Apply
							</ActionButton>
						</article>
					{/each}
				</div>
			</div>
		</CollapsibleSection>
	</section>
{/if}

<style lang="scss">
	@use "./NutrientAdjustmentSuggestions.scss";
</style>
