<script lang="ts">
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import type { IngredientContributionBreakdownProps } from "./types";

	let {
		breakdowns = [],
		open = false,
		onOpenChange,
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
		<CollapsibleSection
			title="What is driving this shape"
			{open}
			{onOpenChange}
			surface="panel"
		>
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
		</CollapsibleSection>
	</section>
{/if}

<style lang="scss">
	@use "./IngredientContributionBreakdown.scss";
</style>
