<script lang="ts">
	import type { IngredientContributionBreakdownProps } from "$lib/components/mix/types";

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
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-bold;
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-xs;
			line-height: 1.35;
		}
	}

	.contribution-breakdown__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax($mix-contribution-card-min-width, 1fr));
		gap: $app-gap-sm;
	}

	.contribution-card {
		min-width: 0;
		padding: $app-gap-sm;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-radius;
	}

	.contribution-card__title {
		display: flex;
		justify-content: space-between;
		gap: $app-gap-sm;
		margin-bottom: $app-gap-sm;
		color: $app-primary;
		font-size: $app-font-size-xs;

		strong {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		span {
			flex-shrink: 0;
			color: $app-muted;
			font-weight: $app-font-weight-bold;
		}
	}

	ul {
		display: grid;
		gap: $app-gap-sm;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: $app-gap-2xs $app-gap-sm;
		align-items: center;
	}

	.contribution-card__food {
		min-width: 0;
		overflow: hidden;
		color: $app-primary;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-semibold;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.contribution-card__value {
		color: $app-primary;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-heavy;
	}

	.contribution-card__bar {
		grid-column: 1 / -1;
		height: $mix-contribution-bar-height;
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
		font-size: $app-font-size-2xs;
		font-weight: $app-font-weight-semibold;
	}
</style>
