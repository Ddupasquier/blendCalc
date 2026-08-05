<script lang="ts">
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import PointShape from "$lib/components/mix/insights/PointShape/PointShape.svelte";
	import { formatChartNumber } from "$lib/utils/mix/ui/mixUi";
	import type { NutrientShapePanelProps } from "./types";

	let {
		points,
		values,
		goalValues,
		labels,
		valueLabels,
		pointColors,
		fillColor,
		strokeColor,
		diffs,
		open = true,
		onOpenChange,
	}: NutrientShapePanelProps = $props();

	const toneFor = (status: "met" | "over" | "under") =>
		status === "met" ? "success" : status === "over" ? "danger" : "warning";
</script>

<section class="nutrient-shape-panel" aria-label="Nutrient shape">
	<CollapsibleSection
		title="Nutrient shape"
		{open}
		{onOpenChange}
		surface="panel"
	>
		<div class="nutrient-shape-panel__meta">
		<div class="nutrient-shape-panel__legend" aria-label="Chart legend">
			<span><i class="goal"></i>Goal</span>
			<span><i class="actual"></i>Actual</span>
		</div>
		</div>
		<div
			class="nutrient-shape-panel__chart"
			class:nutrient-shape-panel__chart--simple={points <= 6}
			data-tutorial-target="mix-result-chart"
		>
			<PointShape
				{points}
				{values}
				{goalValues}
				{labels}
				{valueLabels}
				{pointColors}
				{fillColor}
				{strokeColor}
				fullWidth
			/>
		</div>
		{#if diffs.length > 0}
			<div class="nutrient-shape-panel__statuses" aria-label="Nutrient goal status">
				{#each diffs as diff}
					<MetadataPill
						label={diff.label.replace("Total ", "")}
						value={`${formatChartNumber(diff.total)}/${formatChartNumber(diff.goal)}${diff.unit}`}
						tone={toneFor(diff.status)}
					/>
				{/each}
			</div>
		{/if}
	</CollapsibleSection>
</section>

<style lang="scss">
	@use "./NutrientShapePanel.scss";
</style>
