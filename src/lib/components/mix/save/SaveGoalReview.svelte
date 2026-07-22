<script lang="ts">
	import {
		formatChartNumber,
		formatSignedChartNumber,
	} from "$lib/utils/mix/ui/mixUi";
	import type { SaveGoalReviewProps } from "$lib/components/mix/types";

	let { diffs }: SaveGoalReviewProps = $props();
</script>

<div class="save-goal-review">
	<p>Current ingredients compared with your selected nutrient goals:</p>
	<div class="save-goal-review__list">
		{#each diffs as diff}
			<div class="save-goal-review__row">
				<div>
					<strong>{diff.label}</strong>
					<span>
						Actual {formatChartNumber(diff.total)}{diff.unit} · Goal {formatChartNumber(
							diff.goal,
						)}{diff.unit} · {Math.round(diff.percentOfGoal)}%
					</span>
				</div>
				<span class={`save-goal-review__badge ${diff.status}`}>
					{diff.status === "near"
						? "Near goal"
						: diff.status === "over"
							? "Over"
							: "Under"}
					{formatSignedChartNumber(diff.difference)}{diff.unit}
				</span>
			</div>
		{/each}
	</div>
</div>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.save-goal-review {
		display: grid;
		gap: $app-gap-sm;

		> p {
			color: $app-muted;
			font-size: $app-font-size-md;
			line-height: 1.4;
		}
	}

	.save-goal-review__list {
		display: grid;
		gap: $app-gap-sm;
		max-height: 16rem;
		overflow-y: auto;
		padding-right: $app-gap-2xs;
	}

	.save-goal-review__row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: $app-gap-sm;
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius;

		div {
			display: grid;
			gap: $app-gap-micro;
			min-width: 0;
		}

		strong {
			color: $app-primary;
			font-size: $app-font-size-md;
		}

		span {
			color: $app-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-semibold;
		}
	}

	.save-goal-review__badge {
		justify-self: end;
		width: fit-content;
		max-width: 8rem;
		padding: $app-gap-inline-compact $app-gap-sm;
		border-radius: $app-radius-pill;
		text-align: right;
		white-space: nowrap;

		&.near {
			color: $app-primary;
			background: $app-success-bg;
		}

		&.under {
			color: $app-primary;
			background: $app-accent;
		}

		&.over {
			color: $app-warning-text;
			background: $app-warning-bg;
		}
	}
</style>
