<script lang="ts">
	import CenteredIcon from "$lib/components/common/icons/CenteredIcon/CenteredIcon.svelte";
	import type { CircularMediaFrameProps } from "./types";

	let {
		class: className = "",
		label = undefined,
		children,
	}: CircularMediaFrameProps = $props();
</script>

<span
	class={`circular-media-frame ${className}`.trim()}
	role={label ? "img" : undefined}
	aria-label={label}
>
	<CenteredIcon>
		{#if children}
			{@render children()}
		{/if}
	</CenteredIcon>
</span>

<style lang="scss">
	@use "./CircularMediaFrame.scss";
</style>
