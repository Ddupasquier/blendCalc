<script lang="ts">
	import type { CenteredIconProps } from "./types";

	let {
		class: className = "",
		children,
	}: CenteredIconProps = $props();
</script>

<span class={`centered-icon ${className}`.trim()}>
	{#if children}
		{@render children()}
	{/if}
</span>

<style lang="scss">
	@use "./CenteredIcon.scss";
</style>
