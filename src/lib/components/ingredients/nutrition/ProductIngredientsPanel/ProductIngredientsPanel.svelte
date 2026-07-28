<script lang="ts">
	import {
		getUniqueFoodMetadataTags,
	} from "$lib/utils/food/records/foodMetadataPresentation";
	import type { FoodStructuredIngredient } from "$lib/utils/food/types";
	import type { ProductIngredientsPanelProps } from "./types";

	let { food }: ProductIngredientsPanelProps = $props();

	const ingredientText = $derived(
		food.ingredients?.trim() ||
			(food.ingredientList ?? [])
				.map((ingredient) => ingredient.trim())
				.filter(Boolean)
				.join(", "),
	);
	const additives = $derived(getUniqueFoodMetadataTags(food.additives ?? []));
	const getPercentageLabel = (ingredient: FoodStructuredIngredient) => {
		if (Number.isFinite(ingredient.percent)) {
			return `${ingredient.percent}%`;
		}
		if (Number.isFinite(ingredient.percentEstimate)) {
			return `About ${ingredient.percentEstimate}%`;
		}
		if (
			Number.isFinite(ingredient.percentMin) &&
			Number.isFinite(ingredient.percentMax)
		) {
			return `${ingredient.percentMin}–${ingredient.percentMax}%`;
		}
		if (Number.isFinite(ingredient.percentMin)) {
			return `At least ${ingredient.percentMin}%`;
		}
		if (Number.isFinite(ingredient.percentMax)) {
			return `Up to ${ingredient.percentMax}%`;
		}
		return "";
	};
	const flattenStructuredIngredients = (
		ingredients: FoodStructuredIngredient[],
		depth = 0,
	): Array<{ text: string; percentage: string; depth: number }> =>
		ingredients.flatMap((ingredient) => {
			const text = ingredient.text?.trim() ?? "";
			const current = text
				? [{
						text,
						percentage: getPercentageLabel(ingredient),
						depth: Math.min(depth, 3),
					}]
				: [];
			return [
				...current,
				...flattenStructuredIngredients(
					ingredient.ingredients ?? [],
					depth + 1,
				),
			];
		});
	const structuredIngredients = $derived(
		flattenStructuredIngredients(food.structuredIngredients ?? []),
	);
	const hasStructuredDetails = $derived(
		structuredIngredients.some(
			(ingredient) => ingredient.percentage || ingredient.depth > 0,
		),
	);
</script>

{#if ingredientText || additives.length > 0 || hasStructuredDetails}
	<section class="product-ingredients-panel" aria-labelledby="product-ingredients-title">
		<h2 id="product-ingredients-title">Ingredients</h2>
		{#if ingredientText}
			<p>{ingredientText}</p>
		{/if}
		{#if hasStructuredDetails}
			<div class="product-ingredients-panel__details">
				<h3>Ingredient breakdown</h3>
				<ul>
					{#each structuredIngredients as ingredient}
						<li class={`product-ingredients-panel__depth-${ingredient.depth}`}>
							<span>{ingredient.text}</span>
							{#if ingredient.percentage}
								<strong>{ingredient.percentage}</strong>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if additives.length > 0}
			<div class="product-ingredients-panel__details">
				<h3>Additives</h3>
				<p>{additives.join(", ")}</p>
			</div>
		{/if}
	</section>
{/if}

<style lang="scss">
	@use "./ProductIngredientsPanel.scss";
</style>
