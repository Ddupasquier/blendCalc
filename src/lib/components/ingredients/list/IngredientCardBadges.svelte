<script lang="ts">
	import WarningTriangle from "$lib/assets/icons/WarningTriangle.svelte";
	import StatusIconBadge from "$lib/components/common/badges/StatusIconBadge.svelte";
import type { IngredientCardBadgesProps } from "./types";

	let {
		sourceBadge,
		trustBadge = null,
		warning = null,
	}: IngredientCardBadgesProps = $props();
</script>

<span class="ingredient-card-badges">
	{#if sourceBadge}
		<span
			class="ingredient-card-badge"
			data-tone={sourceBadge.tone}
			aria-label={`Source: ${sourceBadge.label}`}
		>
			{sourceBadge.label}
		</span>
	{/if}
	{#if trustBadge}
		<span
			class="ingredient-card-badge"
			data-tone={trustBadge.tone}
			aria-label={`Review status: ${trustBadge.label}`}
		>
			{trustBadge.label}
		</span>
	{/if}
	{#if warning}
		<StatusIconBadge
			label={`${warning}. Open ingredient for details.`}
			title={warning}
		>
			<WarningTriangle strokeWidth={2.7} />
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

	.ingredient-card-badge {
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

	.ingredient-card-badge[data-tone="custom"] {
		color: $app-custom-strong;
		background: color-mix(in srgb, $app-custom-bg 55%, $ingredient-surface-card);
	}

	.ingredient-card-badge[data-tone="success"] {
		color: $ingredient-accent-primary;
		background: $ingredient-surface-positive;
	}

	.ingredient-card-badge[data-tone="neutral"] {
		color: $ingredient-text-muted;
		background: $ingredient-surface-control;
	}

</style>
