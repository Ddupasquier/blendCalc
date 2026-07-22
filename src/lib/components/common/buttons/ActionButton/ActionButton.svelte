<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import type { ActionButtonProps } from "../types";

	let {
		type = "button",
		variant = "primary",
		size = "medium",
		fullWidth = false,
		busy = false,
		disabled = false,
		ariaLabel,
		onclick,
		children,
		leading,
		trailing,
	}: ActionButtonProps = $props();
</script>

<button
	{type}
	class="action-button"
	class:action-button--full={fullWidth}
	class:action-button--busy={busy}
	data-variant={variant}
	data-size={size}
	aria-label={ariaLabel}
	aria-busy={busy}
	disabled={disabled || busy}
	{onclick}
>
	{#if busy}
		<span class="action-button__icon">
			<LoadingSpinner size="small" decorative />
		</span>
	{:else if leading}
		<span class="action-button__icon" aria-hidden="true">{@render leading()}</span>
	{/if}
	<span class="action-button__label">
		{#if children}
			{@render children()}
		{/if}
	</span>
	{#if trailing && !busy}
		<span class="action-button__icon" aria-hidden="true">{@render trailing()}</span>
	{/if}
</button>

<style lang="scss">
	@use "./ActionButton.scss";
</style>
