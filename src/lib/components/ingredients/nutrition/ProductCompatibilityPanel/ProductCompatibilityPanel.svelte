<script lang="ts">
	import {
		getUniqueFoodMetadataTags,
	} from "$lib/utils/food/records/foodMetadataPresentation";
	import type { ProductCompatibilityPanelProps } from "./types";

	let { food }: ProductCompatibilityPanelProps = $props();

	const allergenDisplay = $derived(food.allergenDisclosure);
	const dietaryLabels = $derived(
		getUniqueFoodMetadataTags(
			(food.compatibilitySummary?.dietaryClaims ?? [])
				.map((fact) => fact.label),
		),
	);
	const dietaryConsiderations = $derived(
		getUniqueFoodMetadataTags(
			(food.compatibilitySummary?.allFacts ?? [])
				.filter((fact) =>
					fact.category === "avoidance" &&
					fact.factType === "dietary_conflict"
				)
				.map((fact) => fact.label),
		),
	);
	const hasContent = $derived(
		Boolean(
			allergenDisplay?.contains.length ||
				allergenDisplay?.mayContain.length ||
				dietaryLabels.length ||
				dietaryConsiderations.length,
		),
	);
</script>

{#if hasContent}
	<div class="product-compatibility-panel">
		{#if allergenDisplay?.contains.length}
			<section class="product-compatibility-panel__group">
				<h2>Contains</h2>
				<p>{allergenDisplay.contains.join(", ")}</p>
			</section>
		{/if}

		{#if allergenDisplay?.mayContain.length}
			<section class="product-compatibility-panel__group">
				<h2>May contain</h2>
				<p>{allergenDisplay.mayContain.join(", ")}</p>
			</section>
		{/if}

		{#if dietaryLabels.length}
			<section class="product-compatibility-panel__group">
				<h2>Dietary labels</h2>
				<p>{dietaryLabels.join(", ")}</p>
			</section>
		{/if}

		{#if dietaryConsiderations.length}
			<section class="product-compatibility-panel__group">
				<h2>Dietary considerations</h2>
				<p>{dietaryConsiderations.join(", ")}</p>
			</section>
		{/if}
	</div>
{/if}

<style lang="scss">
	@use "./ProductCompatibilityPanel.scss";
</style>
