<script lang="ts">
	import X from "$lib/assets/icons/X/X.svelte";
	import CenteredIcon from "$lib/components/common/icons/CenteredIcon/CenteredIcon.svelte";
	import type { CloseButtonProps } from "./types";

	let {
		label = "Close",
		size = "medium",
		disabled = false,
		onclick,
		class: className = "",
	}: CloseButtonProps = $props();
</script>

<button
	type="button"
	class={`close-button close-button--${size} ${className}`.trim()}
	aria-label={label}
	title={label}
	{disabled}
	{onclick}
>
	<CenteredIcon>
		<X class="close-button__icon" />
	</CenteredIcon>
</button>

<style lang="scss">
	@use "./CloseButton.scss";
</style>
