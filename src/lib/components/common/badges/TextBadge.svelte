<script lang="ts">
	import type { TextBadgeProps } from "$lib/components/common/badges/types";

	let {
		label,
		ariaLabel = undefined,
		title = undefined,
		tone = "info",
		class: className = "",
	}: TextBadgeProps = $props();
</script>

<span
	class={`text-badge ${className}`.trim()}
	data-tone={tone}
	aria-label={ariaLabel}
	{title}
>
	<span class="text-badge__label">{label}</span>
</span>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	:global(.text-badge) {
		display: inline-grid;
		place-items: center;
		box-sizing: border-box;
		flex: 0 0 auto;
		min-width: 0;
		min-height: $app-text-badge-min-height;
		max-width: $app-text-badge-max-width;
		padding: $app-text-badge-padding-y $app-text-badge-padding-x;
		overflow: hidden;
		color: $app-text-badge-info-text;
		font-size: $app-text-badge-font-size;
		font-weight: $app-font-weight-heavy;
		line-height: $app-text-badge-line-height;
		text-align: center;
		text-transform: uppercase;
		vertical-align: middle;
		white-space: nowrap;
		background: $app-text-badge-info-bg;
		border-radius: $app-radius-pill;
	}

	:global(.text-badge__label) {
		display: block;
		max-width: 100%;
		overflow: hidden;
		line-height: inherit;
		text-overflow: ellipsis;
	}

	:global(.text-badge[data-tone="custom"]) {
		color: $app-text-badge-custom-text;
		background: $app-text-badge-custom-bg;
	}

	:global(.text-badge[data-tone="success"]) {
		color: $app-text-badge-success-text;
		background: $app-text-badge-success-bg;
	}

	:global(.text-badge[data-tone="neutral"]) {
		color: $app-text-badge-neutral-text;
		background: $app-text-badge-neutral-bg;
	}
</style>
