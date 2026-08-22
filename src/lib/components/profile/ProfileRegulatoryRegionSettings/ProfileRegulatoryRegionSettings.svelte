<script lang="ts">
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
</script>

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
<input type="hidden" name="regulatoryRegionSource" value={regulatoryRegionSource ?? ""} />
