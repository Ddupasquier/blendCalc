<script lang="ts">
	import WarningTriangle from "$lib/assets/icons/WarningTriangle.svelte";
	import StatusIconBadge from "$lib/components/common/badges/StatusIconBadge.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge.svelte";
	import type { IngredientCardBadgesProps } from "./types";

	let {
		sourceBadge,
		trustBadge = null,
		warning = null,
	}: IngredientCardBadgesProps = $props();
</script>

<span class="ingredient-card-badges">
	{#if sourceBadge}
		<TextBadge
			label={sourceBadge.label}
			tone={sourceBadge.tone}
			ariaLabel={`Source: ${sourceBadge.label}`}
		/>
	{/if}
	{#if trustBadge}
		<TextBadge
			label={trustBadge.label}
			tone={trustBadge.tone}
			ariaLabel={`Review status: ${trustBadge.label}`}
		/>
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

</style>
