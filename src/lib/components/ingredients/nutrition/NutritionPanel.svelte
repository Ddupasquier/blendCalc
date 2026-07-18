<script lang="ts">
	import NutritionFactsLabel from "$lib/components/ingredients/nutrition/NutritionFactsLabel.svelte";
	import NutritionListActions from "$lib/components/ingredients/nutrition/NutritionListActions.svelte";
	import NutritionPreferenceConflict from "$lib/components/ingredients/nutrition/NutritionPreferenceConflict.svelte";
	import ProductImagePanel from "$lib/components/ingredients/nutrition/ProductImagePanel.svelte";
	import {
		DEFAULT_NUTRITION_VIEWING_GRAMS,
	} from "$lib/utils/food/nutrients/nutritionDisplay";
	import type { NutritionPanelProps } from "./types";

	let {
		food,
		showListActions = true,
		viewingGrams = DEFAULT_NUTRITION_VIEWING_GRAMS,
		viewingServingLabel,
		listMembership = { inFridge: false, inShoppingList: false },
		canAdjustImagePlacement = false,
		onImagePlacementSave,
	}: NutritionPanelProps = $props();
</script>

<section class="nutrition-panel">
	<ProductImagePanel {food} {canAdjustImagePlacement} {onImagePlacementSave} />
	<NutritionPreferenceConflict {food} />
	<NutritionFactsLabel {food} {viewingGrams} {viewingServingLabel} />
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
