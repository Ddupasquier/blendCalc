<script lang="ts">
	import WarningTriangle from "$lib/assets/icons/WarningTriangle.svelte";
	import StatusIconBadge from "$lib/components/common/badges/StatusIconBadge.svelte";

	let {
		custom = false,
		sourceLabel,
		warning = null,
	}: {
		custom?: boolean;
		sourceLabel: string;
		warning?: string | null;
	} = $props();
</script>

<span class="ingredient-card-badges">
	<span class="source-badge" class:source-badge--custom={custom}>
		{sourceLabel}
	</span>
	{#if warning}
		<StatusIconBadge
			label={`${warning}. Open ingredient for details.`}
			title={warning}
		>
			<WarningTriangle size="1em" strokeWidth={2.7} />
		</StatusIconBadge>
	{/if}
</span>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.ingredient-card-badges {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: $app-gap-badge-inline;
		width: 100%;
		min-width: 0;
	}

	.source-badge {
		display: inline-flex;
		align-items: center;
		box-sizing: border-box;
		gap: $app-gap-2xs;
		max-width: $ingredient-badge-max-width;
		padding: $ingredient-badge-padding-y $ingredient-badge-padding-x;
		overflow: hidden;
		color: color-mix(in srgb, $ingredient-accent-info 72%, $ingredient-text-primary);
		font-size: $ingredient-badge-font-size;
		font-weight: $app-font-weight-heavy;
		line-height: $ingredient-badge-line-height;
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
		background: color-mix(in srgb, $ingredient-accent-info 18%, $ingredient-surface-card);
		border-radius: $app-radius-pill;
	}

	.source-badge--custom {
		color: $app-custom-strong;
		background: color-mix(in srgb, $app-custom-bg 55%, $ingredient-surface-card);
	}

</style>
