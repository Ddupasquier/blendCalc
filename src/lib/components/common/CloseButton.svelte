<script lang="ts">
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
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<path d="M6 6l12 12M18 6L6 18" />
	</svg>
</button>

<style lang="scss">
	@use "../../../styles/variables" as *;

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

		svg {
			width: 52%;
			height: 52%;
			fill: none;
			stroke: currentColor;
			stroke-linecap: round;
			stroke-width: 2.4;
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
