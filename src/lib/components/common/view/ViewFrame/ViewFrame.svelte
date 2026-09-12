<script lang="ts">
	import type { ViewFrameProps } from "./types";

	let {
		appShell = false,
		className = "",
		fullWidth = false,
		children,
	}: ViewFrameProps = $props();
</script>

<div
	class={["view-frame", className].filter(Boolean).join(" ")}
	class:view-frame--app-shell={appShell}
	class:view-frame--full-width={fullWidth}
>
	{@render children()}
</div>

<style lang="scss">
	@use "./ViewFrame.scss";
</style>
