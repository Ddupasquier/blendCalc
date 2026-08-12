<script lang="ts">
	import CheckboxGroup from "$lib/components/common/forms/CheckboxGroup/CheckboxGroup.svelte";
	import type { ProfileNutrientPrioritySettingsProps } from "./types";

	let {
		options,
		selectedNutrientIds,
		disabled,
		onSelectionChange,
	}: ProfileNutrientPrioritySettingsProps = $props();
</script>

<fieldset class="profile-nutrient-priority-settings">
	<legend>Highlight these nutrients</legend>
	<p>Choose the nutrients you want to notice first in Mix and food details.</p>
	<CheckboxGroup
		id="profile-priority-nutrient"
		name="prioritizedNutrientIds"
		options={options.map((nutrient) => ({
			id: nutrient.id,
			label: nutrient.label,
		}))}
		selected={selectedNutrientIds}
		{disabled}
		onChange={(values) =>
			onSelectionChange(values.map(Number).filter(Number.isInteger))}
	/>
</fieldset>

<style lang="scss">
	@use "./ProfileNutrientPrioritySettings.scss";
</style>
