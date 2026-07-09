<script lang="ts">
	import NutritionFactsLabel from "$lib/components/ingredients/nutrition/NutritionFactsLabel.svelte";
	import NutritionListActions from "$lib/components/ingredients/nutrition/NutritionListActions.svelte";
	import ProductImagePanel from "$lib/components/ingredients/nutrition/ProductImagePanel.svelte";
	import type { FdcFood } from "$lib/utils/food/types";
	import {
		DEFAULT_NUTRITION_VIEWING_GRAMS,
	} from "$lib/utils/food/nutrients/nutritionDisplay";
	import type { IngredientListMembership } from "$lib/utils/ingredients/ingredientListUi";

	let {
		food,
		showListActions = true,
		viewingGrams = DEFAULT_NUTRITION_VIEWING_GRAMS,
		listMembership = { inFridge: false, inShoppingList: false },
	}: {
		food?: FdcFood;
		showListActions?: boolean;
		viewingGrams?: number;
		listMembership?: IngredientListMembership;
	} = $props();
</script>

<section class="nutrition-panel">
	<ProductImagePanel {food} />
	<NutritionFactsLabel {food} {viewingGrams} />
	<NutritionListActions {food} {showListActions} {listMembership} />
</section>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.nutrition-panel {
		display: grid;
		gap: $app-vertical-stack-gap;
		width: 100%;
	}
</style>
