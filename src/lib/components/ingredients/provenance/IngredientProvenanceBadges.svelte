<script lang="ts">
	import WarningTriangle from "$lib/assets/icons/WarningTriangle.svelte";
	import StatusIconBadge from "$lib/components/common/badges/StatusIconBadge.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge.svelte";
	import {
		getIngredientSourceBadge,
		getIngredientTrustBadge,
	} from "$lib/utils/ingredients/ingredientProvenance";
	import type { IngredientProvenanceBadgesProps } from "./types";

	let {
		food,
		provenanceOptions = [],
		warning = null,
	}: IngredientProvenanceBadgesProps = $props();

	const sourceBadge = $derived(
		getIngredientSourceBadge(food, provenanceOptions),
	);
	const trustBadge = $derived(
		getIngredientTrustBadge(food, provenanceOptions),
	);
</script>

<span class="ingredient-provenance-badges">
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

	.ingredient-provenance-badges {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: $app-gap-badge-inline;
		width: 100%;
		min-width: 0;
	}
</style>
