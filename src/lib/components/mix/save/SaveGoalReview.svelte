<script lang="ts">
	import {
		formatChartNumber,
		formatSignedChartNumber,
		type SaveGoalDiff,
	} from "$lib/utils/mix/ui/mixUi";

	let { diffs }: { diffs: SaveGoalDiff[] } = $props();
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
		gap: 0.4rem;
		max-height: 16rem;
		overflow-y: auto;
		padding-right: 0.15rem;
	}

	.save-goal-review__row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.6rem;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius;

		div {
			display: grid;
			gap: 0.1rem;
			min-width: 0;
		}

		strong {
			color: $app-primary;
			font-size: $app-font-size-md;
		}

		span {
			color: $app-muted;
			font-size: $app-font-size-sm;
			font-weight: 700;
		}
	}

	.save-goal-review__badge {
		justify-self: end;
		width: fit-content;
		max-width: 8rem;
		padding: 0.2rem 0.5rem;
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
