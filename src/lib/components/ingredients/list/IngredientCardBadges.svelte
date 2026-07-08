<script lang="ts">
	import WarningTriangle from "$lib/assets/icons/WarningTriangle.svelte";

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
		<span class="warning-badge">
			<WarningTriangle size={10} strokeWidth={2.7} />
			{warning}
		</span>
	{/if}
</span>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.ingredient-card-badges {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: $app-gap-badge-inline;
		min-width: 0;
	}

	.source-badge,
	.warning-badge {
		display: inline-flex;
		align-items: center;
		gap: $app-gap-2xs;
		max-width: $ingredient-badge-max-width;
		padding: $ingredient-badge-padding-y $ingredient-badge-padding-x;
		overflow: hidden;
		font-size: $ingredient-badge-font-size;
		font-weight: $app-font-weight-heavy;
		line-height: $ingredient-badge-line-height;
		text-overflow: ellipsis;
		white-space: nowrap;
		border-radius: $app-radius-pill;
	}

	.source-badge {
		color: color-mix(in srgb, $ingredient-accent-info 72%, $ingredient-text-primary);
		text-transform: uppercase;
		background: color-mix(in srgb, $ingredient-accent-info 18%, $ingredient-surface-card);
	}

	.source-badge--custom {
		color: $app-custom-strong;
		background: color-mix(in srgb, $app-custom-bg 55%, $ingredient-surface-card);
	}

	.warning-badge {
		color: $app-warning-strong;
		background: color-mix(in srgb, $app-highlight 22%, $app-warning-bg);
		border: 1px solid
			color-mix(in srgb, $app-highlight 70%, $app-warning-border-color);
	}
</style>
