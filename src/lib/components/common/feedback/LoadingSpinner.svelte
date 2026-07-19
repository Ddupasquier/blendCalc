<script lang="ts">
	import type { LoadingSpinnerProps } from "$lib/components/common/feedback/types";

	let {
		size = "medium",
		label = "Loading",
		showLabel = false,
		decorative = false,
		class: className = "",
	}: LoadingSpinnerProps = $props();
</script>

<span
	class={`loading-spinner ${className}`.trim()}
	data-size={size}
	role={decorative ? undefined : "status"}
	aria-live={decorative ? undefined : "polite"}
	aria-label={!decorative && !showLabel ? label : undefined}
	aria-hidden={decorative ? "true" : undefined}
>
	<span class="loading-spinner__ring" aria-hidden="true"></span>
	{#if showLabel}
		<span class="loading-spinner__label">{label}</span>
	{/if}
</span>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.loading-spinner {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: $app-gap-xs;
		min-width: 0;
		color: currentColor;
		font-family: $app-font-family-interface;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
		line-height: 1;
	}

	.loading-spinner__ring {
		display: block;
		box-sizing: border-box;
		flex: 0 0 auto;
		width: $app-loading-spinner-size-md;
		height: $app-loading-spinner-size-md;
		border: $app-loading-spinner-border-width solid
			color-mix(in srgb, currentColor 28%, transparent);
		border-top-color: currentColor;
		border-radius: $app-radius-circle;
		animation: shared-loading-spin $app-loading-spinner-duration linear infinite;
	}

	.loading-spinner[data-size="small"] .loading-spinner__ring {
		width: $app-loading-spinner-size-sm;
		height: $app-loading-spinner-size-sm;
	}

	.loading-spinner[data-size="large"] .loading-spinner__ring {
		width: $app-loading-spinner-size-lg;
		height: $app-loading-spinner-size-lg;
	}

	.loading-spinner__label {
		min-width: 0;
	}

	@keyframes shared-loading-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.loading-spinner__ring {
			animation-duration: calc($app-loading-spinner-duration * 2);
		}
	}
</style>
