<script lang="ts">
	import type { CardWarningEdgeProps } from "./types";

	let { tone = "warning" }: CardWarningEdgeProps = $props();
</script>

<span class="card-warning-edge" data-tone={tone} aria-hidden="true"></span>

<style lang="scss">
	@use "./CardWarningEdge.scss";
</style>
