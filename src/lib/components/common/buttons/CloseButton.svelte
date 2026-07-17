<script lang="ts">
	import X from "$lib/assets/icons/X.svelte";
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
	<X class="close-button__icon" />
</button>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.close-button {
		display: inline-grid;
		place-items: center;
		flex: 0 0 auto;
		padding: 0;
		color: $app-primary;
		background: $app-accent;
		border-radius: $app-radius-circle;

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: 2px;
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.55;
		}

		:global(.close-button__icon) {
			display: block;
			width: $app-close-button-icon-scale;
			height: $app-close-button-icon-scale;
		}
	}

	.close-button--small {
		width: $app-close-button-size-sm;
		height: $app-close-button-size-sm;
	}

	.close-button--medium {
		width: $app-close-button-size-md;
		height: $app-close-button-size-md;
	}
</style>
