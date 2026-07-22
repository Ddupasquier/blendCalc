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

<footer class={["view-footer", className].filter(Boolean).join(" ")}>
	{@render children()}
</footer>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.view-footer {
		display: grid;
		gap: $app-gap-md;
		min-width: 0;
		padding-top: $app-gap-sm;
		background: inherit;
	}
</style>
