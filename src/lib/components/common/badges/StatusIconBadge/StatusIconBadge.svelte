<script lang="ts">
	import type { StatusIconBadgeProps } from "./types";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";

	let {
		label,
		title = undefined,
		tone = "warning",
		decorative = false,
		class: className = "",
		children,
	}: StatusIconBadgeProps = $props();
</script>

<CircularIconFrame
	class={`status-icon-badge ${className}`.trim()}
	dataTone={tone}
	{decorative}
	{label}
	{title}
>
	{@render children()}
</CircularIconFrame>

<style lang="scss">
	@use "./StatusIconBadge.scss";
</style>
