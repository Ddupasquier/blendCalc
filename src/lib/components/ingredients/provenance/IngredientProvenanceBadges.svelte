<script lang="ts">
	import TextBadge from "$lib/components/common/badges/TextBadge.svelte";
	import VerifiedStatusBadge from "$lib/components/common/badges/VerifiedStatusBadge.svelte";
	import { getIngredientTrustBadge } from "$lib/utils/ingredients/ingredientProvenance";
	import type { IngredientProvenanceBadgesProps } from "./types";

	let {
		food,
		provenanceOptions = [],
	}: IngredientProvenanceBadgesProps = $props();

	const trustBadge = $derived(
		getIngredientTrustBadge(food, provenanceOptions),
	);
</script>

<span class="ingredient-provenance-badges">
	{#if trustBadge}
		{#if trustBadge.value === "verified"}
			<VerifiedStatusBadge label={trustBadge.label} />
		{:else}
			<TextBadge
				label={trustBadge.label}
				tone={trustBadge.tone}
				ariaLabel={`Verification status: ${trustBadge.label}`}
			/>
		{/if}
	{/if}
</span>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.ingredient-provenance-badges {
		display: flex;
		flex: 0 0 auto;
		flex-wrap: wrap;
		align-items: center;
		gap: $app-gap-badge-inline;
		width: fit-content;
		max-width: 100%;
		min-width: 0;
	}
</style>
