<script lang="ts">
	import CenteredIcon from "$lib/components/common/icons/CenteredIcon.svelte";
	import type { CircularIconFrameProps } from "$lib/components/common/icons/types";

	let {
		class: className = "",
		label = undefined,
		title = undefined,
		decorative = false,
		dataTone = undefined,
		children,
	}: CircularIconFrameProps = $props();
</script>

<span
	class={`circular-icon-frame ${className}`.trim()}
	role={!decorative && label ? "img" : undefined}
	aria-hidden={decorative ? "true" : undefined}
	aria-label={!decorative ? label : undefined}
	data-tone={dataTone}
	{title}
>
	<CenteredIcon>
		{#if children}
			{@render children()}
		{/if}
	</CenteredIcon>
</span>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.circular-icon-frame {
		display: inline-grid;
		place-items: center;
		box-sizing: border-box;
		flex: 0 0 auto;
		width: var(--circular-icon-frame-size, #{$app-status-icon-badge-size});
		height: var(--circular-icon-frame-size, #{$app-status-icon-badge-size});
		padding: 0;
		color: var(--circular-icon-frame-color, currentColor);
		background: var(--circular-icon-frame-background, transparent);
		border: var(--circular-icon-frame-border, 1px solid transparent);
		border-radius: $app-radius-circle;
		font-size: var(--circular-icon-frame-icon-size, #{$app-status-icon-badge-icon-size});
		line-height: 1;
	}

	.circular-icon-frame :global(svg) {
		width: 1em;
		height: 1em;
	}
</style>
