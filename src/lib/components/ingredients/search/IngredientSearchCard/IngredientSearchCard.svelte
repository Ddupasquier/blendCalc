<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import Plus from "$lib/assets/icons/Plus/Plus.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import CardWarningEdge from "$lib/components/common/display/CardWarningEdge/CardWarningEdge.svelte";
	import IngredientCardMedia from "$lib/components/ingredients/card/IngredientCardMedia/IngredientCardMedia.svelte";
	import IngredientProvenanceBadges from "$lib/components/ingredients/provenance/IngredientProvenanceBadges/IngredientProvenanceBadges.svelte";
	import {
		getFoodDisplayCategory,
		getPrimaryFoodWarning,
	} from "$lib/utils/ingredients/ingredientListUi";
	import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
	import type { IngredientSearchCardProps } from "./types";

	let {
		food,
		index,
		active = false,
		adding = false,
		saved = false,
		provenanceOptions = [],
		onSelect,
		onAdd,
		onActivate,
	}: IngredientSearchCardProps = $props();

	const foodPreferenceContext = getFoodPreferenceContext();
	const category = $derived(getFoodDisplayCategory(food));
	const warning = $derived(
		getPrimaryFoodWarning(food, foodPreferenceContext.current),
	);
</script>

<div
	id={`ingredient-search-result-${food.fdcId}`}
	class="ingredient-search-card ingredient-search-card--media"
	class:ingredient-search-card--active={active}
	class:ingredient-search-card--saved={saved}
	role="row"
	tabindex="-1"
	aria-label={`${food.description}, ${category}${saved ? ", already in Fridge or Shopping List" : ""}${warning ? `, warning: ${warning}` : ""}`}
	aria-selected={active}
	onmouseenter={() => onActivate(index)}
>
	<IngredientCardMedia {food} />
	{#if warning}
		<CardWarningEdge />
	{/if}
	<span class="ingredient-search-card__main-cell" role="gridcell">
		<button
			class="ingredient-search-card__main"
			type="button"
			aria-label={`View nutrition for ${food.description}${saved ? ", already in Fridge or Shopping List" : ""}${warning ? `. Warning: ${warning}` : ""}`}
			onfocus={() => onActivate(index)}
			onclick={() => onSelect(food)}
		>
			<span class="ingredient-search-card__copy">
				<span class="ingredient-search-card__title-row">
					<strong title={food.description}>{food.description}</strong>
					<IngredientProvenanceBadges
						{food}
						{provenanceOptions}
						variant="search-card"
					/>
				</span>
				<small>{category}</small>
			</span>
		</button>
	</span>
	{#if !saved}
		<span class="ingredient-search-card__add-cell" role="gridcell">
			<CircleIconButton
				class="ingredient-search-card__add"
				label={`Add ${food.description} to fridge`}
				busy={adding}
				disabled={adding}
				variant="primary"
				size="small"
				onfocus={() => onActivate(index)}
				onclick={() => onAdd(food)}
			>
				<Plus size={17} strokeWidth={2.9} />
			</CircleIconButton>
		</span>
	{/if}
	<span
		class="ingredient-search-card__open"
		role="gridcell"
		aria-hidden="true"
	>
		<Chevron class="ingredient-search-card__chevron" direction="right" />
	</span>
</div>

<style lang="scss">
	@use "./IngredientSearchCard.scss";
</style>
