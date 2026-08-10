<script lang="ts">
	import type { ThemePreference } from "$lib/utils/theme/themePreference";
	import type { ThemePreferenceControlProps } from "./types";

	let {
		value,
		disabled = false,
		onSelect,
	}: ThemePreferenceControlProps = $props();

	const options: Array<{
		value: ThemePreference;
		label: string;
		description: string;
	}> = [
		{
			value: "system",
			label: "Device",
			description: "Match this device",
		},
		{
			value: "light",
			label: "Light",
			description: "Always use light",
		},
		{
			value: "dark",
			label: "Dark",
			description: "Always use dark",
		},
	];
</script>

<fieldset class="theme-preference-control">
	<legend>Color theme</legend>
	<div class="theme-preference-control__options">
		{#each options as option (option.value)}
			<label
				class="theme-preference-control__option"
				class:theme-preference-control__option--selected={value === option.value}
			>
				<input
					type="radio"
					name="appearanceTheme"
					value={option.value}
					checked={value === option.value}
					disabled={disabled}
					onchange={() => onSelect(option.value)}
				/>
				<span class="theme-preference-control__preview" data-theme-preview={option.value}>
					<span aria-hidden="true"></span>
				</span>
				<span class="theme-preference-control__copy">
					<strong>{option.label}</strong>
					<small>{option.description}</small>
				</span>
			</label>
		{/each}
	</div>
</fieldset>

<style lang="scss">
	@use "./ThemePreferenceControl.scss";
</style>
