<script lang="ts">
	import type { ViewBodyProps } from "./types";

	let {
		className = "",
		scroll = false,
		children,
	}: ViewBodyProps = $props();
</script>

<div
	class={["view-body", className].filter(Boolean).join(" ")}
	class:view-body--scroll={scroll}
>
	{@render children()}
</div>

<style lang="scss">
	@use "./ViewBody.scss";
</style>
