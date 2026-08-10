<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import CenteredIcon from "$lib/components/common/icons/CenteredIcon/CenteredIcon.svelte";
	import type { IconControlButtonProps } from "./types";

	let {
		type = "button",
		label,
		active = false,
		busy = false,
		disabled = false,
		class: className = "",
		"aria-expanded": ariaExpanded = undefined,
		"aria-controls": ariaControls = undefined,
		onclick,
		children,
	}: IconControlButtonProps = $props();
</script>

<button
	{type}
	class={`icon-control-button ${className}`.trim()}
	class:icon-control-button--active={active}
	aria-label={label}
	aria-busy={busy}
	aria-expanded={ariaExpanded}
	aria-controls={ariaControls}
	disabled={disabled || busy}
	{onclick}
>
	<CenteredIcon>
		{#if busy}
			<LoadingSpinner size="small" decorative />
		{:else if children}
			{@render children()}
		{/if}
	</CenteredIcon>
</button>

<style lang="scss">
	@use "./IconControlButton.scss";
</style>
