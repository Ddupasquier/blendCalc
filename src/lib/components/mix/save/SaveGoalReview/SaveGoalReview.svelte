<script lang="ts">
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import { formatMixQuantity } from "$lib/utils/mix/formatting/mixQuantity";
	import type { SaveGoalReviewProps } from "./types";

	let { diffs }: SaveGoalReviewProps = $props();

	const formatGoal = (diff: SaveGoalReviewProps["diffs"][number]) => {
		if (diff.goalType === "minimum")
			return `At least ${formatMixQuantity(diff.goal, { unit: diff.unit })}`;
		if (diff.goalType === "maximum")
			return `At most ${formatMixQuantity(diff.goal, { unit: diff.unit })}`;
		if (diff.goalType === "range") {
			return `${formatMixQuantity(diff.goal)}–${formatMixQuantity(
				diff.upperGoal ?? diff.goal,
				{ unit: diff.unit },
			)}`;
		}
		return formatMixQuantity(diff.goal, { unit: diff.unit });
	};

	const formatStatus = (diff: SaveGoalReviewProps["diffs"][number]) => {
		if (diff.status === "met") return "On track";
		const amount = formatMixQuantity(Math.abs(diff.difference), {
			unit: diff.unit,
		});
		return diff.status === "over" ? `${amount} over` : `${amount} short`;
	};
	const statusTone = (
		status: SaveGoalReviewProps["diffs"][number]["status"],
	) =>
		status === "met" ? "success" : status === "over" ? "danger" : "warning";
</script>

<div class="save-goal-review">
	<p>Current ingredients compared with your selected nutrient goals:</p>
	<div class="save-goal-review__list">
		{#each diffs as diff}
			<div class="save-goal-review__row">
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
					tone={statusTone(diff.status)}
				/>
			</div>
		{/each}
	</div>
</div>

<style lang="scss">
	@use "./SaveGoalReview.scss";
</style>
