<script lang="ts">
	import type { StatusIconBadgeProps } from "$lib/components/common/badges/types";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame.svelte";

	let {
		label,
		title = undefined,
		tone = "warning",
		decorative = false,
		class: className = "",
		children,
	}: StatusIconBadgeProps = $props();
</script>

<CircularIconFrame
	class={`status-icon-badge ${className}`.trim()}
	dataTone={tone}
	{decorative}
	{label}
	{title}
>
	{@render children()}
</CircularIconFrame>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	:global(.status-icon-badge) {
		--circular-icon-frame-size: #{$app-status-icon-badge-size};
		--circular-icon-frame-icon-size: #{$app-status-icon-badge-icon-size};
	}

	:global(.status-icon-badge[data-tone="warning"]) {
		--circular-icon-frame-color: #{$app-warning-strong};
		--circular-icon-frame-background: color-mix(in srgb, #{$app-highlight} 22%, #{$app-warning-bg});
		--circular-icon-frame-border: 1px solid color-mix(in srgb, #{$app-highlight} 70%, #{$app-warning-border-color});
	}

	:global(.status-icon-badge[data-tone="info"]) {
		--circular-icon-frame-color: #{$app-primary};
		--circular-icon-frame-background: #{$app-accent};
	}

	:global(.status-icon-badge[data-tone="success"]) {
		--circular-icon-frame-color: #{$app-primary};
		--circular-icon-frame-background: #{$app-success-bg};
	}

	:global(.status-icon-badge[data-tone="error"]) {
		--circular-icon-frame-color: #{$app-danger-action};
		--circular-icon-frame-background: #{$app-status-error-bg};
	}
</style>
