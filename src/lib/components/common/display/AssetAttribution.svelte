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
	@use "../../../../styles/variables" as *;

	.asset-attribution {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: $app-gap-2xs;
		margin: 0;
		color: $app-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-medium;
		line-height: $app-button-line-height;
		text-align: center;

		a {
			color: inherit;
			font-weight: $app-font-weight-bold;

			&:focus-visible {
				outline: $app-focus-outline;
				outline-offset: $app-focus-outline-offset;
			}
		}
	}
</style>
