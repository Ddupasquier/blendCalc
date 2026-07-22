<script lang="ts">
	import {
		formatChartNumber,
		formatSignedChartNumber,
	} from "$lib/utils/mix/ui/mixUi";
	import type { SaveGoalReviewProps } from "./types";

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
	@use "./SaveGoalReview.scss";
</style>
