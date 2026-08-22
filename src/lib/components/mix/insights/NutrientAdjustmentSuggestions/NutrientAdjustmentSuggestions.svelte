<script lang="ts">
	import FoodSymbol from "$lib/assets/icons/FoodSymbol/FoodSymbol.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import MixPanelSection from "$lib/components/mix/layout/MixPanelSection/MixPanelSection.svelte";
	import { formatMixQuantity } from "$lib/utils/mix/formatting/mixQuantity";
	import type { NutrientAdjustmentImpact } from "$lib/utils/mix/calculations";
	import type { NutrientAdjustmentSuggestionsProps } from "./types";

	let {
		suggestions = [],
		lastAppliedFoodDescription = null,
		onApply,
		onUndo,
		open = false,
		onOpenChange,
	}: NutrientAdjustmentSuggestionsProps = $props();

	const getActionText = (
		direction: "increase" | "decrease",
		nextServingGrams: number,
	) => {
		if (nextServingGrams <= 0) return "Remove from this mix";
		return `${direction === "increase" ? "Increase" : "Reduce"} to ${formatMixQuantity(nextServingGrams, { unit: "g" })}`;
	};

	const getIncrementText = (
		incrementSource: "source-serving" | "configured-default",
		incrementLabel: string,
	) =>
		incrementSource === "source-serving"
			? `Uses one reported serving: ${incrementLabel}`
			: `Uses the standard Mix step: ${incrementLabel}`;

	const getImpactText = (impact: NutrientAdjustmentImpact) => {
		return `${impact.label} ${formatMixQuantity(impact.amountChange, {
			unit: impact.unit,
			sign: "always",
		})}`;
	};
</script>

{#if suggestions.length > 0 || lastAppliedFoodDescription}
	<MixPanelSection
		class="nutrient-adjustments"
		ariaLabel="Suggested ingredient adjustments"
		title="Suggested adjustments"
		badge={suggestions.length > 0 ? String(suggestions.length) : undefined}
		{open}
		{onOpenChange}
	>
		<div class="nutrient-adjustments__content">
			{#if lastAppliedFoodDescription && onUndo}
				<div class="nutrient-adjustments__undo" role="status">
					<p>
						<strong>{lastAppliedFoodDescription} updated.</strong>
						You can undo that change now.
					</p>
					<ActionButton
						size="small"
						variant="secondary"
						onclick={onUndo}
					>
						Undo
					</ActionButton>
				</div>
			{/if}
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
								{getActionText(
									suggestion.direction,
									suggestion.nextServingGrams,
								)}
							</p>
							<div
								class="nutrient-adjustment__impacts"
								aria-label="Goal improvements"
							>
								{#each suggestion.impacts.slice(0, 3) as impact}
									<MetadataPill label={getImpactText(impact)} tone="success" />
								{/each}
							</div>
							<p class="nutrient-adjustment__basis">
								{getIncrementText(
									suggestion.incrementSource,
									suggestion.incrementLabel,
								)}
							</p>
						</div>

						<ActionButton
							size="small"
							variant="secondary"
							onclick={() =>
								onApply(suggestion.food.fdcId, suggestion.nextServingGrams)}
						>
							Apply
						</ActionButton>
					</article>
				{/each}
			</div>
		</div>
	</MixPanelSection>
{/if}

<style lang="scss">
	@use "./NutrientAdjustmentSuggestions.scss";
</style>
