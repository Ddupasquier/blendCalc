<script lang="ts">
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import PointShape from "$lib/components/mix/insights/PointShape/PointShape.svelte";
	import MixPanelSection from "$lib/components/mix/layout/MixPanelSection/MixPanelSection.svelte";
	import { formatMixQuantity } from "$lib/utils/mix/formatting/mixQuantity";
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
		class:nutrient-shape-panel__chart--simple={points <= 6}
		data-tutorial-target="mix-result-chart"
	>
		<PointShape
			{points}
			{values}
			{goalValues}
			{labels}
			{valueLabels}
			showValueLabels={false}
			{pointColors}
			{fillColor}
			{strokeColor}
			fullWidth
		/>
	</div>
	{#if diffs.length > 0}
		<div
			class="nutrient-shape-panel__statuses"
			aria-label="Nutrient goal status"
		>
			{#each diffs as diff}
				<MetadataPill
					label={diff.label.replace("Total ", "")}
					value={`${formatMixQuantity(diff.total)} / ${formatMixQuantity(
						diff.goal,
						{ unit: diff.unit },
					)}`}
					tone={toneFor(diff.status)}
				/>
			{/each}
		</div>
	{/if}
</MixPanelSection>

<style lang="scss">
	@use "./NutrientShapePanel.scss";
</style>
