<script lang="ts">
	import CheckboxGroup from "$lib/components/common/forms/CheckboxGroup/CheckboxGroup.svelte";
	import NutrientPicker from "$lib/components/mix/controls/NutrientPicker/NutrientPicker.svelte";
	import type { NutrientSelectorProps } from "./types";

	let {
		options,
		selected,
		selectedCount,
		onChange,
		onAddNutrient,
	}: NutrientSelectorProps = $props();

</script>

<section class="setup-card setup-card--nutrients">
	<div class="panel-header">
		<div>
			<h3 id="nutrient-controls-title">Nutrients</h3>
			<p>{selectedCount} selected for the graph</p>
		</div>
		<NutrientPicker excludedIds={options.map((option) => option.id)} onSelect={onAddNutrient} />
	</div>

	<div class="mix-nutrients" aria-label="Selected nutrients">
		<CheckboxGroup {options} {selected} onChange={onChange} />
	</div>
</section>

<style lang="scss">
	@use "./NutrientSelector.scss";
</style>
