<script lang="ts">
	import CenteredIcon from "$lib/components/common/icons/CenteredIcon/CenteredIcon.svelte";
	import type { CircularIconFrameProps } from "./types";

	let {
		class: className = "",
		label = undefined,
		title = undefined,
		decorative = false,
		dataTone = undefined,
		children,
	}: CircularIconFrameProps = $props();
</script>

<span
	class={`circular-icon-frame ${className}`.trim()}
	role={!decorative && label ? "img" : undefined}
	aria-hidden={decorative ? "true" : undefined}
	aria-label={!decorative ? label : undefined}
	data-tone={dataTone}
	{title}
>
	<CenteredIcon>
		{#if children}
			{@render children()}
		{/if}
	</CenteredIcon>
</span>

<style lang="scss">
	@use "./CircularIconFrame.scss";
</style>
