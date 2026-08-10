<script lang="ts">
	import type { ViewTopProps } from "./types";

	let {
		className = "",
		compactHidden = false,
		children,
	}: ViewTopProps = $props();
</script>

<div
	class={["view-top", className].filter(Boolean).join(" ")}
	class:view-top--compact-hidden={compactHidden}
>
	<div class="view-top__content">
		{@render children()}
	</div>
</div>

<style lang="scss">
	@use "./ViewTop.scss";
</style>
