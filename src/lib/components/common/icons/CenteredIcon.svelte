<script lang="ts">
	import type { CenteredIconProps } from "$lib/components/common/icons/types";

	let {
		class: className = "",
		children,
	}: CenteredIconProps = $props();
</script>

<span class={`centered-icon ${className}`.trim()}>
	{#if children}
		{@render children()}
	{/if}
</span>

<style lang="scss">
	.centered-icon {
		display: inline-grid;
		place-items: center;
		place-self: center;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		line-height: 1;
		transform: translate(
			var(--centered-icon-optical-offset-x, 0),
			var(--centered-icon-optical-offset-y, 0)
		);
	}

	.centered-icon :global(svg),
	.centered-icon :global(img) {
		display: block;
		place-self: center;
		flex: 0 0 auto;
	}
</style>
