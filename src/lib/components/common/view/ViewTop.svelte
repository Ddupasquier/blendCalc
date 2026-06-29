<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		className = "",
		children,
	}: {
		className?: string;
		children: Snippet;
	} = $props();
</script>

<div class={["view-top", className].filter(Boolean).join(" ")}>
	{@render children()}
</div>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.view-top {
		display: grid;
		flex: 0 0 auto;
		gap: $app-vertical-stack-gap;
		min-width: 0;
	}
</style>
