<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		className = "",
		scroll = false,
		children,
	}: {
		className?: string;
		scroll?: boolean;
		children: Snippet;
	} = $props();
</script>

<div
	class={["view-body", className].filter(Boolean).join(" ")}
	class:view-body--scroll={scroll}
>
	{@render children()}
</div>

<style lang="scss">
	.view-body {
		flex: 1 1 auto;
		width: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		box-sizing: border-box;
	}

	.view-body--scroll {
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}
</style>
