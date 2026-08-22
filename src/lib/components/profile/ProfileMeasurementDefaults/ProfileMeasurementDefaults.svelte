<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import { getExactServingSizeConversionPreview } from "$lib/utils/profile/foodPreferences";
	import type { ProfileMeasurementDefaultsProps } from "./types";

	let {
		unitSystem,
		defaultServingSize,
		defaultServingUnit,
		disabled,
		onUnitSystemChange,
		onDefaultServingSizeChange,
		onDefaultServingUnitChange,
		onRestoreDefaults,
	}: ProfileMeasurementDefaultsProps = $props();

	const conversionPreview = $derived(
		getExactServingSizeConversionPreview(defaultServingSize, defaultServingUnit),
	);
	const hasOverrides = $derived(Boolean(unitSystem || defaultServingSize.trim()));
</script>

<div class="profile-measurement-defaults">
	<div class="profile-measurement-defaults__group">
		<SelectField
			id="profile-unit-system"
			name="unitSystem"
			label="Display units"
			value={unitSystem ?? ""}
			options={[
				{ value: "", label: "Use app defaults" },
				{ value: "metric", label: "Metric" },
				{ value: "us", label: "US units" },
			]}
			{disabled}
			onValueChange={(value) =>
				onUnitSystemChange(value === "metric" || value === "us" ? value : "")}
		/>
		<p>Controls the default weight unit shown for new Mix ingredients when no package serving is available.</p>
	</div>

	<div class="profile-measurement-defaults__group profile-measurement-defaults__serving">
		<span>Default Mix starting amount</span>
		<div>
			<NumberInput
				id="profile-default-serving-size"
				name="defaultMixServingSize"
				ariaLabel="Default Mix starting amount"
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
		<p>Used only when a selected food does not provide an exact serving.</p>
		{#if conversionPreview}
			<output for="profile-default-serving-size profile-default-serving-unit">
				{conversionPreview}
			</output>
		{/if}
	</div>

	{#if hasOverrides}
		<div class="profile-measurement-defaults__actions">
			<RoundedActionButton
				type="button"
				variant="quiet"
				{disabled}
				onclick={onRestoreDefaults}
			>
				Restore measurement defaults
			</RoundedActionButton>
		</div>
	{/if}
</div>

<style lang="scss">
	@use "./ProfileMeasurementDefaults.scss";
</style>
