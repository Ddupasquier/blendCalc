<script lang="ts">
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import VerifiedStatusBadge from "$lib/components/common/badges/VerifiedStatusBadge/VerifiedStatusBadge.svelte";
	import { getIngredientTrustBadge } from "$lib/utils/ingredients/ingredientProvenance";
	import type { IngredientProvenanceBadgesProps } from "./types";

	let {
		food,
		provenanceOptions = [],
		variant = "detail",
	}: IngredientProvenanceBadgesProps = $props();

	const trustBadge = $derived(
		getIngredientTrustBadge(food, provenanceOptions),
	);
	const visibleTrustBadge = $derived(
		variant === "saved-card" && trustBadge?.value === "verified"
			? null
			: trustBadge,
	);
</script>

{#if visibleTrustBadge}
	<span class="ingredient-provenance-badges">
		{#if visibleTrustBadge.value === "verified"}
			<VerifiedStatusBadge label={visibleTrustBadge.label} />
		{:else}
			<TextBadge
				label={visibleTrustBadge.label}
				tone={visibleTrustBadge.tone}
				ariaLabel={`Verification status: ${visibleTrustBadge.label}`}
			/>
		{/if}
	</span>
{/if}

<style lang="scss">
	@use "./IngredientProvenanceBadges.scss";
</style>
