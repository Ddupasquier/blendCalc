<script lang="ts">
	import type { ViewFrameProps } from "./types";

	let {
		appShell = false,
		className = "",
		children,
	}: ViewFrameProps = $props();
</script>

<div
	class={["view-frame", className].filter(Boolean).join(" ")}
	class:view-frame--app-shell={appShell}
>
	{@render children()}
</div>

<style lang="scss">
	@use "./ViewFrame.scss";
</style>
