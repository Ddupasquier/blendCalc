<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import type { RoundedActionButtonProps } from "./types";

	let {
		element = $bindable(),
		id,
		type = "button",
		variant = "primary",
		contentAlign = "center",
		fullWidth = false,
		busy = false,
		disabled = false,
		ariaLabel,
		formAction,
		formNoValidate = false,
		"aria-controls": ariaControls = undefined,
		"aria-describedby": ariaDescribedBy = undefined,
		"aria-expanded": ariaExpanded = undefined,
		"aria-pressed": ariaPressed = undefined,
		onclick,
		children,
	}: RoundedActionButtonProps = $props();
</script>

<button
	bind:this={element}
	{id}
	{type}
	class="rounded-action-button"
	class:rounded-action-button--full={fullWidth}
	data-variant={variant}
	data-content-align={contentAlign}
	aria-label={ariaLabel}
	formaction={formAction}
	formnovalidate={formNoValidate}
	aria-busy={busy}
	aria-controls={ariaControls}
	aria-describedby={ariaDescribedBy}
	aria-expanded={ariaExpanded}
	aria-pressed={ariaPressed}
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
	@use "./RoundedActionButton.scss";
</style>
