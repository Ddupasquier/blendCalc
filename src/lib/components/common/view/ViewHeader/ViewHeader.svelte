<script lang="ts">
	import type { ViewHeaderProps } from "./types";

	let {
		title,
		subtitle,
		titleId,
		children,
	}: ViewHeaderProps = $props();
</script>

<header class="view-header">
	<h1 id={titleId}>{title}</h1>
	{#if subtitle}
		<p>{subtitle}</p>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</header>

<style lang="scss">
	@use "./ViewHeader.scss";
</style>
