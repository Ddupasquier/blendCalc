<script lang="ts">
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import type { ProfileMeasurementDefaultsProps } from "./types";

	let {
		unitSystem,
		defaultServingSize,
		defaultServingUnit,
		disabled,
		onUnitSystemChange,
		onDefaultServingSizeChange,
		onDefaultServingUnitChange,
	}: ProfileMeasurementDefaultsProps = $props();
</script>

<div class="profile-measurement-defaults">
	<SelectField
		id="profile-unit-system"
		name="unitSystem"
		label="Preferred units"
		value={unitSystem ?? ""}
		options={[
			{ value: "", label: "No preference" },
			{ value: "metric", label: "Metric" },
			{ value: "us", label: "US units" },
		]}
		{disabled}
		onValueChange={(value) =>
			onUnitSystemChange(value === "metric" || value === "us" ? value : "")}
	/>

	<div class="profile-measurement-defaults__serving">
		<span>Default Mix serving size</span>
		<div>
			<NumberInput
				id="profile-default-serving-size"
				name="defaultMixServingSize"
				min="0"
				step="0.01"
				value={defaultServingSize}
				placeholder="Optional"
				{disabled}
				onValueChange={onDefaultServingSizeChange}
			/>
			<SelectField
				id="profile-default-serving-unit"
				name="defaultMixServingUnit"
				label="Default serving unit"
				labelVisibility="sr-only"
				value={defaultServingUnit}
				options={[
					{ value: "g", label: "g" },
					{ value: "oz", label: "oz" },
				]}
				{disabled}
				onValueChange={(value) =>
					onDefaultServingUnitChange(value === "oz" ? "oz" : "g")}
			/>
		</div>
	</div>
</div>

<style lang="scss">
	@use "./ProfileMeasurementDefaults.scss";
</style>
