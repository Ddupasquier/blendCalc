<script lang="ts">
	import CardWarningFrame from "$lib/components/common/display/CardWarningFrame/CardWarningFrame.svelte";
	import CardSelectionIndicator from "$lib/components/common/display/CardSelectionIndicator/CardSelectionIndicator.svelte";
	import IngredientCardMedia from "$lib/components/ingredients/card/IngredientCardMedia/IngredientCardMedia.svelte";
	import {
		getFoodWarningFrameTone,
		getPrimaryFoodWarning,
	} from "$lib/utils/ingredients/ingredientListUi";
	import type { MixIngredientOptionProps } from "./types";

	let { food, selected, onSelect }: MixIngredientOptionProps = $props();
	const warning = $derived(getPrimaryFoodWarning(food));
	const warningFrameTone = $derived(getFoodWarningFrameTone(food));
</script>

<article
	class="mix-ingredient-option mix-ingredient-option--media"
	class:mix-ingredient-option--selected={selected}
	class:mix-ingredient-option--warning={warningFrameTone !== null}
	data-warning-tone={warningFrameTone ?? undefined}
>
	<IngredientCardMedia {food} />
	{#if warningFrameTone}
		<CardWarningFrame tone={warningFrameTone} />
	{/if}
	<button
		type="button"
		class="mix-ingredient-option__select"
		aria-pressed={selected}
		aria-label={`${selected ? "Remove" : "Add"} ${food.description} ${selected ? "from" : "to"} this mix${warning ? `. Warning: ${warning}` : ""}`}
		onclick={onSelect}
	></button>
	<span class="mix-ingredient-option__copy">
		<strong title={food.description}>{food.description}</strong>
	</span>
	<span class="mix-ingredient-option__select-status">
		<CardSelectionIndicator {selected} variant="circle" />
	</span>
</article>

<style lang="scss">
	@use "./MixIngredientOption.scss";
</style>
