<script lang="ts">
	import type { ViewBodyProps } from "./types";

	let {
		className = "",
		scroll = false,
		element = $bindable(null),
		children,
	}: ViewBodyProps = $props();
</script>

<div
	bind:this={element}
	class={["view-body", className].filter(Boolean).join(" ")}
	class:view-body--scroll={scroll}
>
	{@render children()}
</div>

<style lang="scss">
	@use "./ViewBody.scss";
</style>
