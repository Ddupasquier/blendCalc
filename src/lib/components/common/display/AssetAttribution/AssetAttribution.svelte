<script lang="ts">
	import type { AssetAttributionProps } from "./types";

	let {
		label = "Image",
		attributionText,
		licenseName,
		licenseUrl,
	}: AssetAttributionProps = $props();
</script>

{#if attributionText || licenseName}
	<p class="asset-attribution">
		{#if attributionText}
			<span>{label}: {attributionText}</span>
		{:else}
			<span>{label} license</span>
		{/if}
		{#if licenseName}
			<span aria-hidden="true">·</span>
			{#if licenseUrl}
				<a
					href={licenseUrl}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={`${licenseName} (opens in a new tab)`}
				>
					{licenseName}<span class="sr-only"> (opens in a new tab)</span>
				</a>
			{:else}
				<span>{licenseName}</span>
			{/if}
		{/if}
	</p>
{/if}

<style lang="scss">
	@use "./AssetAttribution.scss";
</style>
