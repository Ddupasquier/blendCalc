<script lang="ts">
	import FoodSymbol from "$lib/assets/icons/FoodSymbol/FoodSymbol.svelte";
	import DisclosureChevron from "$lib/components/common/disclosure/DisclosureChevron/DisclosureChevron.svelte";
	import CustomBadge from "$lib/components/common/display/CustomBadge/CustomBadge.svelte";
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import { animatedDetails } from "$lib/utils/animation/animatedDetails";
	import type { FdcFood } from "$lib/utils/food/types";
	import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";
	import {
		packIngredientPills,
		type PackedIngredientPill,
	} from "./ingredientPillLayout";
	import type { SavedRecipeIngredientPillsProps } from "./types";

	let {
		foods,
		visibleLimit = 8,
	}: SavedRecipeIngredientPillsProps = $props();

	const visibleFoods = $derived(
		packIngredientPills(foods.slice(0, visibleLimit)),
	);
	const hiddenFoods = $derived(
		packIngredientPills(foods.slice(visibleLimit)),
	);
</script>

{#snippet ingredientPills(items: PackedIngredientPill[])}
	<ul class="saved-recipe-ingredients__pills">
		{#each items as pill (pill.food.fdcId)}
			{@const food = pill.food}
			<li data-span={pill.span}>
				{#if isPrivateCustomFood(food)}
					<MetadataPill
						class="saved-recipe-ingredients__pill"
						label={food.description}
						title={food.description}
						tone="soft"
					>
						{#snippet leading()}
							<span class="saved-recipe-ingredients__symbol">
								<FoodSymbol {food} fallbackOnly />
							</span>
						{/snippet}
						{#snippet trailing()}
							<CustomBadge />
						{/snippet}
					</MetadataPill>
				{:else}
					<MetadataPill
						class="saved-recipe-ingredients__pill"
						label={food.description}
						title={food.description}
						tone="soft"
					>
						{#snippet leading()}
							<span class="saved-recipe-ingredients__symbol">
								<FoodSymbol {food} fallbackOnly />
							</span>
						{/snippet}
					</MetadataPill>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<div class="saved-recipe-ingredients">
	{@render ingredientPills(visibleFoods)}

	{#if hiddenFoods.length > 0}
		<details
			class="saved-recipe-ingredients__overflow"
			use:animatedDetails
		>
			<summary>
				<span class="saved-recipe-ingredients__more-label">
					+{hiddenFoods.length} more
					{hiddenFoods.length === 1 ? "ingredient" : "ingredients"}
				</span>
				<span class="saved-recipe-ingredients__less-label">
					Show fewer ingredients
				</span>
				<DisclosureChevron class="saved-recipe-ingredients__chevron" />
			</summary>
			<div class="saved-recipe-ingredients__hidden">
				{@render ingredientPills(hiddenFoods)}
			</div>
		</details>
	{/if}
</div>

<style lang="scss">
	@use "./SavedRecipeIngredientPills.scss";
</style>
