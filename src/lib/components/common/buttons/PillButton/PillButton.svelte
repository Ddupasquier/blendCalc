<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import type { PillButtonProps } from "./types";

	let {
		type = "button",
		variant = "neutral",
		pressed = undefined,
		busy = false,
		disabled = false,
		fullWidth = false,
		ariaLabel,
		onclick,
		children,
	}: PillButtonProps = $props();
</script>

<button
	{type}
	class="pill-button"
	class:pill-button--full={fullWidth}
	data-variant={variant}
	aria-label={ariaLabel}
	aria-pressed={pressed}
	aria-busy={busy}
	disabled={disabled || busy}
	{onclick}
>
	{#if busy}
		<LoadingSpinner size="small" decorative />
	{/if}
	{#if children}
		{@render children()}
	{/if}
</button>

<style lang="scss">
	@use "./PillButton.scss";
</style>
