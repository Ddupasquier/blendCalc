<script lang="ts">
	import X from "$lib/assets/icons/X.svelte";

	let {
		label = "Close",
		size = "medium",
		disabled = false,
		onclick,
		class: className = "",
	}: {
		label?: string;
		size?: "small" | "medium";
		disabled?: boolean;
		onclick?: (event: MouseEvent) => void;
		class?: string;
	} = $props();
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
		border-radius: 50%;

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: 2px;
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.55;
		}

		:global(.close-button__icon) {
			width: 52%;
			height: 52%;
		}
	}

	.close-button--small {
		width: 1.75rem;
		height: 1.75rem;
	}

	.close-button--medium {
		width: 2.15rem;
		height: 2.15rem;
	}
</style>
