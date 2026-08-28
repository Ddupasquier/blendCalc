<script lang="ts">
	import type { CardWarningFrameProps } from "./types";

	let { tone = "warning" }: CardWarningFrameProps = $props();
</script>

<span class="card-warning-frame" data-tone={tone} aria-hidden="true"></span>

<style lang="scss">
	@use "./CardWarningFrame.scss";
</style>
