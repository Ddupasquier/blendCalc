<script lang="ts">
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import SecondaryDelightMessage from "$lib/components/common/feedback/SecondaryDelightMessage/SecondaryDelightMessage.svelte";
	import NutrientRadarChart from "$lib/components/mix/insights/NutrientRadarChart/NutrientRadarChart.svelte";
	import MixPanelSection from "$lib/components/mix/layout/MixPanelSection/MixPanelSection.svelte";
	import {
		formatMixGoalValueComparison,
		getMixGoalStatusTone,
	} from "$lib/utils/mix/formatting/mixGoalPresentation";
	import type { NutrientShapePanelProps } from "./types";

	let {
		nutrientAxisCount,
		actualGoalRatios,
		targetGoalRatios,
		nutrientLabels,
		nutrientValueLabels,
		nutrientAxisColors,
		actualFillColor,
		actualStrokeColor,
		nutrientGoalDifferences,
		delightMessage = null,
		open = true,
		onOpenChange,
	}: NutrientShapePanelProps = $props();

</script>

<MixPanelSection
	class="nutrient-shape-panel"
	ariaLabel="Nutrient shape"
	title="Nutrient shape"
	{open}
	{onOpenChange}
>
	<div class="nutrient-shape-panel__meta">
		<div class="nutrient-shape-panel__legend" aria-label="Chart legend">
			<span><i class="goal"></i>Goal</span>
			<span><i class="actual"></i>Actual</span>
		</div>
	</div>
	<div
		class="nutrient-shape-panel__chart"
		class:nutrient-shape-panel__chart--simple={nutrientAxisCount <= 6}
		data-tutorial-target="mix-result-chart"
	>
		<NutrientRadarChart
			{nutrientAxisCount}
			{actualGoalRatios}
			{targetGoalRatios}
			{nutrientLabels}
			{nutrientValueLabels}
			showValueLabels={false}
			{nutrientAxisColors}
			{actualFillColor}
			{actualStrokeColor}
			fullWidth
		/>
	</div>
	{#if nutrientGoalDifferences.length > 0}
		<div
			class="nutrient-shape-panel__statuses"
			aria-label="Nutrient goal status"
		>
			{#each nutrientGoalDifferences as diff}
				<span
					data-nutrient-label={diff.label}
					data-goal-status={diff.status}
				>
					<MetadataPill
						label={diff.label.replace("Total ", "")}
						value={formatMixGoalValueComparison(
							diff.total,
							{
								goalType: diff.goalType,
								targetAmount: diff.goal,
								upperAmount: diff.upperGoal,
							},
							diff.unit,
						)}
						tone={getMixGoalStatusTone(diff.status)}
					/>
				</span>
			{/each}
		</div>
	{/if}
	{#if delightMessage}
		<SecondaryDelightMessage
			class="nutrient-shape-panel__delight"
			message={delightMessage}
		/>
	{/if}
</MixPanelSection>

<style lang="scss">
	@use "./NutrientShapePanel.scss";
</style>
