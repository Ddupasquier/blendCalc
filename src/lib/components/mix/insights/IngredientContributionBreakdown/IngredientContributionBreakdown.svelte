<script lang="ts">
	import type { IngredientContributionBreakdownProps } from "./types";

	let {
		breakdowns = [],
	}: IngredientContributionBreakdownProps = $props();

	const formatAmount = (value: number) => {
		return value >= 10 ? value.toFixed(0) : value.toFixed(1);
	};

	const formatPercent = (value: number) => {
		return `${Math.round(value)}%`;
	};
</script>

{#if breakdowns.length > 0}
	<section
		class="contribution-breakdown"
		aria-label="Ingredient contribution breakdown"
	>
		<div class="contribution-breakdown__header">
			<h4>What is driving this shape</h4>
			<p>Top ingredient contributors for each active nutrient.</p>
		</div>

		<div class="contribution-breakdown__grid">
			{#each breakdowns as breakdown}
				<article class="contribution-card">
					<div class="contribution-card__title">
						<strong>{breakdown.label}</strong>
						<span>
							{formatAmount(breakdown.total)}{breakdown.unit}
						</span>
					</div>

					<ul>
						{#each breakdown.contributors as contributor}
							<li>
								<span class="contribution-card__food">
									{contributor.label}
								</span>
								<span class="contribution-card__value">
									{formatPercent(contributor.percentOfTotal)}
								</span>
								<span
									class="contribution-card__bar"
									aria-hidden="true"
								>
									<span
										style={`width: ${Math.min(contributor.percentOfTotal, 100)}%`}
									></span>
								</span>
								<small>
									{formatAmount(contributor.amount)}{breakdown.unit}
									from {formatAmount(contributor.grams)}g
								</small>
							</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>
	</section>
{/if}

<style lang="scss">
	@use "./IngredientContributionBreakdown.scss";
</style>
