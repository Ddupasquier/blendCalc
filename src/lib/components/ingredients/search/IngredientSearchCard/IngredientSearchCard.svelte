<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import Leaf from "$lib/assets/icons/Leaf/Leaf.svelte";
	import Plus from "$lib/assets/icons/Plus/Plus.svelte";
	import ShoppingBag from "$lib/assets/icons/ShoppingBag/ShoppingBag.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import CardWarningEdge from "$lib/components/common/display/CardWarningEdge/CardWarningEdge.svelte";
	import IngredientCardMedia from "$lib/components/ingredients/card/IngredientCardMedia/IngredientCardMedia.svelte";
	import IngredientProvenanceBadges from "$lib/components/ingredients/provenance/IngredientProvenanceBadges/IngredientProvenanceBadges.svelte";
	import {
		getFoodDisplayCategory,
		getFoodWarningEdgeTone,
		getIngredientListLabel,
		getOppositeIngredientListKey,
		getPrimaryFoodWarning,
	} from "$lib/utils/ingredients/ingredientListUi";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
	import type { IngredientSearchCardProps } from "./types";

	let {
		food,
		index,
		active = false,
		adding = false,
		destinationListKey = MIX_STORAGE_KEYS.fridge,
		alreadyInDestinationList = false,
		alreadyInOtherList = false,
		provenanceOptions = [],
		onSelect,
		onAdd,
		onActivate,
	}: IngredientSearchCardProps = $props();

	const category = $derived(getFoodDisplayCategory(food));
	const warning = $derived(getPrimaryFoodWarning(food));
	const warningEdgeTone = $derived(getFoodWarningEdgeTone(food));
	const destinationListLabel = $derived(
		getIngredientListLabel(destinationListKey),
	);
	const otherListLabel = $derived(
		getIngredientListLabel(getOppositeIngredientListKey(destinationListKey)),
	);
	const listMembershipDescription = $derived(
		alreadyInDestinationList
			? `already in ${destinationListLabel}`
			: alreadyInOtherList
				? `currently in ${otherListLabel}`
				: "",
	);
	const placementActionLabel = $derived(
		alreadyInOtherList
			? `Move ${food.description} to ${destinationListLabel}`
			: `Add ${food.description} to ${destinationListLabel}`,
	);
</script>

<div
	id={`ingredient-search-result-${food.fdcId}`}
	class="ingredient-search-card ingredient-search-card--media"
	class:ingredient-search-card--active={active}
	class:ingredient-search-card--without-placement-action={alreadyInDestinationList}
	role="row"
	tabindex="-1"
	aria-label={`${food.description}, ${category}${listMembershipDescription ? `, ${listMembershipDescription}` : ""}${warning ? `, warning: ${warning}` : ""}`}
	aria-selected={active}
	onmouseenter={() => onActivate(index)}
>
	<IngredientCardMedia {food} />
	{#if warning && warningEdgeTone}
		<CardWarningEdge tone={warningEdgeTone} />
	{/if}
	<span class="ingredient-search-card__main-cell" role="gridcell">
		<button
			class="ingredient-search-card__main"
			type="button"
			aria-label={`View nutrition for ${food.description}${listMembershipDescription ? `, ${listMembershipDescription}` : ""}${warning ? `. Warning: ${warning}` : ""}`}
			onfocus={() => onActivate(index)}
			onclick={() => onSelect(food)}
		></button>
		<span class="ingredient-search-card__copy">
			<span class="ingredient-search-card__title-row">
				<strong title={food.description}>{food.description}</strong>
				<IngredientProvenanceBadges
					{food}
					{provenanceOptions}
					variant="search-card"
				/>
			</span>
			<small>
				{category}{listMembershipDescription
					? ` · ${listMembershipDescription}`
					: ""}
			</small>
		</span>
	</span>
	{#if !alreadyInDestinationList}
		<span class="ingredient-search-card__add-cell" role="gridcell">
			<CircleIconButton
				class="ingredient-search-card__add ingredient-card-action-button"
				label={placementActionLabel}
				busy={adding}
				disabled={adding}
				variant="primary"
				size="small"
				onfocus={() => onActivate(index)}
				onclick={() => onAdd(food)}
			>
				{#if alreadyInOtherList}
					{#if destinationListKey === MIX_STORAGE_KEYS.fridge}
						<Leaf size={17} />
					{:else}
						<ShoppingBag size={17} />
					{/if}
				{:else}
					<Plus size={17} strokeWidth={2.9} />
				{/if}
			</CircleIconButton>
		</span>
	{/if}
	<span class="ingredient-search-card__open" role="gridcell" aria-hidden="true">
		<Chevron class="ingredient-search-card__chevron" direction="right" />
	</span>
</div>

<style lang="scss">
	@use "./IngredientSearchCard.scss";
</style>
