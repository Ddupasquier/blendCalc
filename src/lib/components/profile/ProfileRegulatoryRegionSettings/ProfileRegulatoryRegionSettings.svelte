<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import type { ProfileRegulatoryRegionSettingsProps } from "./types";

	let {
		regulatoryRegionCode,
		regulatoryRegionSource,
		regulatoryRegionOptions,
		hasUnsupportedRegion,
		disabled,
		onRegulatoryRegionChange,
	}: ProfileRegulatoryRegionSettingsProps = $props();

	const selectedRegion = $derived(
		regulatoryRegionOptions.find(
			(option) => option.regionCode === regulatoryRegionCode,
		) ?? null,
	);
</script>

<div class="profile-regulatory-region-settings">
	<SelectField
		id="profile-regulatory-region"
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
			: "Adds regional package-label context without reducing your personal warnings."}
		{disabled}
		onValueChange={onRegulatoryRegionChange}
	/>
	{#if selectedRegion}
		<div class="profile-regulatory-region-settings__policy">
			<strong>{selectedRegion.authority}</strong>
			<span>
				{selectedRegion.policyVersion
					? `Food-safety policy version ${selectedRegion.policyVersion}`
					: "Current reviewed food-safety policy"}
			</span>
		</div>
		<RoundedActionButton
			type="button"
			variant="quiet"
			{disabled}
			onclick={() => onRegulatoryRegionChange("")}
		>
			Use personal settings only
		</RoundedActionButton>
	{/if}
</div>
<input type="hidden" name="regulatoryRegionSource" value={regulatoryRegionSource ?? ""} />

<style lang="scss">
	@use "./ProfileRegulatoryRegionSettings.scss";
</style>
