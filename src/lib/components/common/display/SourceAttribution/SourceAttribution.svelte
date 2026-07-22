<script lang="ts">
	import type { SourceAttributionProps } from "./types";

	let { label, dataType }: SourceAttributionProps = $props();
</script>

<p class="source-attribution">
	<span>Source: {label}</span>
	{#if dataType}
		<span aria-hidden="true">·</span>
		<span>{dataType}</span>
	{/if}
</p>

<style lang="scss">
	@use "./SourceAttribution.scss";
</style>
