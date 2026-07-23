<script lang="ts">
	import { getFoodAllergenDisplay } from "$lib/utils/food/records/foodAllergens";
	import type { ProductAllergenPanelProps } from "./types";

	let { food }: ProductAllergenPanelProps = $props();

	const allergenDisplay = $derived(getFoodAllergenDisplay(food));
</script>

{#if allergenDisplay.contains.length > 0 || allergenDisplay.mayContain.length > 0}
	<div class="product-allergen-panel">
		{#if allergenDisplay.contains.length > 0}
			<section class="product-allergen-panel__group">
				<h2>Contains</h2>
				<p>{allergenDisplay.contains.join(", ")}</p>
			</section>
		{/if}

		{#if allergenDisplay.mayContain.length > 0}
			<section class="product-allergen-panel__group">
				<h2>May contain</h2>
				<p>{allergenDisplay.mayContain.join(", ")}</p>
			</section>
		{/if}
	</div>
{/if}

<style lang="scss">
	@use "./ProductAllergenPanel.scss";
</style>
