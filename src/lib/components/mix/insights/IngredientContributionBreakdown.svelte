<script lang="ts">
	import type { NutrientContributionBreakdown } from "$lib/utils/mix/calculations";

	let {
		breakdowns = [],
	}: { breakdowns?: NutrientContributionBreakdown[] } = $props();

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
	@use "../../../../styles/variables" as *;

	.contribution-breakdown {
		width: 100%;
		margin-top: $app-gap-sm;
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-card-radius;
	}

	.contribution-breakdown__header {
		margin-bottom: $app-gap-sm;

		h4 {
			color: $app-primary;
			font-size: 0.92rem;
			font-weight: 800;
		}

		p {
			color: $app-muted;
			font-size: 0.8rem;
			line-height: 1.35;
		}
	}

	.contribution-breakdown__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(155px, 1fr));
		gap: 0.45rem;
	}

	.contribution-card {
		min-width: 0;
		padding: 0.55rem;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-radius;
	}

	.contribution-card__title {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.45rem;
		color: $app-primary;
		font-size: 0.82rem;

		strong {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		span {
			flex-shrink: 0;
			color: $app-muted;
			font-weight: 800;
		}
	}

	ul {
		display: grid;
		gap: 0.4rem;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.15rem 0.45rem;
		align-items: center;
	}

	.contribution-card__food {
		min-width: 0;
		overflow: hidden;
		color: $app-primary;
		font-size: 0.78rem;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.contribution-card__value {
		color: $app-primary;
		font-size: 0.78rem;
		font-weight: 900;
	}

	.contribution-card__bar {
		grid-column: 1 / -1;
		height: 0.35rem;
		overflow: hidden;
		background: $app-accent;
		border-radius: $app-radius-pill;

		span {
			display: block;
			height: 100%;
			background: $app-primary;
			border-radius: inherit;
		}
	}

	small {
		grid-column: 1 / -1;
		color: $app-muted;
		font-size: 0.68rem;
		font-weight: 700;
	}
</style>
