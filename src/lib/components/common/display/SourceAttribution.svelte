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
	@use "../../../../styles/variables" as *;

	.source-attribution {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: $app-gap-2xs;
		margin: 0;
		color: $app-muted;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-medium;
		line-height: $app-button-line-height;
	}
</style>
