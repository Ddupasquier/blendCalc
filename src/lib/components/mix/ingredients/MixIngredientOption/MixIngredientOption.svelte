<script lang="ts">
	import CardWarningEdge from "$lib/components/common/display/CardWarningEdge/CardWarningEdge.svelte";
	import CardSelectionIndicator from "$lib/components/common/display/CardSelectionIndicator/CardSelectionIndicator.svelte";
	import CustomBadge from "$lib/components/common/display/CustomBadge/CustomBadge.svelte";
	import IngredientCardMedia from "$lib/components/ingredients/card/IngredientCardMedia/IngredientCardMedia.svelte";
	import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";
	import { getPrimaryFoodWarning } from "$lib/utils/ingredients/ingredientListUi";
	import type { MixIngredientOptionProps } from "./types";

	let { food, selected, onSelect }: MixIngredientOptionProps = $props();
	const warning = $derived(getPrimaryFoodWarning(food));
</script>

<article
	class="mix-ingredient-option mix-ingredient-option--media"
	class:mix-ingredient-option--selected={selected}
>
	<IngredientCardMedia {food} />
	{#if warning}
		<CardWarningEdge />
	{/if}
	<button
		type="button"
		class="mix-ingredient-option__select"
		aria-pressed={selected}
		aria-label={`${selected ? "Remove" : "Add"} ${food.description} ${selected ? "from" : "to"} this mix${warning ? `. Warning: ${warning}` : ""}`}
		onclick={onSelect}
	>
		<span class="mix-ingredient-option__select-status">
			<CardSelectionIndicator {selected} variant="circle" />
		</span>
	</button>
	<span class="mix-ingredient-option__copy">
		<span class="mix-ingredient-option__title-row">
			<strong title={food.description}>{food.description}</strong>
			{#if isPrivateCustomFood(food)}<CustomBadge />{/if}
		</span>
	</span>
</article>

<style lang="scss">
	@use "./MixIngredientOption.scss";
</style>
