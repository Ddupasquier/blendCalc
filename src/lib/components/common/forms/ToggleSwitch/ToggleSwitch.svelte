<script lang="ts">
	import type { ToggleSwitchProps } from "./types";

	let {
		id,
		name = id,
		checked = false,
		disabled = false,
		ariaLabel,
		onChange,
	}: ToggleSwitchProps = $props();
</script>

<span class="toggle-switch" class:toggle-switch--disabled={disabled}>
	<input
		{id}
		{name}
		class="toggle-switch__input"
		type="checkbox"
		role="switch"
		aria-label={ariaLabel}
		{checked}
		{disabled}
		onchange={(event) => {
			const nextChecked = event.currentTarget.checked;
			event.currentTarget.checked = checked;
			onChange?.(nextChecked);
		}}
	/>
	<span class="toggle-switch__track" aria-hidden="true">
		<span class="toggle-switch__thumb"></span>
	</span>
</span>

<style lang="scss">
	@use "./ToggleSwitch.scss";
</style>
