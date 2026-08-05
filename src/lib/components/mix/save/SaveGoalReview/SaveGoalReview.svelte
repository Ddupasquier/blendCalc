<script lang="ts">
	import {
		formatChartNumber,
	} from "$lib/utils/mix/ui/mixUi";
	import type { SaveGoalReviewProps } from "./types";

	let { diffs }: SaveGoalReviewProps = $props();

	const formatGoal = (diff: SaveGoalReviewProps["diffs"][number]) => {
		if (diff.goalType === "minimum") return `At least ${formatChartNumber(diff.goal)}`;
		if (diff.goalType === "maximum") return `At most ${formatChartNumber(diff.goal)}`;
		if (diff.goalType === "range") {
			return `${formatChartNumber(diff.goal)}–${formatChartNumber(diff.upperGoal ?? diff.goal)}`;
		}
		return formatChartNumber(diff.goal);
	};

	const formatStatus = (diff: SaveGoalReviewProps["diffs"][number]) => {
		if (diff.status === "met") return "On track";
		const amount = `${formatChartNumber(Math.abs(diff.difference))}${diff.unit}`;
		return diff.status === "over" ? `${amount} over` : `${amount} short`;
	};
</script>

<div class="save-goal-review">
	<p>Current ingredients compared with your selected nutrient goals:</p>
	<div class="save-goal-review__list">
		{#each diffs as diff}
			<div class="save-goal-review__row">
				<div>
					<strong>{diff.label}</strong>
					<span>
						Actual {formatChartNumber(diff.total)}{diff.unit} · Goal {formatGoal(diff)}{diff.unit} · {Math.round(diff.percentOfGoal)}%
					</span>
				</div>
				<span class={`save-goal-review__badge ${diff.status}`}>
					{formatStatus(diff)}
				</span>
			</div>
		{/each}
	</div>
</div>

<style lang="scss">
	@use "./SaveGoalReview.scss";
</style>
