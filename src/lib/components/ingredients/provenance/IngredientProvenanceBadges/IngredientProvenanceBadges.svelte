<script lang="ts">
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import VerifiedStatusBadge from "$lib/components/common/badges/VerifiedStatusBadge/VerifiedStatusBadge.svelte";
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
	@use "./IngredientProvenanceBadges.scss";
</style>
