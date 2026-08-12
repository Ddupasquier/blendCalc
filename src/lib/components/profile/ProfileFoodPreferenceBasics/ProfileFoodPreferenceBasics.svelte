<script lang="ts">
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import type { ProfileFoodPreferenceBasicsProps } from "./types";

	let {
		regulatoryRegionCode,
		regulatoryRegionSource,
		regulatoryRegionOptions,
		hasUnsupportedRegion,
		unitSystem,
		defaultServingSize,
		defaultServingUnit,
		disabled,
		onRegulatoryRegionChange,
	}: ProfileFoodPreferenceBasicsProps = $props();
</script>

<div class="profile-food-preference-basics">
	<SelectField
		id="profile-regulatory-region"
		class="profile-food-preference-basics__region"
		name="regulatoryRegionCode"
		label="Package-label region"
		value={regulatoryRegionCode}
		options={[
			{ value: "", label: "Personal settings only" },
			...(hasUnsupportedRegion
				? [{
					value: regulatoryRegionCode,
					label: `Previously saved region unavailable (${regulatoryRegionCode})`,
					disabled: true,
				}]
				: []),
			...regulatoryRegionOptions.map((option) => ({
				value: option.regionCode,
				label: option.displayName,
			})),
		]}
		helper={regulatoryRegionSource === "device"
			? "Suggested from this device. Saving keeps it with your account."
			: "Adds regional label context without removing any personal warning."}
		{disabled}
		onValueChange={onRegulatoryRegionChange}
	/>
	<input type="hidden" name="regulatoryRegionSource" value={regulatoryRegionSource ?? ""} />

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
	/>

	<div class="profile-food-preference-basics__serving">
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
			/>
		</div>
	</div>
</div>

<style lang="scss">
	@use "./ProfileFoodPreferenceBasics.scss";
</style>
