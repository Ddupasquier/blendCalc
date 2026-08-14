<script lang="ts">
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import { formatMixQuantity } from "$lib/utils/mix/formatting/mixQuantity";
	import {
		formatMixGoalTarget,
		getMixGoalStatusTone,
	} from "$lib/utils/mix/formatting/mixGoalPresentation";
	import type { SaveGoalReviewProps } from "./types";

	let { diffs }: SaveGoalReviewProps = $props();

	const formatGoal = (diff: SaveGoalReviewProps["diffs"][number]) =>
		formatMixGoalTarget(
			{
				goalType: diff.goalType,
				targetAmount: diff.goal,
				upperAmount: diff.upperGoal,
			},
			diff.unit,
		);

	const formatStatus = (diff: SaveGoalReviewProps["diffs"][number]) => {
		if (diff.status === "met") return "On track";
		const amount = formatMixQuantity(Math.abs(diff.difference), {
			unit: diff.unit,
		});
		return diff.status === "over" ? `${amount} over` : `${amount} short`;
	};
</script>

<div class="save-goal-review">
	<p>Current ingredients compared with your selected nutrient goals:</p>
	<div class="save-goal-review__list">
		{#each diffs as diff}
			<div
				class="save-goal-review__row"
				data-nutrient-label={diff.label}
				data-goal-status={diff.status}
			>
				<div>
					<strong>{diff.label}</strong>
					<span>
						Actual {formatMixQuantity(diff.total, { unit: diff.unit })} · Goal
						{formatGoal(diff)} · {formatMixQuantity(diff.percentOfGoal, {
							unit: "%",
						})}
					</span>
				</div>
				<MetadataPill
					label={formatStatus(diff)}
					tone={getMixGoalStatusTone(diff.status)}
				/>
			</div>
		{/each}
	</div>
</div>

<style lang="scss">
	@use "./SaveGoalReview.scss";
</style>
