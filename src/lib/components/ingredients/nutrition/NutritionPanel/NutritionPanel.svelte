<script lang="ts">
	import NutritionFactsLabel from "$lib/components/ingredients/nutrition/NutritionFactsLabel/NutritionFactsLabel.svelte";
	import NutritionListActions from "$lib/components/ingredients/nutrition/NutritionListActions/NutritionListActions.svelte";
	import NutritionPreferenceConflict from "$lib/components/ingredients/nutrition/NutritionPreferenceConflict/NutritionPreferenceConflict.svelte";
	import ProductImagePanel from "$lib/components/ingredients/nutrition/ProductImagePanel/ProductImagePanel.svelte";
	import {
		DEFAULT_NUTRITION_VIEWING_GRAMS,
	} from "$lib/utils/food/nutrients/nutritionDisplay";
	import type { NutritionPanelProps } from "./types";

	let {
		food,
		showListActions = true,
		viewingGrams = DEFAULT_NUTRITION_VIEWING_GRAMS,
		viewingServing,
		listMembership = { inFridge: false, inShoppingList: false },
		canAdjustImagePlacement = false,
		onImagePlacementSave,
		provenanceOptions = [],
	}: NutritionPanelProps = $props();
</script>

<section class="nutrition-panel">
	<ProductImagePanel {food} {canAdjustImagePlacement} {onImagePlacementSave} />
	<NutritionPreferenceConflict {food} />
	<NutritionFactsLabel {food} {viewingGrams} {viewingServing} {provenanceOptions} />
	<NutritionListActions {food} {showListActions} {listMembership} />
</section>

<style lang="scss">
	@use "./NutritionPanel.scss";
</style>
