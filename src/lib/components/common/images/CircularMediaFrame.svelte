<script lang="ts">
	import CenteredIcon from "$lib/components/common/icons/CenteredIcon.svelte";
	import type { CircularMediaFrameProps } from "$lib/components/common/images/types";

	let {
		class: className = "",
		label = undefined,
		children,
	}: CircularMediaFrameProps = $props();
</script>

<span
	class={`circular-media-frame ${className}`.trim()}
	role={label ? "img" : undefined}
	aria-label={label}
>
	<CenteredIcon>
		{#if children}
			{@render children()}
		{/if}
	</CenteredIcon>
</span>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.circular-media-frame {
		display: inline-grid;
		place-items: center;
		box-sizing: border-box;
		flex: 0 0 auto;
		width: var(--circular-media-frame-size, #{$app-shell-leading-icon-size});
		height: var(--circular-media-frame-size, #{$app-shell-leading-icon-size});
		overflow: hidden;
		color: var(--circular-media-frame-color, currentColor);
		background: var(--circular-media-frame-background, #{$app-shell-accent-soft});
		border: var(--circular-media-frame-border, 1px solid transparent);
		border-radius: $app-radius-circle;
		font-size: var(--circular-media-frame-font-size, #{$app-font-size-xl});
		line-height: 1;
	}
</style>
