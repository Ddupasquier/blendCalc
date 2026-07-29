<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import FoodSymbol from "$lib/assets/icons/FoodSymbol/FoodSymbol.svelte";
	import CustomBadge from "$lib/components/common/display/CustomBadge/CustomBadge.svelte";
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import { animatedDetails } from "$lib/utils/accessibility/animatedDetails";
	import type { FdcFood } from "$lib/utils/food/types";
	import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";
	import type { SavedDrinkIngredientPillsProps } from "./types";

	let {
		foods,
		visibleLimit = 8,
	}: SavedDrinkIngredientPillsProps = $props();

	const visibleFoods = $derived(foods.slice(0, visibleLimit));
	const hiddenFoods = $derived(foods.slice(visibleLimit));
</script>

{#snippet ingredientPills(items: FdcFood[])}
	<ul class="saved-drink-ingredients__pills">
		{#each items as food (food.fdcId)}
			<li>
				{#if isPrivateCustomFood(food)}
					<MetadataPill
						class="saved-drink-ingredients__pill"
						label={food.description}
						title={food.description}
						tone="soft"
					>
						{#snippet leading()}
							<span class="saved-drink-ingredients__symbol">
								<FoodSymbol {food} fallbackOnly />
							</span>
						{/snippet}
						{#snippet trailing()}
							<CustomBadge />
						{/snippet}
					</MetadataPill>
				{:else}
					<MetadataPill
						class="saved-drink-ingredients__pill"
						label={food.description}
						title={food.description}
						tone="soft"
					>
						{#snippet leading()}
							<span class="saved-drink-ingredients__symbol">
								<FoodSymbol {food} fallbackOnly />
							</span>
						{/snippet}
					</MetadataPill>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<div class="saved-drink-ingredients">
	{@render ingredientPills(visibleFoods)}

	{#if hiddenFoods.length > 0}
		<details
			class="saved-drink-ingredients__overflow"
			use:animatedDetails
		>
			<summary>
				<span class="saved-drink-ingredients__more-label">
					+{hiddenFoods.length} more
					{hiddenFoods.length === 1 ? "ingredient" : "ingredients"}
				</span>
				<span class="saved-drink-ingredients__less-label">
					Show fewer ingredients
				</span>
				<span class="saved-drink-ingredients__chevron" aria-hidden="true">
					<Chevron direction="down" />
				</span>
			</summary>
			<div class="saved-drink-ingredients__hidden">
				{@render ingredientPills(hiddenFoods)}
			</div>
		</details>
	{/if}
</div>

<style lang="scss">
	@use "./SavedDrinkIngredientPills.scss";
</style>
