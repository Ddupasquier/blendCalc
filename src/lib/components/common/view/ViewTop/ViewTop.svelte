<script lang="ts">
	import type { ViewTopProps } from "./types";

	let {
		className = "",
		children,
	}: ViewTopProps = $props();
</script>

<div class={["view-top", className].filter(Boolean).join(" ")}>
	{@render children()}
</div>

<style lang="scss">
	@use "./ViewTop.scss";
</style>
