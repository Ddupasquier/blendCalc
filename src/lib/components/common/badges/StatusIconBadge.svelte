<script lang="ts">
	import type { StatusIconBadgeProps } from "$lib/components/common/badges/types";

	let {
		label,
		title = undefined,
		tone = "warning",
		decorative = false,
		children,
	}: StatusIconBadgeProps = $props();
</script>

<span
	class="status-icon-badge"
	data-tone={tone}
	role={decorative ? undefined : "img"}
	aria-hidden={decorative ? "true" : undefined}
	aria-label={decorative ? undefined : label}
	{title}
>
	{@render children()}
</span>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.status-icon-badge {
		display: inline-grid;
		place-items: center;
		box-sizing: border-box;
		flex: 0 0 auto;
		width: $app-status-icon-badge-size;
		height: $app-status-icon-badge-size;
		font-size: $app-status-icon-badge-icon-size;
		line-height: 1;
		border: 1px solid transparent;
		border-radius: $app-radius-circle;
	}

	.status-icon-badge[data-tone="warning"] {
		color: $app-warning-strong;
		background: color-mix(in srgb, $app-highlight 22%, $app-warning-bg);
		border-color: color-mix(in srgb, $app-highlight 70%, $app-warning-border-color);
	}

	.status-icon-badge[data-tone="error"] {
		color: $app-danger-action;
		background: $ingredient-status-error-bg;
	}

	.status-icon-badge :global(svg) {
		display: block;
		width: 1em;
		height: 1em;
	}
</style>
