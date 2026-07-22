<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import CenteredIcon from "$lib/components/common/icons/CenteredIcon/CenteredIcon.svelte";
	import type { ActionButtonProps } from "./types";

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
		<CenteredIcon class="action-button__icon">
			<LoadingSpinner size="small" decorative />
		</CenteredIcon>
	{:else if leading}
		<CenteredIcon class="action-button__icon">{@render leading()}</CenteredIcon>
	{/if}
	<span class="action-button__label">
		{#if children}
			{@render children()}
		{/if}
	</span>
	{#if trailing && !busy}
		<CenteredIcon class="action-button__icon">{@render trailing()}</CenteredIcon>
	{/if}
</button>

<style lang="scss">
	@use "./ActionButton.scss";
</style>
