<script lang="ts">
	import type { ProductIngredientsPanelProps } from "./types";

	let { food }: ProductIngredientsPanelProps = $props();

	const ingredientText = $derived(
		food.ingredients?.trim() ||
			(food.ingredientList ?? [])
				.map((ingredient) => ingredient.trim())
				.filter(Boolean)
				.join(", "),
	);
</script>

{#if ingredientText}
	<section class="product-ingredients-panel" aria-labelledby="product-ingredients-title">
		<h2 id="product-ingredients-title">Ingredients</h2>
		<p>{ingredientText}</p>
	</section>
{/if}

<style lang="scss">
	@use "./ProductIngredientsPanel.scss";
</style>
