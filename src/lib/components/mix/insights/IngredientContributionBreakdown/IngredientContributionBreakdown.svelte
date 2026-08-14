<script lang="ts">
	import MixPanelSection from "$lib/components/mix/layout/MixPanelSection/MixPanelSection.svelte";
	import { formatMixQuantity } from "$lib/utils/mix/formatting/mixQuantity";
	import type { IngredientContributionBreakdownProps } from "./types";

	let {
		breakdowns = [],
		open = false,
		onOpenChange,
	}: IngredientContributionBreakdownProps = $props();

</script>

{#if breakdowns.length > 0}
	<MixPanelSection
		class="contribution-breakdown"
		ariaLabel="Ingredient contribution breakdown"
		title="What is driving this shape"
		{open}
		{onOpenChange}
	>
		<div class="contribution-breakdown__grid">
			{#each breakdowns as breakdown}
				<article
					class="contribution-card"
					data-nutrient-label={breakdown.label}
				>
					<div class="contribution-card__title">
						<strong>{breakdown.label}</strong>
						<span>
							{formatMixQuantity(breakdown.total, {
								unit: breakdown.unit,
							})}
						</span>
					</div>

					<ul>
						{#each breakdown.contributors as contributor}
							<li>
								<span class="contribution-card__food">
									{contributor.label}
								</span>
								<span class="contribution-card__value">
									{formatMixQuantity(contributor.percentOfTotal, {
										unit: "%",
									})}
								</span>
								<span class="contribution-card__bar" aria-hidden="true">
									<span
										style={`width: ${Math.min(contributor.percentOfTotal, 100)}%`}
									></span>
								</span>
								<small>
									{formatMixQuantity(contributor.amount, {
										unit: breakdown.unit,
									})}
									from {formatMixQuantity(contributor.grams, { unit: "g" })}
								</small>
							</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>
	</MixPanelSection>
{/if}

<style lang="scss">
	@use "./IngredientContributionBreakdown.scss";
</style>
